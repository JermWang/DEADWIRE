// obj_unstable_core — Deadwire's extraction prize.
// A chunky armored reactor cube: bright panel windows, industrial slab cage,
// tier-colored aura, and tiny orbiting voxel fragments.
import * as THREE from 'three';
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cyl, group, socket } from '../prim.js?v=wii-voxel-toy-v3';

const CORE_TIER_LOOKS = {
  blue: {
    id: 'blue',
    rarity: 'basic',
    color: '#26aefc',
    hot: '#72d7ff',
    bloom: 0.72,
  },
  yellow: {
    id: 'yellow',
    rarity: 'regular',
    color: '#ffb323',
    hot: '#ffc84f',
    bloom: 0.82,
  },
  purple: {
    id: 'purple',
    rarity: 'apex',
    color: '#9d42ff',
    hot: '#bd73ff',
    bloom: 0.92,
  },
};

function resolveTier(tier) {
  if (typeof tier === 'string') return CORE_TIER_LOOKS[tier] || CORE_TIER_LOOKS.yellow;
  if (tier?.id) {
    const look = CORE_TIER_LOOKS[tier.id] || CORE_TIER_LOOKS.yellow;
    return { ...tier, ...look, rarity: tier.rarity || look.rarity };
  }
  return CORE_TIER_LOOKS.purple;
}

function markMaterial(material, baseIntensity) {
  material.userData.coreBaseIntensity = baseIntensity;
  return material;
}

function setBaseTransform(mesh) {
  mesh.userData.basePosition = mesh.position.clone();
  mesh.userData.baseRotation = mesh.rotation.clone();
  mesh.userData.baseScale = mesh.scale.clone();
  return mesh;
}

