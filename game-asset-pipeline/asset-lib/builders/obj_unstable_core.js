// obj_unstable_core — Deadwire's apex extraction resource.
// A dense, hand-carriable reactor cube: black armored edge cage, overexposed
// violet heart, luminous corner locks, and small energy fragments.
import * as THREE from 'three';
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cyl, group, socket } from '../prim.js?v=wii-voxel-toy-v3';

export function build(opts = {}) {
  const { colors = {}, tier = null, variant = 'world' } = opts;
  const C = {
    core: tier?.hot || '#fff5ff',
    energy: tier?.color || '#8545ff',
    cage: '#171827',
    edge: '#35304c',
    base: P.steelDark,
    ...colors,
  };
  const hot = mat(C.core, { emissive: C.core, emissiveIntensity: 4.8, rough: 0.18 });
  const energy = mat(C.energy, { emissive: C.energy, emissiveIntensity: 2.35, rough: 0.25 });
  const aura = mat(C.energy, {
    emissive: C.energy, emissiveIntensity: 1.35, transparent: true, opacity: 0.2, rough: 0.3,
  });
  const cage = mat(C.cage, { metal: 0.62, rough: 0.34 });
  const edge = mat(C.edge, { metal: 0.52, rough: 0.38 });
  const base = mat(C.base, { metal: 0.58, rough: 0.46 });

  const g = group('obj_unstable_core');
  const assembly = group('core_assembly');
  assembly.position.y = variant === 'carry' ? 0 : 0.54;
  g.add(assembly);

  // White-violet heart and a faint larger energy volume.
  const inner = box(0.34, 0.34, 0.34, hot);
  inner.name = 'reactor_heart';
  assembly.add(inner);
  const energyVolume = box(0.43, 0.43, 0.43, aura);
  energyVolume.name = 'energy_volume';
  energyVolume.rotation.set(0.14, 0.22, 0.08);
  assembly.add(energyVolume);

  // Twelve armored edge rails create the unmistakable caged-cube silhouette.
  const railLength = 0.58;
  const railOffset = 0.3;
  for (const y of [-railOffset, railOffset]) {
    for (const z of [-railOffset, railOffset]) assembly.add(box(railLength, 0.07, 0.07, cage, 0, y, z));
  }
  for (const x of [-railOffset, railOffset]) {
    for (const z of [-railOffset, railOffset]) assembly.add(box(0.07, railLength, 0.07, cage, x, 0, z));
  }
  for (const x of [-railOffset, railOffset]) {
    for (const y of [-railOffset, railOffset]) assembly.add(box(0.07, 0.07, railLength, cage, x, y, 0));
  }

  // Eight bright corner locks, backed by chunky dark mounting blocks.
  const glowParts = [inner, energyVolume];
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        assembly.add(box(0.16, 0.16, 0.16, edge, x * 0.3, y * 0.3, z * 0.3));
        const lock = box(0.09, 0.09, 0.09, energy, x * 0.345, y * 0.345, z * 0.345);
        lock.name = 'corner_lock';
        assembly.add(lock);
        glowParts.push(lock);
      }
    }
  }

  // Thin luminous brackets on every face read clearly from any camera angle.
  const addFaceFrame = (axis, sign) => {
    const p = sign * 0.352;
    if (axis === 'z') {
      assembly.add(box(0.4, 0.045, 0.035, energy, 0, 0.235, p));
      assembly.add(box(0.4, 0.045, 0.035, energy, 0, -0.235, p));
      assembly.add(box(0.045, 0.4, 0.035, energy, 0.235, 0, p));
      assembly.add(box(0.045, 0.4, 0.035, energy, -0.235, 0, p));
    } else if (axis === 'x') {
      assembly.add(box(0.035, 0.045, 0.4, energy, p, 0.235, 0));
      assembly.add(box(0.035, 0.045, 0.4, energy, p, -0.235, 0));
      assembly.add(box(0.035, 0.4, 0.045, energy, p, 0, 0.235));
      assembly.add(box(0.035, 0.4, 0.045, energy, p, 0, -0.235));
    } else {
      assembly.add(box(0.4, 0.035, 0.045, energy, 0, p, 0.235));
      assembly.add(box(0.4, 0.035, 0.045, energy, 0, p, -0.235));
      assembly.add(box(0.045, 0.035, 0.4, energy, 0.235, p, 0));
      assembly.add(box(0.045, 0.035, 0.4, energy, -0.235, p, 0));
    }
  };
  for (const axis of ['x', 'y', 'z']) for (const sign of [-1, 1]) addFaceFrame(axis, sign);

  // A few orbiting voxel fragments sell instability without hiding the cube.
  const shards = group('energy_shards');
  const shardPositions = [
    [0.58, 0.2, 0.1], [-0.52, -0.12, 0.2], [0.14, 0.54, -0.34],
    [-0.25, 0.33, 0.55], [0.38, -0.44, -0.28], [-0.57, 0.42, -0.22],
  ];
  shardPositions.forEach(([x, y, z], index) => {
    const shard = box(index % 2 ? 0.055 : 0.08, 0.035, 0.035, energy, x, y, z);
    shard.rotation.set(index * 0.3, index * 0.55, index * 0.2);
    shards.add(shard);
    glowParts.push(shard);
  });
  assembly.add(shards);

  if (variant !== 'carry') {
    // Compact magnetic cradle; the valuable object remains visually separable.
    g.add(cyl(0.34, 0.42, 0.12, 8, base, 0, 0.06, 0));
    g.add(cyl(0.2, 0.28, 0.08, 8, edge, 0, 0.15, 0));
    for (const a of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
      const support = box(0.07, 0.28, 0.07, cage, Math.cos(a) * 0.27, 0.28, Math.sin(a) * 0.27);
      support.rotation.z = Math.cos(a) * 0.18;
      support.rotation.x = Math.sin(a) * 0.18;
      g.add(support);
    }
  }

  const light = new THREE.PointLight(C.energy, variant === 'carry' ? 1.8 : 3.2, 4.2, 2);
  light.position.y = variant === 'carry' ? 0 : 0.54;
  g.add(light);

  g.add(socket('carry', 0, variant === 'carry' ? 0 : 0.54, 0));
  g.userData.glow = inner;
  g.userData.glowParts = glowParts;
  g.userData.coreAssembly = assembly;
  g.userData.energyVolume = energyVolume;
  g.userData.shards = shards;
  g.userData.radius = 0.48;
  g.userData.interactRange = 1.7;
  g.userData.rarity = tier?.rarity || 'apex';
  g.userData.tier = tier?.id || 'purple';
  return g;
}

export const meta = {
  id: 'obj_unstable_core',
  displayName: 'Reactor Core',
  category: 'objective',
  rarity: 'apex',
  budgets: { maxTriangles: 1100, maxMaterials: 6 },
};
