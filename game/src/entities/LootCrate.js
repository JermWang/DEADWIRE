// LootCrate — interactable supply container. Rolls loot on open.
import * as THREE from 'three';
import { buildAsset } from '../assets.js';
import { CONFIG } from '../data/config.js';

export class LootCrate {
  constructor(position) {
    this.mesh = buildAsset('prop_loot_crate');
    this.mesh.position.copy(position);
    this.mesh.rotation.y = (position.x + position.z) % Math.PI;
    this.opened = false;
    this.interactRange = this.mesh.userData.interactRange || CONFIG.player.interactRange;
  }

  get position() { return this.mesh.position; }

  // weighted roll -> array of { item, qty }
  open() {
    if (this.opened) return [];
    this.opened = true;
    const table = CONFIG.loot.table;
    const total = table.reduce((s, e) => s + e.weight, 0);
    const rolls = 1 + Math.floor(Math.random() * 2); // 1-2 drops
    const out = [];
    for (let i = 0; i < rolls; i++) {
      let r = Math.random() * total;
      for (const e of table) {
        r -= e.weight;
        if (r <= 0) { out.push({ item: e.item, qty: e.min + Math.floor(Math.random() * (e.max - e.min + 1)) }); break; }
      }
    }
    // visual: drop the lid + dim the signal strip
    this.mesh.rotation.z = 0.05;
    this.mesh.traverse((n) => { if (n.isMesh && n.material.emissive) n.material.emissiveIntensity = 0.2; });
    return out;
  }
}
