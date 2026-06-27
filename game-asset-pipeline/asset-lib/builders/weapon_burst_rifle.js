// weapon_burst_rifle — mid-range controlled 3-round burst. Longer body + stock.
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cylZ, group, socket } from '../prim.js?v=wii-voxel-toy-v3';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { body: P.machineHullDark, grip: P.rustDark, accent: P.accentCyan, ...colors };
  const body = mat(C.body, { metal: 0.45, rough: 0.45 });
  const grip = mat(C.grip);
  const accent = mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.6 });

  const g = group('weapon_burst_rifle');
  g.add(box(0.07, 0.12, 0.42, body, 0, 0, 0.12));   // receiver
  g.add(box(0.09, 0.05, 0.22, body, 0, 0.065, 0.08)); // top rail
  g.add(cylZ(0.026, 0.026, 0.5, 6, body, 0, 0.03, 0.45)); // long barrel
  g.add(box(0.08, 0.04, 0.18, body, 0, -0.045, 0.28)); // foregrip shroud
  g.add(box(0.06, 0.15, 0.08, grip, 0, -0.12, -0.02)); // grip
  g.add(box(0.055, 0.18, 0.08, grip, 0, -0.15, 0.08)); // magazine
  g.add(box(0.05, 0.08, 0.18, body, 0, -0.04, -0.14)); // stock
  g.add(box(0.08, 0.13, 0.05, body, 0, -0.045, -0.25)); // butt pad
  g.add(box(0.05, 0.04, 0.12, accent, 0, 0.09, 0.16)); // sight rail glow
  g.add(box(0.04, 0.03, 0.04, accent, 0, 0.04, 0.58)); // muzzle glow
  g.add(socket('muzzle', 0, 0.03, 0.6));
  g.userData.muzzleSocket = 'muzzle';
  g.userData.handMount = {
    gripPoint: [0, -0.12, -0.02],
    quaternion: [0.767974, -0.014882, 0.198055, 0.608907],
  };
  return g;
}

export const meta = {
  id: 'weapon_burst_rifle', displayName: 'Burst Rifle', category: 'weapon', slot: 'weapon',
  budgets: { maxTriangles: 260, maxMaterials: 4 },
};
