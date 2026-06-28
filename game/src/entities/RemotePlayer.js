// RemotePlayer — another runner in the match. Renders the shared char_runner,
// a floating nameplate, and a carried reactor cube. Position/facing are interpolated toward
// the latest server snapshot so movement stays smooth between updates.
import * as THREE from 'three';
import { buildAsset, mountWeaponToSocket } from '../assets.js';
import { PlayerAnimator } from './PlayerAnimator.js';
import { disposeObjectTree } from '../render/dispose.js';

function nameplate(text) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
  const ctx = cv.getContext('2d');
  ctx.font = 'bold 30px sans-serif'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(0, 0, 256, 64);
  ctx.fillStyle = '#f4f7ef'; ctx.fillText(text, 128, 42);
  const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthTest: false }));
  spr.scale.set(1.6, 0.4, 1); spr.position.y = 2.5;
  return spr;
}

export class RemotePlayer {
  constructor(id, name = 'Runner') {
    this.id = id;
    this.name = name;
    this.mesh = buildAsset('char_runner', { pose: 'aim', colors: { jacket: '#5a3b4a' } }); // tinted to read as "other"
    const grip = this.mesh.getObjectByName(this.mesh.userData.weaponSocketName || 'hand_r') || this.mesh;
    this.grip = grip;
    this.weapon = buildAsset('weapon_scrap_pistol');
    mountWeaponToSocket(this.weapon, grip);
    this.mesh.add(nameplate(name));

    this.carryOrb = buildAsset('obj_unstable_core', { variant: 'carry' });
    this.carryOrb.scale.setScalar(0.46);
    this.carryOrb.rotation.set(0.2, 0.25, -0.1);
    this.carryOrb.position.set(0, 0, 0.1);
    this.carryOrb.visible = false;
    (this.mesh.getObjectByName('hand_l') || this.mesh.getObjectByName('backpack') || this.mesh).add(this.carryOrb);

    this.target = new THREE.Vector3();
    this.targetFacing = 0;
    this.hp = 100;
    this.carrying = false;
    this.radius = 0.34;
    this._carryTime = 0;
    this.anim = new PlayerAnimator(this);
  }

  get position() { return this.mesh.position; }

  setState(s) {
    this.target.set(s.x, 0, s.z);
    this.targetFacing = s.facing;
    this.hp = s.hp;
    this.carrying = s.carrying;
  }

  update(dt) {
    const moving = this.mesh.position.distanceToSquared(this.target) > 0.0025;
    this.mesh.position.lerp(this.target, Math.min(1, dt * 12));
    // shortest-arc facing lerp
    let d = this.targetFacing - this.mesh.rotation.y;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    this.mesh.rotation.y += d * Math.min(1, dt * 12);
    this.carryOrb.visible = this.carrying;
    if (this.carrying) {
      this._carryTime += dt;
      this.carryOrb.userData.updateIdle?.(this._carryTime, 1.12);
    }
    this.anim.update(dt, {
      alive: this.hp > 0, moving, running: false, speedRatio: 1,
      grounded: true, verticalVelocity: 0, rolling: false, aiming: false,
    });
  }

  dispose(scene) {
    scene.remove(this.mesh);
    disposeObjectTree(this.mesh);
  }
}
