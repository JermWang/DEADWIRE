// Player — the local runner. Built from the shared char_runner asset + a weapon
// loadout (swap with 1/2/3). Only the active weapon mesh is shown.
import * as THREE from 'three';
import { buildAsset, mountWeaponToSocket } from '../assets.js';
import { CONFIG } from '../data/config.js';
import { PlayerAnimator } from './PlayerAnimator.js';

export class Player {
  constructor(cosmetics = {}) {
    this.mesh = buildAsset('char_runner', { pose: 'aim' });
    this.mesh.updateWorldMatrix(true, true);
    this.grip = this.mesh.getObjectByName(this.mesh.userData.weaponSocketName || 'hand_r') || this.mesh;

    // build the weapon loadout, mount all on the forward grip, show only the active
    this.loadout = CONFIG.loadout.map((key) => CONFIG.weapons[key]);
    this.weapons = this.loadout.map((def) => {
      const w = buildAsset(def.id);
      w.visible = false;
      mountWeaponToSocket(w, this.grip);
      return w;
    });
    this.weaponIndex = 0;
    this.weapons[0].visible = true;

    // optional cosmetics: { head:'helmet_breaker', backpack:'backpack_runner', ... }
    for (const [slot, id] of Object.entries(cosmetics)) {
      if (!id) continue;
      const cos = buildAsset(id);
      const socket = this.mesh.getObjectByName(slot);
      (socket || this.mesh).add(cos);
    }

    this.health = CONFIG.player.maxHealth;
    this.ammo = CONFIG.match.loadoutAmmo;   // finite per-run ammo (precious resource)
    this.alive = true;
    this.carryingCore = false;
    this.fireCooldown = 0;
    this.burstQueue = 0;       // remaining shots in a burst
    this.burstTimer = 0;
    this.radius = CONFIG.player.radius;
    this.facing = 0;
    this.verticalVelocity = 0;
    this.grounded = true;
    this.rolling = false;
    this.rollTimer = 0;
    this.rollCooldown = 0;
    this.rollDir = new THREE.Vector3();
    this.invulnerable = false;
    this._muzzle = new THREE.Vector3();
    this.anim = new PlayerAnimator(this);
  }

  get position() { return this.mesh.position; }
  get weapon() { return this.weapons[this.weaponIndex]; }
  get weaponDef() { return this.loadout[this.weaponIndex]; }

  swapTo(index) {
    if (index < 0 || index >= this.weapons.length || index === this.weaponIndex) return false;
    this.weapon.visible = false;
    this.weaponIndex = index;
    this.weapon.visible = true;
    this.burstQueue = 0;
    return true;
  }

  faceTo(point) {
    const dx = point.x - this.mesh.position.x;
    const dz = point.z - this.mesh.position.z;
    this.facing = Math.atan2(dx, dz);
    this.mesh.rotation.y = this.facing;
  }

  muzzleWorld() {
    const m = this.weapon.getObjectByName('muzzle');
    (m || this.weapon).getWorldPosition(this._muzzle);
    return this._muzzle;
  }

  jump() {
    if (!this.alive || !this.grounded || this.rolling) return false;
    this.grounded = false;
    this.verticalVelocity = CONFIG.player.jumpVelocity;
    return true;
  }

  startRoll(direction) {
    if (!this.alive || !this.grounded || this.rolling || this.rollCooldown > 0) return false;
    this.rolling = true;
    this.rollTimer = CONFIG.player.rollDuration;
    this.rollCooldown = CONFIG.player.rollCooldown;
    this.invulnerable = true;
    this.rollDir.copy(direction);
    if (this.rollDir.lengthSq() === 0) this.rollDir.set(0, 0, 1);
    this.rollDir.normalize();
    return true;
  }

  updateActions(dt) {
    this.rollCooldown = Math.max(0, this.rollCooldown - dt);
    if (this.rolling) {
      this.rollTimer = Math.max(0, this.rollTimer - dt);
      if (this.rollTimer === 0) {
        this.rolling = false;
        this.invulnerable = false;
      }
    }
  }

  takeDamage(n) {
    if (!this.alive || this.invulnerable) return false;
    this.health = Math.max(0, this.health - n);
    this.anim.hit();
    if (this.health <= 0) { this.alive = false; this.anim.death(); }
    return true;
  }
}
