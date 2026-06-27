// ExtractionZone — open from match start. Stand inside and hold to extract.
import * as THREE from 'three';
import { mat, PALETTE } from '../assets.js';

export class ExtractionZone {
  constructor(position, radius = 2.2) {
    this.position = position.clone();
    this.radius = radius;
    this.group = new THREE.Group();
    this.group.position.copy(position);

    // glowing ring pad on the ground
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(radius - 0.25, radius, 24),
      mat(PALETTE.toxic, { emissive: PALETTE.toxic, emissiveIntensity: 1.2, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.02;
    this.group.add(ring);

    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(radius - 0.25, 24),
      mat(PALETTE.toxic, { emissive: PALETTE.toxic, emissiveIntensity: 0.25, transparent: true, opacity: 0.18 })
    );
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.015;
    this.group.add(disc);

    // corner beacons
    for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.06, 1.0, 5),
        mat(PALETTE.toxic, { emissive: PALETTE.toxic, emissiveIntensity: 1.4 })
      );
      beacon.position.set(Math.cos(a) * radius, 0.5, Math.sin(a) * radius);
      this.group.add(beacon);
    }
    this.ring = ring;
    this._t = 0;
  }

  contains(pos) {
    const dx = pos.x - this.position.x, dz = pos.z - this.position.z;
    return dx * dx + dz * dz <= this.radius * this.radius;
  }

  update(dt) {
    this._t += dt;
    this.ring.material.emissiveIntensity = 1.0 + Math.sin(this._t * 3) * 0.4;
  }
}
