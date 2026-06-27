// aura_corewake - advanced aura-slot cosmetic. Ground glow for core runners.
import * as THREE from 'three';
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, group } from '../prim.js?v=wii-voxel-toy-v3';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { ring: P.coreGlow, shard: P.coreHot, dark: P.steelDark, ...colors };
  const ringMat = mat(C.ring, { emissive: C.ring, emissiveIntensity: 1.35, transparent: true, opacity: 0.78 });
  const shardMat = mat(C.shard, { emissive: C.shard, emissiveIntensity: 1.0 });
  const dark = mat(C.dark, { metal: 0.2, rough: 0.6 });
  const g = group('aura_corewake');
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.58, 0.018, 5, 30), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.025;
  ring.castShadow = false;
  g.add(ring);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2;
    const shard = box(0.055, 0.14, 0.05, i % 2 ? shardMat : dark, Math.cos(angle) * 0.42, 0.08, Math.sin(angle) * 0.42);
    shard.rotation.y = -angle;
    shard.rotation.z = (i % 2 ? 0.22 : -0.14);
    g.add(shard);
  }
  return g;
}

export const meta = {
  id: 'aura_corewake',
  displayName: 'Core Wake',
  category: 'cosmetic',
  slot: 'aura',
  rarity: 'rare',
  budgets: { maxTriangles: 420, maxMaterials: 4 },
};
