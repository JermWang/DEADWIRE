// UnstableCore — the match objective. Picked up by a player, dropped on death,
// extracted for the best reward. Pulses + pings while carried.
import * as THREE from 'three';
import { buildAsset } from '../assets.js';
import { CONFIG } from '../data/config.js';
import { getCoreTier } from '../data/economy.js';

export class UnstableCore {
  constructor(position, tierId = 'yellow') {
    this.tier = getCoreTier(tierId);
    this.mesh = buildAsset('obj_unstable_core', { tier: this.tier });
    this.mesh.position.copy(position);
    this.spawnPos = position.clone();
    this.carrier = null;        // Player or null
    this.spawned = false;       // becomes true at coreSpawnSec
    this.interactRange = this.mesh.userData.interactRange || CONFIG.player.interactRange;
    this.mesh.visible = false;
    this._t = 0;
  }

  get position() { return this.mesh.position; }

  setTier(tierId) {
    const visible = this.mesh.visible;
    const position = this.mesh.position.clone();
    const spawned = this.spawned;
    const carrier = this.carrier;
    this.tier = getCoreTier(tierId);
    this.mesh = buildAsset('obj_unstable_core', { tier: this.tier });
    this.mesh.position.copy(position);
    this.mesh.visible = visible;
    this.spawned = spawned;
    this.carrier = carrier;
    this.interactRange = this.mesh.userData.interactRange || CONFIG.player.interactRange;
  }

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
    this.mesh.userData.updateIdle?.(this._t, 1.08);
    if (!this.carrier) this.mesh.rotation.y += dt * 0.08;
  }
}
