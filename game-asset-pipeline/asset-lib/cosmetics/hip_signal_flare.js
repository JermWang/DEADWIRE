// hip_signal_flare - common hip-slot canister for starter runner identity.
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cyl, group } from '../prim.js?v=wii-voxel-toy-v3';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { body: P.warningAmber, cap: P.steelDark, light: P.toxic, ...colors };
  const body = mat(C.body, { metal: 0.15, rough: 0.65 });
  const cap = mat(C.cap, { rough: 0.82 });
  const light = mat(C.light, { emissive: C.light, emissiveIntensity: 1.1 });
  const g = group('hip_signal_flare');
  const canister = cyl(0.045, 0.055, 0.28, 6, body, 0, 0, 0);
  canister.rotation.z = 0.16;
  g.add(canister);
  g.add(box(0.12, 0.06, 0.08, cap, 0, 0.16, 0));
  g.add(box(0.1, 0.06, 0.08, cap, 0, -0.16, 0));
  g.add(box(0.05, 0.08, 0.035, light, 0.055, 0.04, 0.04));
  return g;
}

export const meta = {
  id: 'hip_signal_flare',
  displayName: 'Signal Flare',
  category: 'cosmetic',
  slot: 'hip',
  rarity: 'common',
  budgets: { maxTriangles: 160, maxMaterials: 4 },
};
