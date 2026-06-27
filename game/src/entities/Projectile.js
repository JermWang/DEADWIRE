// Projectile — visible tracer bolt. Player bolts are cyan, enemy bolts are red.
import * as THREE from 'three';
import { mat, PALETTE } from '../assets.js';

const GEO = new THREE.SphereGeometry(0.1, 6, 6);
const MAT_PLAYER = mat(PALETTE.accentCyan, { emissive: PALETTE.accentCyan, emissiveIntensity: 2 });
const MAT_ENEMY = mat(PALETTE.machineEye, { emissive: PALETTE.machineEye, emissiveIntensity: 2 });

export class Projectile {
  constructor(origin, dir, opts) {
    this.fromPlayer = opts.fromPlayer ?? true;
    this.ghost = opts.ghost ?? false; // remote players' tracers: visual only, no collision
    this.mesh = new THREE.Mesh(GEO, this.fromPlayer ? MAT_PLAYER : MAT_ENEMY);
    this.mesh.position.copy(origin);
    if (!this.fromPlayer) this.mesh.scale.setScalar(1.4);
    this.vel = dir.clone().setY(0).normalize().multiplyScalar(opts.speed);
    this.life = opts.life;
    this.damage = opts.damage;
    this.dead = false;
    this.radius = 0.2;
  }

  update(dt) {
    this.mesh.position.addScaledVector(this.vel, dt);
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
}
