// backpack_runner — backpack-slot cosmetic. Snaps onto the 'backpack' socket.
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cylX, group } from '../prim.js?v=wii-voxel-toy-v3';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { body: P.runnerPack, strap: P.steelDark, tag: P.toxic, ...colors };
  const body = mat(C.body, { rough: 0.95 });
  const strap = mat(C.strap);
  const tag = mat(C.tag, { emissive: C.tag, emissiveIntensity: 0.8 });
  const g = group('backpack_runner');
  g.add(box(0.4, 0.5, 0.22, body, 0, 0, -0.05)); // main bag
  g.add(box(0.34, 0.2, 0.18, body, 0, -0.28, -0.02)); // bottom pouch
  g.add(box(0.34, 0.08, 0.24, strap, 0, 0.28, -0.05)); // top flap
  g.add(box(0.08, 0.5, 0.04, strap, 0.18, 0, 0.12)); // strap r
  g.add(box(0.08, 0.5, 0.04, strap, -0.18, 0, 0.12)); // strap l
  g.add(box(0.2, 0.04, 0.04, strap, 0, -0.05, 0.12)); // cross strap
  g.add(cylX(0.04, 0.04, 0.3, 6, strap, 0, 0.32, -0.08)); // bedroll
  g.add(box(0.1, 0.1, 0.04, tag, 0.1, 0.18, -0.17)); // signal tag
  return g;
}

export const meta = {
  id: 'backpack_runner',
  displayName: 'Runner Pack',
  category: 'cosmetic',
  slot: 'backpack',
  rarity: 'common',
  budgets: { maxTriangles: 200, maxMaterials: 4 },
};
