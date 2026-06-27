// weapon_scrap_pistol — reliable low-damage sidearm. Mounts to the runner's hand,
// authored pointing +Z so the muzzle aligns with the character's facing.
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cylZ, group, socket } from '../prim.js?v=wii-voxel-toy-v3';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { body: P.steelDark, grip: P.rustDark, accent: P.warningAmber, ...colors };
  const body = mat(C.body, { metal: 0.4, rough: 0.5 });
  const slide = mat(P.steel, { metal: 0.5, rough: 0.4 });
  const grip = mat(C.grip, { rough: 0.9 });
  const accent = mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.4 });

  const g = group('weapon_scrap_pistol');
  g.add(box(0.07, 0.12, 0.28, body, 0, 0, 0.06));            // frame
  g.add(box(0.072, 0.06, 0.3, slide, 0, 0.06, 0.07));        // slide
  g.add(box(0.06, 0.16, 0.08, grip, 0, -0.13, -0.05));       // grip
  g.add(box(0.062, 0.1, 0.05, body, 0, -0.13, -0.02));       // magazine base
  g.add(box(0.05, 0.05, 0.22, slide, 0, 0.02, 0.22));        // barrel shroud
  g.add(cylZ(0.018, 0.018, 0.22, 6, body, 0, 0.02, 0.26));    // visible barrel
  g.add(box(0.015, 0.03, 0.015, accent, 0, 0.1, 0.18));      // front sight
  // trigger guard
  g.add(box(0.05, 0.015, 0.07, body, 0, -0.06, 0.0));
  g.add(box(0.04, 0.03, 0.04, accent, 0, 0.05, 0.32));       // muzzle glow
  g.add(socket('muzzle', 0, 0.02, 0.34));
  g.userData.muzzleSocket = 'muzzle';
  g.userData.handMount = {
    gripPoint: [0, -0.13, -0.05],
    quaternion: [0.767974, -0.014882, 0.198055, 0.608907],
  };
  g.userData.fireRate = 2.6;
  g.userData.damage = 18;
  return g;
}

export const meta = {
  id: 'weapon_scrap_pistol', displayName: 'Scrap Pistol', category: 'weapon', slot: 'weapon',
  budgets: { maxTriangles: 300, maxMaterials: 4 },
};