export function build(opts = {}) {
  const { colors = {}, tier = null, variant = 'world' } = opts;
  const tierLook = resolveTier(tier);
  const bloom = tierLook.bloom || 1;
  const C = {
    core: tierLook.hot,
    energy: tierLook.color,
    cage: '#11131d',
    edge: '#2e3140',
    scuffed: '#4a4c52',
    base: P.steelDark,
    ...colors,
  };

  const hotHeart = markMaterial(mat(C.core, { emissive: C.core, emissiveIntensity: 3.8 * bloom, rough: 0.12 }), 3.8 * bloom);
  const hotPanel = markMaterial(mat(C.core, { emissive: C.core, emissiveIntensity: 3.05 * bloom, rough: 0.18 }), 3.05 * bloom);
  const energy = markMaterial(mat(C.energy, { emissive: C.energy, emissiveIntensity: 2.85 * bloom, rough: 0.24 }), 2.85 * bloom);
  const aura = markMaterial(mat(C.energy, {
    emissive: C.energy,
    emissiveIntensity: 1.65 * bloom,
    transparent: true,
    opacity: variant === 'carry' ? 0.18 : 0.22,
    rough: 0.32,
  }), 1.65 * bloom);
  const cage = mat(C.cage, { metal: 0.68, rough: 0.34 });
  const edge = mat(C.edge, { metal: 0.56, rough: 0.38 });
  const scuffed = mat(C.scuffed, { metal: 0.5, rough: 0.54 });
  const base = mat(C.base, { metal: 0.58, rough: 0.46 });

  const g = group('obj_unstable_core');
  const assembly = group('core_assembly');
  const assemblyBaseY = variant === 'carry' ? 0 : 0.54;
  assembly.position.y = assemblyBaseY;
  g.add(assembly);

  const glowParts = [];
  const auraParts = [];
  const addGlow = (mesh, auraMesh = false) => {
    glowParts.push(mesh);
    if (auraMesh) auraParts.push(mesh);
    return setBaseTransform(mesh);
  };

  // Saturated inner heart, visible through the side windows and top opening.
  const inner = addGlow(box(0.5, 0.5, 0.5, hotHeart));
  inner.name = 'reactor_heart';
  assembly.add(inner);

  const energyVolume = addGlow(box(0.72, 0.72, 0.72, aura), true);
  energyVolume.name = 'energy_volume';
  energyVolume.rotation.set(0.14, 0.22, 0.08);
  assembly.add(energyVolume);

  // Twelve thick rails set the iconic caged-cube silhouette.
  const railLength = 0.86;
  const railOffset = 0.42;
  for (const y of [-railOffset, railOffset]) {
    for (const z of [-railOffset, railOffset]) assembly.add(box(railLength, 0.085, 0.085, cage, 0, y, z));
  }
  for (const x of [-railOffset, railOffset]) {
    for (const z of [-railOffset, railOffset]) assembly.add(box(0.085, railLength, 0.085, cage, x, 0, z));
  }
  for (const x of [-railOffset, railOffset]) {
    for (const y of [-railOffset, railOffset]) assembly.add(box(0.085, 0.085, railLength, cage, x, y, 0));
  }

  // Heavy corner armor blocks, with smaller brighter locks tucked just outside.
  for (const x of [-1, 1]) {
    for (const y of [-1, 1]) {
      for (const z of [-1, 1]) {
        assembly.add(box(0.2, 0.2, 0.2, edge, x * 0.43, y * 0.43, z * 0.43));
        const lock = addGlow(box(0.075, 0.075, 0.075, energy, x * 0.51, y * 0.51, z * 0.51));
        lock.name = 'corner_lock';
        assembly.add(lock);
      }
    }
  }

  const addSideFace = (axis, sign) => {
    const p = sign * 0.465;
    if (axis === 'z') {
      const window = addGlow(box(0.48, 0.42, 0.035, hotPanel, 0, 0, p));
      window.name = 'reactor_window';
      assembly.add(window);
      assembly.add(box(0.72, 0.08, 0.105, scuffed, 0, 0.32, p + sign * 0.012));
      assembly.add(box(0.72, 0.08, 0.105, cage, 0, -0.32, p + sign * 0.012));
      assembly.add(box(0.085, 0.56, 0.105, cage, 0.32, 0, p + sign * 0.012));
      assembly.add(box(0.085, 0.56, 0.105, edge, -0.32, 0, p + sign * 0.012));
      assembly.add(addGlow(box(0.07, 0.56, 0.045, energy, 0.235, 0, p + sign * 0.026)));
      assembly.add(addGlow(box(0.07, 0.56, 0.045, energy, -0.235, 0, p + sign * 0.026)));
      assembly.add(addGlow(box(0.5, 0.055, 0.045, energy, 0, 0.255, p + sign * 0.028)));
      assembly.add(addGlow(box(0.5, 0.055, 0.045, energy, 0, -0.255, p + sign * 0.028)));
    } else {
      const window = addGlow(box(0.035, 0.42, 0.48, hotPanel, p, 0, 0));
      window.name = 'reactor_window';
      assembly.add(window);
      assembly.add(box(0.105, 0.08, 0.72, scuffed, p + sign * 0.012, 0.32, 0));
      assembly.add(box(0.105, 0.08, 0.72, cage, p + sign * 0.012, -0.32, 0));
      assembly.add(box(0.105, 0.56, 0.085, cage, p + sign * 0.012, 0, 0.32));
      assembly.add(box(0.105, 0.56, 0.085, edge, p + sign * 0.012, 0, -0.32));
      assembly.add(addGlow(box(0.045, 0.56, 0.07, energy, p + sign * 0.026, 0, 0.235)));
      assembly.add(addGlow(box(0.045, 0.56, 0.07, energy, p + sign * 0.026, 0, -0.235)));
      assembly.add(addGlow(box(0.045, 0.055, 0.5, energy, p + sign * 0.028, 0.255, 0)));
      assembly.add(addGlow(box(0.045, 0.055, 0.5, energy, p + sign * 0.028, -0.255, 0)));
    }
  };
  for (const axis of ['x', 'z']) for (const sign of [-1, 1]) addSideFace(axis, sign);

  const addCap = (sign) => {
    const y = sign * 0.465;
    const window = addGlow(box(0.54, 0.035, 0.54, hotPanel, 0, y, 0));
    window.name = sign > 0 ? 'reactor_top_window' : 'reactor_bottom_window';
    assembly.add(window);
    assembly.add(box(0.72, 0.095, 0.16, scuffed, 0, y + sign * 0.02, 0.34));
    assembly.add(box(0.72, 0.095, 0.16, cage, 0, y + sign * 0.02, -0.34));
    assembly.add(box(0.16, 0.095, 0.72, cage, 0.34, y + sign * 0.02, 0));
    assembly.add(box(0.16, 0.095, 0.72, edge, -0.34, y + sign * 0.02, 0));
    assembly.add(addGlow(box(0.84, 0.04, 0.055, energy, 0, y + sign * 0.052, 0.225)));
    assembly.add(addGlow(box(0.84, 0.04, 0.055, energy, 0, y + sign * 0.052, -0.225)));
    assembly.add(addGlow(box(0.055, 0.04, 0.84, energy, 0.225, y + sign * 0.052, 0)));
    assembly.add(addGlow(box(0.055, 0.04, 0.84, energy, -0.225, y + sign * 0.052, 0)));
  };
  addCap(1);
  addCap(-1);

  // Voxel motes around the cube, kept sparse so the silhouette stays readable.
  const shards = group('energy_shards');
  const shardPositions = [
    [0.72, 0.28, 0.08], [-0.66, -0.16, 0.24], [0.14, 0.75, -0.42],
    [-0.3, 0.42, 0.72], [0.48, -0.58, -0.34], [-0.72, 0.56, -0.28],
    [0.24, 0.9, 0.34], [0.82, -0.06, -0.5], [-0.56, -0.74, 0.12],
  ];
  shardPositions.forEach(([x, y, z], index) => {
    const size = index % 3 === 0 ? 0.07 : index % 3 === 1 ? 0.052 : 0.038;
    const shard = addGlow(box(size, size, size, index % 2 ? energy : aura, x, y, z), index % 2 === 0);
    shard.name = 'reactor_mote';
    shard.rotation.set(index * 0.31, index * 0.57, index * 0.23);
    shard.userData.floatPhase = index * 0.73;
    shards.add(shard);
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

  const light = new THREE.PointLight(C.energy, (variant === 'carry' ? 1.55 : 2.8) * bloom, 4.1, 2);
  light.position.y = assemblyBaseY;
  light.userData.baseIntensity = light.intensity;
  g.add(light);

  g.add(socket('carry', 0, assemblyBaseY, 0));

  const glowMaterials = [...new Set(glowParts.map((part) => part.material).filter(Boolean))];
  g.userData.updateIdle = (time = 0, strength = 1) => {
    const pulse = Math.sin(time * 2.45) * 0.5 + 0.5;
    const slow = Math.sin(time * 0.9) * 0.5 + 0.5;
    const spark = Math.sin(time * 7.5) > 0.86 ? 0.24 : 0;

    glowMaterials.forEach((material) => {
      const baseIntensity = material.userData.coreBaseIntensity ?? material.emissiveIntensity ?? 1;
      material.emissiveIntensity = baseIntensity + (pulse * 0.28 + spark) * strength * bloom;
    });

    assembly.rotation.y = time * (variant === 'carry' ? 0.82 : 0.36);
    assembly.rotation.x = Math.sin(time * 0.42) * 0.045;
    assembly.position.y = assemblyBaseY + Math.sin(time * 1.35) * (variant === 'carry' ? 0.022 : 0.04);

    energyVolume.rotation.x = 0.14 + time * 0.26;
    energyVolume.rotation.y = 0.22 + time * 0.18;
    energyVolume.rotation.z = 0.08 - time * 0.2;
    energyVolume.scale.setScalar(1 + (pulse * 0.05 + slow * 0.025) * strength);

    auraParts.forEach((part, index) => {
      const baseScale = part.userData.baseScale;
      if (!baseScale) return;
      const auraPulse = 1 + (Math.sin(time * 1.65 + index) * 0.035 + 0.07) * strength;
      part.scale.set(baseScale.x * auraPulse, baseScale.y * auraPulse, baseScale.z * auraPulse);
    });

    shards.rotation.y = -time * 0.72;
    shards.rotation.x = Math.sin(time * 0.55) * 0.16;
    shards.children.forEach((shard, index) => {
      const basePosition = shard.userData.basePosition;
      const baseRotation = shard.userData.baseRotation;
      if (!basePosition || !baseRotation) return;
      const phase = shard.userData.floatPhase || index;
      shard.position.set(
        basePosition.x + Math.sin(time * 1.3 + phase) * 0.026 * strength,
        basePosition.y + Math.sin(time * 1.7 + phase) * 0.04 * strength,
        basePosition.z + Math.cos(time * 1.15 + phase) * 0.026 * strength,
      );
      shard.rotation.set(
        baseRotation.x + time * (0.45 + index * 0.025),
        baseRotation.y + time * (0.34 + index * 0.02),
        baseRotation.z + time * (0.28 + index * 0.018),
      );
    });

    light.intensity = light.userData.baseIntensity + (pulse * 0.5 + spark * 0.35) * strength;
  };
  g.userData.idle = g.userData.updateIdle;
  g.userData.glow = inner;
  g.userData.glowParts = glowParts;
  g.userData.auraParts = auraParts;
  g.userData.coreAssembly = assembly;
  g.userData.energyVolume = energyVolume;
  g.userData.shards = shards;
  g.userData.radius = 0.56;
  g.userData.interactRange = 1.7;
  g.userData.rarity = tierLook.rarity;
  g.userData.tier = tierLook.id;
  g.userData.updateIdle(0, 1);
  return g;
}

export const meta = {
  id: 'obj_unstable_core',
  displayName: 'Reactor Core',
  category: 'objective',
  rarity: 'apex',
  budgets: { maxTriangles: 1500, maxMaterials: 8 },
};
