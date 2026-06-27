// helmet_breaker — head-slot cosmetic. Snaps onto any humanoid's 'head' socket.
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, group } from '../prim.js?v=wii-voxel-toy-v3';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { shell: P.rust, visor: P.warningAmber, ...colors };
  const shell = mat(C.shell, { metal: 0.2 });
  const dark = mat(P.steelDark);
  const visor = mat(C.visor, { emissive: C.visor, emissiveIntensity: 1.2 });
  const g = group('helmet_breaker');
  g.add(box(0.3, 0.18, 0.3, shell, 0, 0.04, 0)); // dome
  g.add(box(0.26, 0.05, 0.26, shell, 0, 0.16, 0)); // crown cap
  g.add(box(0.32, 0.06, 0.1, dark, 0, 0.0, 0.14)); // brow guard
  g.add(box(0.22, 0.05, 0.04, visor, 0, -0.02, 0.16)); // visor slit
  g.add(box(0.05, 0.22, 0.05, dark, 0.12, 0.16, -0.06)); // antenna
  return g;
}

export const meta = {
  id: 'helmet_breaker',
  displayName: 'Breaker Helmet',
  category: 'cosmetic',
  slot: 'head',
  rarity: 'uncommon',
  budgets: { maxTriangles: 200, maxMaterials: 4 },
};
