// Enemy — rogue machine. Three kinds, all driven off CONFIG.enemy[type].kind:
//   rusher (crawler)  — charges and melees on contact
//   ranged (turret)   — stationary, yaws to player, fires bolts on line-of-sight
//   tank   (hauler)   — slow, heavy melee, soaks damage, guards loot
import * as THREE from 'three';
import { buildAsset } from '../assets.js';
import { CONFIG } from '../data/config.js';
import { EnemyAnimator } from './EnemyAnimator.js';

export class Enemy {
  constructor(type = 'crawler', position = new THREE.Vector3()) {
    this.type = type;
    this.def = CONFIG.enemy[type];
    this.kind = this.def.kind;
    this.mesh = buildAsset(`enemy_${type}`);
    this.mesh.position.copy(position);
    this.health = this.def.health;
    this.maxHealth = this.def.health;
    this.alive = true;
    this.radius = this.def.contactRadius;
    this.attackTimer = 0;
    this.hitFlash = 0;
    this.pendingShot = null;      // ranged enemies set this; Game consumes it
    this.aimYaw = 0;
    this._dir = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this.anim = new EnemyAnimator(this.mesh);
  }

  get position() { return this.mesh.position; }

  setEye(intensity) { if (this.mesh.userData.eye) this.mesh.userData.eye.material.emissiveIntensity = intensity; }

  update(dt, targetPos, hasLOS) {
    this.pendingShot = null;
    if (this.hitFlash > 0) { this.hitFlash = Math.max(0, this.hitFlash - dt); }
    this.mesh.scale.setScalar(1 + this.hitFlash * 1.5); // hit punch
    if (!this.alive) { this.anim.update(dt, { aimYaw: this.aimYaw }); return; }

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const dist = this.position.distanceTo(targetPos);
    const aggro = dist <= this.def.aggroRange;
    this.setEye(aggro ? 1.8 : 0.7);
    if (!aggro) { this.anim.update(dt, { aimYaw: this.aimYaw }); return; }

    if (this.kind === 'ranged') {
      // yaw head toward player; fire when in range + clear line of sight
      const head = this.mesh.userData.head;
      const yaw = Math.atan2(targetPos.x - this.position.x, targetPos.z - this.position.z);
      this.aimYaw = yaw;
      if (head) head.rotation.y = yaw;
      if (dist <= this.def.attackRange && hasLOS && this.attackTimer <= 0) {
        this.attackTimer = this.def.attackCooldown;
        this.anim.attack();
        const origin = this._tmp.copy(this.position); origin.y = this.mesh.userData.muzzleY || 0.85;
        const dir = new THREE.Vector3(targetPos.x - this.position.x, 0, targetPos.z - this.position.z);
        this.pendingShot = {
          origin: origin.clone(), dir,
          speed: this.def.projectileSpeed, life: this.def.projectileLife, damage: this.def.damage,
        };
      }
      this.anim.update(dt, { aimYaw: this.aimYaw });
      return;
    }

    // rusher / tank: steer toward player, stop at melee range
    if (dist > this.def.attackRange) {
      this._dir.copy(targetPos).sub(this.position); this._dir.y = 0; this._dir.normalize();
      this.position.addScaledVector(this._dir, this.def.speed * dt);
      this.mesh.rotation.y = Math.atan2(this._dir.x, this._dir.z);
    }
    this.anim.update(dt, { moving: dist > this.def.attackRange });
  }

  // melee contact attack (rusher/tank). returns damage dealt this frame, else 0
  tryAttack(targetPos) {
    if (!this.alive || this.kind === 'ranged') return 0;
    if (this.attackTimer > 0) return 0;
    if (this.position.distanceTo(targetPos) <= this.def.attackRange) {
      this.attackTimer = this.def.attackCooldown;
      this.anim.attack();
      return this.def.damage;
    }
    return 0;
  }

  takeDamage(n) {
    this.health -= n;
    this.hitFlash = 0.12;
    this.anim.hit();
    if (this.health <= 0) { this.alive = false; this.anim.death(); }
    return !this.alive;
  }
}
