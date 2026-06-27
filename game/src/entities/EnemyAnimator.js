// Lightweight enemy action player. Villains intentionally use small clip sets;
// the Runner gets the richer animation budget.
import { applyAnimation, clipsForRig } from '../../../game-asset-pipeline/asset-lib/animations.js?v=runner-actions-v2';

export class EnemyAnimator {
  constructor(mesh) {
    this.mesh = mesh;
    this.t = 0;
    this.action = null;
    this.actionT = 0;
    this.dead = false;
  }

  attack() { if (!this.dead) { this.action = 'attack'; this.actionT = 0; } }
  hit() { if (!this.dead) { this.action = 'hit'; this.actionT = 0; } }
  death() { this.dead = true; this.action = 'death'; this.actionT = 0; }

  update(dt, { moving = false, aimYaw = null } = {}) {
    this.t += dt;
    let clip = moving ? 'move' : 'idle';
    let sampleTime = this.t;
    if (this.action) {
      this.actionT += dt;
      clip = this.action;
      sampleTime = this.actionT;
      const def = clipsForRig(this.mesh.userData.rig?.type).find((item) => item.id === clip);
      if (!this.dead && def && this.actionT >= def.duration) {
        this.action = null;
        clip = moving ? 'move' : 'idle';
        sampleTime = this.t;
      }
    }
    applyAnimation(this.mesh, clip, sampleTime, { aimYaw });
  }
}
