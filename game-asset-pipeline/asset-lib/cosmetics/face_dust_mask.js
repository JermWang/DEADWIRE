// face_dust_mask - common face-slot starter mask for new runners.
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cyl, group } from '../prim.js?v=wii-voxel-toy-v3';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { shell: P.steelDark, filter: P.steel, glow: P.accentCyan, ...colors };
  const shell = mat(C.shell, { metal: 0.18, rough: 0.72 });
  const filter = mat(C.filter, { metal: 0.45, rough: 0.42 });
  const glow = mat(C.glow, { emissive: C.glow, emissiveIntensity: 0.8 });
  const g = group('face_dust_mask');
  g.add(box(0.26, 0.12, 0.08, shell, 0, -0.04, 0.03));
  g.add(box(0.2, 0.04, 0.035, glow, 0, 0.035, 0.075));
  const left = cyl(0.035, 0.045, 0.07, 6, filter, -0.1, -0.075, 0.065);
  left.rotation.x = Math.PI / 2;
  g.add(left);
  const right = cyl(0.035, 0.045, 0.07, 6, filter, 0.1, -0.075, 0.065);
  right.rotation.x = Math.PI / 2;
  g.add(right);
  return g;
}

export const meta = {
  id: 'face_dust_mask',
  displayName: 'Dust Mask',
  category: 'cosmetic',
  slot: 'face',
  rarity: 'common',
  budgets: { maxTriangles: 160, maxMaterials: 4 },
};
