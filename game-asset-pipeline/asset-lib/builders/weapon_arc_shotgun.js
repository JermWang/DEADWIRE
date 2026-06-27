// weapon_arc_shotgun — close-range pellet burst. Stubby, wide, twin barrels.
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cylZ, group, socket } from '../prim.js?v=wii-voxel-toy-v3';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { body: P.steelDark, grip: P.rustDark, accent: P.warningAmber, ...colors };
  const body = mat(C.body, { metal: 0.4, rough: 0.5 });
  const grip = mat(C.grip);
  const accent = mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.8 });

  const g = group('weapon_arc_shotgun');
  g.add(box(0.11, 0.13, 0.24, body, 0, 0, 0.06)); // chunky receiver
  g.add(box(0.13, 0.06, 0.16, body, 0, -0.035, 0.18)); // pump block
  for (const sx of [-1, 1]) {
    g.add(cylZ(0.025, 0.025, 0.3, 6, body, 0.035 * sx, 0.02, 0.24)); // twin barrels
    g.add(box(0.028, 0.03, 0.04, accent, 0.035 * sx, 0.045, 0.34)); // charged muzzle tips
  }
  g.add(box(0.07, 0.15, 0.08, grip, 0, -0.12, -0.04)); // grip
  g.add(box(0.08, 0.08, 0.12, grip, 0, -0.05, -0.16)); // stub stock
  g.add(box(0.12, 0.05, 0.06, accent, 0, 0.05, 0.0)); // arc coil glow
  g.add(box(0.09, 0.03, 0.03, accent, 0, 0.02, 0.34)); // muzzle glow
  g.add(socket('muzzle', 0, 0.02, 0.36));
  g.userData.muzzleSocket = 'muzzle';
  g.userData.handMount = {
    gripPoint: [0, -0.12, -0.04],
    quaternion: [0.767974, -0.014882, 0.198055, 0.608907],
  };
  return g;
}

export const meta = {
  id: 'weapon_arc_shotgun', displayName: 'Arc Shotgun', category: 'weapon', slot: 'weapon',
  budgets: { maxTriangles: 260, maxMaterials: 4 },
};
