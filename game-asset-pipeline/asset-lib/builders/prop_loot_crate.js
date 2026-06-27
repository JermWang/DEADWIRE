// prop_loot_crate — scavengable supply crate. Faint signal strip so it reads on the map.
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, group, socket } from '../prim.js?v=wii-voxel-toy-v3';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { body: P.scrap, frame: P.steelDark, signal: P.accentCyan, ...colors };
  const body = mat(C.body, { rough: 0.95 });
  const frame = mat(C.frame, { metal: 0.3 });
  const signal = mat(C.signal, { emissive: C.signal, emissiveIntensity: 1.2 });

  const g = group('prop_loot_crate');
  const s = 0.7;
  g.add(box(s, s, s, body, 0, s / 2, 0));
  g.add(box(s * 0.76, 0.04, s * 0.76, body, 0, s + 0.055, 0)); // raised lid panel
  // corner frame posts
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      g.add(box(0.08, s + 0.02, 0.08, frame, (s / 2) * sx, s / 2, (s / 2) * sz));
    }
  }
  g.add(box(s + 0.02, 0.06, s + 0.02, frame, 0, s, 0)); // lid rim
  g.add(box(0.16, 0.12, 0.05, frame, 0, s * 0.45, s / 2 + 0.02)); // latch block
  g.add(box(0.5, 0.04, 0.04, signal, 0, s * 0.62, s / 2 + 0.01)); // signal strip
  g.add(socket('lid', 0, s, 0));
  g.userData.radius = 0.55;
  g.userData.interactRange = 1.6;
  return g;
}

export const meta = {
  id: 'prop_loot_crate',
  displayName: 'Loot Crate',
  category: 'prop',
  budgets: { maxTriangles: 300, maxMaterials: 4 },
};
