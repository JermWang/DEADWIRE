// Full-body procedural Runner animator. Locomotion and action clips come from
// the shared asset library so studio previews match what actually ships.
import * as THREE from 'three';
import { applyAnimation, applyArmPose } from '../../../game-asset-pipeline/asset-lib/animations.js?v=runner-actions-v2';

const X = new THREE.Vector3(1, 0, 0);

export class PlayerAnimator {
  constructor(player) {
    this.mesh = player.mesh;
    this.arms = player.mesh.userData.arms || {};
    this.t = 0;
    this.locomotionT = 0;
    this.recoilT = 0;
    this.swapT = 0;
    this.hitT = 0;
    this.deathT = 0;
    this._off = new THREE.Quaternion();
  }

  recoil(strength = 1) { this.recoilT = Math.min(1.5, this.recoilT + strength); }
  swap() { this.swapT = 1; }
  hit() { this.hitT = 0.5; }
  death() { this.deathT = 0; }

  update(dt, state = {}) {
    if (typeof state === 'boolean') state = { moving: state, alive: true, grounded: true };
    this.t += dt;
    this.recoilT = Math.max(0, this.recoilT - dt * 6);
    this.swapT = Math.max(0, this.swapT - dt / 1.1);
    this.hitT = Math.max(0, this.hitT - dt);

    let clip = 'idle';
    let sampleTime = this.locomotionT;
    if (!state.alive) {
      this.deathT += dt;
      clip = 'death'; sampleTime = this.deathT;
    } else if (state.rolling) {
      clip = 'roll'; sampleTime = (state.rollProgress || 0) * 0.62;
    } else if (!state.grounded) {
      clip = 'jump';
      sampleTime = THREE.MathUtils.clamp(0.4 + (state.verticalVelocity || 0) * -0.055, 0.05, 0.78);
    } else if (this.swapT > 0) {
      clip = 'reload'; sampleTime = (1 - this.swapT) * 1.1;
    } else if (this.hitT > 0) {
      clip = 'hit'; sampleTime = (0.5 - this.hitT);
    } else if (state.moving) {
      clip = state.running ? 'run' : 'walk';
      this.locomotionT += dt * Math.max(0.45, state.speedRatio || 1);
      sampleTime = this.locomotionT;
    } else {
      this.locomotionT += dt;
      sampleTime = this.locomotionT;
    }

    applyAnimation(this.mesh, clip, sampleTime, { aiming: state.aiming, physical: true });

    // During live weapon locomotion the hands stay in a deliberate low-ready/ADS
    // base. Studio locomotion previews remain natural arm swings.
    const weaponReady = state.alive && state.grounded && !state.rolling && this.swapT === 0 && this.hitT === 0;
    if (weaponReady) {
      applyArmPose(this.mesh, state.aiming ? 'aim' : 'hip');
      const runBob = state.running ? Math.sin(this.t * 12) * 0.045 : 0;
      for (const side of ['r', 'l']) {
        const arm = this.arms[side];
        if (!arm) continue;
        arm.shoulder.rotation.x += state.aiming ? -0.07 : (side === 'r' ? 0.06 + runBob : 0.1 - runBob);
        arm.elbow.rotation.x -= state.aiming ? 0.08 : (side === 'r' ? 0.12 : 0.08);
      }
    }

    const kick = this.recoilT;
    const swapDip = Math.sin(Math.min(1, this.swapT) * Math.PI);
    const sway = Math.sin(this.t * 1.6);

    // Recoil moves the arm chain; the weapon stays rigidly parented to hand_r.
    const armKick = -kick * 0.22 - swapDip * 0.25;
    const elbowKick = -kick * 0.28 - swapDip * 0.35;
    for (const side of ['r', 'l']) {
      const arm = this.arms[side];
      if (!arm) continue;
      this._off.setFromAxisAngle(X, armKick + (side === 'l' ? sway * 0.012 : 0));
      arm.shoulder.quaternion.multiply(this._off);
      arm.elbow.rotation.x += elbowKick;
    }
  }
}
