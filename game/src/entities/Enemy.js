// Enemy — rogue machine. Three kinds, all driven off CONFIG.enemy[type].kind:
//   rusher (crawler)  — charges and melees on contact
//   ranged (turret)   — stationary, yaws to player, fires bolts on line-of-sight
//   tank   (hauler)   — slow, heavy melee, soaks damage, guards loot
import * as THREE from 'three';
import { buildAsset } from '../assets.js';
import { CONFIG } from '../data/config.js';
import { EnemyAnimator } from './EnemyAnimator.js';

const UP = new THREE.Vector3(0, 1, 0);

function angleDelta(a, b) {
  let delta = a - b;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return delta;
}

function sectorGeometry(radius, halfAngle, segments = 28) {
  const positions = [0, 0, 0];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const angle = -halfAngle + (i / segments) * halfAngle * 2;
    positions.push(Math.sin(angle) * radius, 0, Math.cos(angle) * radius);
    if (i > 0) indices.push(0, i, i + 1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function arcBandGeometry(radius, halfAngle, segments = 36, width = 0.22) {
  const positions = [];
  const indices = [];
  for (let i = 0; i <= segments; i++) {
    const angle = -halfAngle + (i / segments) * halfAngle * 2;
    for (const r of [radius - width, radius]) {
      positions.push(Math.sin(angle) * r, 0, Math.cos(angle) * r);
    }
    if (i > 0) {
      const a = (i - 1) * 2;
      const b = a + 1;
      const c = i * 2;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

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
    this.scanYaw = Math.atan2(position.x * 0.73 + position.z * 0.31, position.z * 0.41 - position.x * 0.27);
    this.lockTimer = 0;
    this.alerted = false;
    this.lostSightTimer = 0;
    this._dir = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._beamStart = new THREE.Vector3();
    this._beamEnd = new THREE.Vector3();
    this._beamVector = new THREE.Vector3();
    this.anim = new EnemyAnimator(this.mesh);
    if (this.kind === 'ranged') this._buildScanner();
  }

  get position() { return this.mesh.position; }

  setEye(intensity) { if (this.mesh.userData.eye) this.mesh.userData.eye.material.emissiveIntensity = intensity; }

  _buildScanner() {
    const halfFov = THREE.MathUtils.degToRad((this.def.scanFovDeg || 48) * 0.5);
    const radius = this.def.aggroRange;
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0xff2d20,
      transparent: true,
      opacity: 0.026,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.scanCone = new THREE.Mesh(sectorGeometry(radius, halfFov), coneMat);
    this.scanCone.position.y = 0.13;
    this.scanCone.renderOrder = 2;
    this.mesh.add(this.scanCone);

    const arcMat = new THREE.MeshBasicMaterial({
      color: 0xff4a35,
      transparent: true,
      opacity: 0.58,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    this.scanArc = new THREE.Mesh(arcBandGeometry(radius, halfFov), arcMat);
    this.scanArc.position.y = 0.145;
    this.scanArc.renderOrder = 3;
    this.mesh.add(this.scanArc);

    this.scanRayRoot = new THREE.Group();
    this.scanRay = new THREE.Mesh(
      new THREE.PlaneGeometry(0.055, radius),
      new THREE.MeshBasicMaterial({
        color: 0xff2418,
        transparent: true,
        opacity: 0.48,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.scanRay.rotation.x = -Math.PI / 2;
    this.scanRay.position.set(0, 0.155, radius * 0.5);
    this.scanRay.renderOrder = 4;
    this.scanRayRoot.add(this.scanRay);
    this.mesh.add(this.scanRayRoot);

    this.lockBeam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 1, 6),
      new THREE.MeshBasicMaterial({
        color: 0xff1f16,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.lockBeam.visible = false;
    this.lockBeam.renderOrder = 4;
    this.mesh.add(this.lockBeam);

    this.lockPoint = new THREE.Mesh(
      new THREE.RingGeometry(0.12, 0.18, 20),
      new THREE.MeshBasicMaterial({
        color: 0xff2f20,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.lockPoint.rotation.x = -Math.PI / 2;
    this.lockPoint.visible = false;
    this.lockPoint.renderOrder = 4;
    this.mesh.add(this.lockPoint);
  }

  _setScannerYaw(yaw) {
    if (this.scanCone) this.scanCone.rotation.y = yaw;
    if (this.scanArc) this.scanArc.rotation.y = yaw;
    if (this.scanRayRoot) this.scanRayRoot.rotation.y = yaw;
  }

  _updateLockBeam(targetPos, progress, time) {
    if (!this.lockBeam || !this.lockPoint) return;
    const localX = targetPos.x - this.position.x;
    const localZ = targetPos.z - this.position.z;
    this._beamStart.set(0, this.mesh.userData.muzzleY || 0.85, 0.32);
    this._beamEnd.set(localX, 0.42, localZ);
    this._beamVector.copy(this._beamEnd).sub(this._beamStart);
    const length = this._beamVector.length();
    this.lockBeam.position.copy(this._beamStart).addScaledVector(this._beamVector, 0.5);
    this.lockBeam.scale.set(1, length, 1);
    this.lockBeam.quaternion.setFromUnitVectors(UP, this._beamVector.normalize());
    const pulse = 0.68 + Math.sin(time * (7 + progress * 9)) * 0.22;
    this.lockBeam.material.opacity = (0.18 + progress * 0.72) * pulse;
    this.lockBeam.visible = true;

    this.lockPoint.position.set(localX, 0.15, localZ);
    this.lockPoint.scale.setScalar(0.72 + progress * 0.58 + Math.sin(time * 10) * 0.08);
    this.lockPoint.material.opacity = 0.25 + progress * 0.65;
    this.lockPoint.visible = true;
  }

  _hideLockBeam() {
    if (this.lockBeam) this.lockBeam.visible = false;
    if (this.lockPoint) this.lockPoint.visible = false;
  }

  update(dt, targetPos, hasLOS) {
    this.pendingShot = null;
    if (this.hitFlash > 0) { this.hitFlash = Math.max(0, this.hitFlash - dt); }
    this.mesh.scale.setScalar(1 + this.hitFlash * 1.5); // hit punch
    if (!this.alive) { this.anim.update(dt, { aimYaw: this.aimYaw }); return; }

    this.attackTimer = Math.max(0, this.attackTimer - dt);
    const dist = this.position.distanceTo(targetPos);
    if (this.kind === 'ranged') {
      const targetYaw = Math.atan2(targetPos.x - this.position.x, targetPos.z - this.position.z);
      const halfFov = THREE.MathUtils.degToRad((this.def.scanFovDeg || 48) * 0.5);
      const inRange = dist <= this.def.aggroRange;
      const swept = Math.abs(angleDelta(targetYaw, this.scanYaw)) <= halfFov;
      const detected = inRange && hasLOS && (this.alerted || swept);

      if (!this.alerted) {
        this.scanYaw += dt * (this.def.scanSpeed || 0.55);
        this.scanYaw = THREE.MathUtils.euclideanModulo(this.scanYaw + Math.PI, Math.PI * 2) - Math.PI;
      }
      if (detected) {
        this.alerted = true;
        this.lostSightTimer = this.def.alertGraceSec || 0.8;
        this.aimYaw += angleDelta(targetYaw, this.aimYaw) * Math.min(1, dt * 8);
      } else if (this.alerted) {
        this.lostSightTimer -= dt;
        if (this.lostSightTimer <= 0) {
          this.alerted = false;
          this.lockTimer = 0;
          this.scanYaw = this.aimYaw;
        }
      }

      if (!this.alerted) this.aimYaw = this.scanYaw;
      const visualYaw = this.alerted ? this.aimYaw : this.scanYaw;
      this._setScannerYaw(visualYaw);
      this.setEye(this.alerted ? 2.8 : 0.9);
      if (this.scanCone) this.scanCone.material.opacity = this.alerted ? 0.058 : 0.024;
      if (this.scanArc) this.scanArc.material.opacity = this.alerted ? 0.88 : 0.56;
      if (this.scanRay) this.scanRay.material.opacity = this.alerted ? 0.72 : 0.46;

      const canLock = this.alerted && inRange && hasLOS && dist <= this.def.attackRange && this.attackTimer <= 0;
      if (canLock) {
        this.lockTimer += dt;
        const progress = Math.min(1, this.lockTimer / (this.def.lockOnSec || 1.1));
        this._updateLockBeam(targetPos, progress, this.anim.t);
      } else {
        this.lockTimer = 0;
        this._hideLockBeam();
      }

      if (canLock && this.lockTimer >= (this.def.lockOnSec || 1.1)) {
        this.attackTimer = this.def.attackCooldown;
        this.lockTimer = 0;
        this._hideLockBeam();
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

    const aggro = dist <= this.def.aggroRange;
    this.setEye(aggro ? 1.8 : 0.7);
    if (!aggro) { this.anim.update(dt, { aimYaw: this.aimYaw }); return; }

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
    if (this.health <= 0) {
      this.alive = false;
      this.alerted = false;
      this._hideLockBeam();
      if (this.scanCone) this.scanCone.visible = false;
      if (this.scanArc) this.scanArc.visible = false;
      if (this.scanRay) this.scanRay.visible = false;
      this.anim.death();
    }
    return !this.alive;
  }
}
