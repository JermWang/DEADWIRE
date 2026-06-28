import * as THREE from 'three';
import { mat, PALETTE } from '../assets.js';

function cloneMaterial(material, opacity) {
  const next = material.clone();
  next.transparent = true;
  next.opacity = opacity;
  next.depthWrite = false;
  return next;
}

export class InsertionPod {
  constructor(position, { index = 0, occupied = false } = {}) {
    this.index = index;
    this.occupied = occupied;
    this.ground = position.clone();
    this.root = new THREE.Group();
    this.root.name = `insertion_pod_${index}`;
    this.root.position.set(position.x, 18, position.z);
    this.root.lookAt(0, 0.8, 0);

    const hull = mat('#27323a', { metal: 0.62, rough: 0.46 });
    const hullDark = mat('#11171b', { metal: 0.7, rough: 0.42 });
    const rust = mat(PALETTE.rust, { metal: 0.42, rough: 0.55 });
    const glass = cloneMaterial(mat('#63d2ff', {
      emissive: '#63d2ff',
      emissiveIntensity: occupied ? 1.8 : 0.85,
      rough: 0.2,
    }), occupied ? 0.52 : 0.28);
    const hot = mat('#dff7ff', { emissive: '#8edcff', emissiveIntensity: 3.2, rough: 0.18 });
    const flameA = cloneMaterial(mat('#ffffff', { emissive: '#bdf4ff', emissiveIntensity: 4, flat: false }), 0.78);
    const flameB = cloneMaterial(mat('#58bfff', { emissive: '#58bfff', emissiveIntensity: 3.1, flat: false }), 0.42);

    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.98, 1.95, 10), hull);
    body.position.y = 1.3;
    body.castShadow = true;
    body.receiveShadow = true;
    this.root.add(body);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.56, 0.82, 0.52, 10), hullDark);
    cap.position.y = 2.55;
    cap.castShadow = true;
    this.root.add(cap);

    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.78, 0.42, 10), hullDark);
    skirt.position.y = 0.26;
    skirt.castShadow = true;
    this.root.add(skirt);

    this.hatch = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.86, 0.08), glass);
    this.hatch.position.set(0, 1.42, -0.82);
    this.root.add(this.hatch);

    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.09, 1.9, 0.12), i % 2 ? rust : hullDark);
      rail.position.set(Math.sin(a) * 0.86, 1.32, Math.cos(a) * 0.86);
      rail.rotation.y = a;
      rail.castShadow = true;
      this.root.add(rail);
    }

    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      const fin = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.68, 0.48), rust);
      fin.position.set(Math.sin(a) * 0.78, 0.54, Math.cos(a) * 0.78);
      fin.rotation.y = a;
      fin.rotation.z = Math.sin(a) * 0.18;
      fin.castShadow = true;
      this.root.add(fin);
    }

    this.nozzles = [];
    this.flames = [];
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
      const x = Math.sin(a) * 0.42;
      const z = Math.cos(a) * 0.42;
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.19, 0.24, 8), hullDark);
      nozzle.position.set(x, 0.02, z);
      nozzle.castShadow = true;
      this.root.add(nozzle);
      this.nozzles.push(nozzle);

      const inner = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1.2, 8), flameA);
      inner.rotation.x = Math.PI;
      inner.position.set(x, -0.68, z);
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.31, 1.55, 8), flameB);
      outer.rotation.x = Math.PI;
      outer.position.set(x, -0.82, z);
      this.root.add(outer, inner);
      this.flames.push(inner, outer);
    }

    this.light = new THREE.PointLight(0x75ccff, occupied ? 5.5 : 3.2, 9, 2);
    this.light.position.y = -0.4;
    this.root.add(this.light);

    this.dust = new THREE.Mesh(
      new THREE.RingGeometry(0.7, 2.9, 26),
      cloneMaterial(mat('#b7a57b', { emissive: '#806942', emissiveIntensity: 0.18, flat: false }), 0),
    );
    this.dust.rotation.x = -Math.PI / 2;
    this.dust.position.y = 0.025;
    this.root.add(this.dust);
  }

  update(dt, time, state) {
    const descent = Math.min(1, Math.max(0, state.descentProgress || 0));
    const launch = Math.min(1, Math.max(0, state.launchProgress || 0));
    const hover = Math.sin(time * 4.1 + this.index) * 0.06;
    const landedY = 0.12 + hover * (launch > 0 ? 0 : 1);
    this.root.position.y = THREE.MathUtils.lerp(18, landedY, descent) + launch * launch * 18;
    this.root.rotation.z = Math.sin(time * 1.3 + this.index) * 0.012 * (1 - launch);

    const thrust = state.thrust ?? (descent < 1 || launch > 0 ? 1 : 0.28);
    this.flames.forEach((flame, i) => {
      const flicker = 0.72 + Math.sin(time * (12 + i) + i) * 0.16 + Math.random() * 0.08;
      flame.visible = thrust > 0.08;
      flame.scale.setScalar(Math.max(0.05, thrust * flicker));
      flame.material.opacity = Math.min(0.86, thrust * (i % 2 ? 0.48 : 0.76));
    });
    this.light.intensity = 1.4 + thrust * 5.2 + Math.sin(time * 14) * 0.35;

    const dustPulse = Math.max(0, 1 - Math.abs(descent - 0.92) / 0.16) + Math.max(0, 1 - launch * 1.4) * 0.34;
    this.dust.scale.setScalar(1 + dustPulse * 1.7 + launch * 1.2);
    this.dust.material.opacity = Math.min(0.48, dustPulse * 0.42);
    this.hatch.rotation.x = -Math.max(0, descent - 0.9) * 5.8;
  }
}
