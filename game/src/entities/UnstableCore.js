// UnstableCore — the match objective. Picked up by a player, dropped on death,
// extracted for the best reward. Pulses + pings while carried.
import * as THREE from 'three';
import { buildAsset } from '../assets.js';
import { CONFIG } from '../data/config.js';

export class UnstableCore {
  constructor(position) {
    this.mesh = buildAsset('obj_unstable_core');
    this.mesh.position.copy(position);
    this.spawnPos = position.clone();
    this.carrier = null;        // Player or null
    this.spawned = false;       // becomes true at coreSpawnSec
    this.interactRange = this.mesh.userData.interactRange || CONFIG.player.interactRange;
    this.mesh.visible = false;
    this._t = 0;
  }

  get position() { return this.mesh.position; }

  spawn() { this.spawned = true; this.mesh.visible = true; }

  pickUp(player) {
    this.carrier = player;
    player.carryingCore = true;
    this.mesh.visible = false; // visually represented by carrier glow
  }

  drop(atPos) {
    if (this.carrier) this.carrier.carryingCore = false;
    this.carrier = null;
    this.mesh.position.copy(atPos);
    this.mesh.position.y = 0;
    this.mesh.visible = true;
  }

  update(dt) {
    if (!this.spawned) return;
    this._t += dt;
    const glow = this.mesh.userData.glow;
    if (glow) glow.material.emissiveIntensity = 1.8 + Math.sin(this._t * 4) * 0.7;
    if (!this.carrier) this.mesh.rotation.y += dt * 0.8;
  }
}
