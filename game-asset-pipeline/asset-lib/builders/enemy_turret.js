// enemy_turret — stationary line-of-sight emplacement. Armored base, rotating
// twin-barrel head with an ammo drum and a hot sensor eye. userData.head yaws to
// the player; userData.muzzleY is the bolt origin height.
import * as THREE from 'three';
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cyl, cylX, cylZ, plate, sphere, group, socket } from '../prim.js?v=wii-voxel-toy-v3';
import { defineRig } from '../rig.js?v=rig-workbench-v1';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { hull: P.machineHull, base: P.steelDark, eye: P.machineEye, ...colors };
  const hull = mat(C.hull, { metal: 0.35, rough: 0.55 });
  const base = mat(C.base, { metal: 0.45, rough: 0.45 });
  const dark = mat(P.machineHullDark, { metal: 0.4, rough: 0.5 });
  const eyeMat = mat(C.eye, { emissive: C.eye, emissiveIntensity: 1.8 });
  const warn = mat(P.warningAmber, { emissive: P.warningAmber, emissiveIntensity: 0.7 });

  const g = group('enemy_turret');

  // ---- armored base ----
  g.add(cyl(0.5, 0.66, 0.22, 8, base, 0, 0.11, 0));            // footplate
  g.add(cyl(0.22, 0.3, 0.46, 8, hull, 0, 0.42, 0));           // pillar
  g.add(box(0.5, 0.08, 0.5, warn, 0, 0.2, 0));                // hazard band

  // ---- rotating head ----
  const head = group('turret_head');
  head.position.y = 0.82;
  head.add(box(0.5, 0.36, 0.42, hull, 0, 0, 0));               // head block
  head.add(plate(0.46, 0.12, 0.3, dark, 0, 0.2, -0.04, -0.3)); // sloped crest
  head.add(cylX(0.18, 0.18, 0.54, 6, dark, 0.0, 0.02, -0.24)); // simple ammo drum
  // twin barrels with muzzle brakes
  for (const sx of [-1, 1]) {
    head.add(cylZ(0.045, 0.045, 0.56, 6, base, 0.11 * sx, 0.0, 0.34));
    head.add(cylZ(0.07, 0.07, 0.1, 6, dark, 0.11 * sx, 0.0, 0.6)); // muzzle brake
  }
  // sensor eye cluster
  const eye = sphere(0.1, eyeMat, 0, 0.05, 0.22, 0);
  head.add(eye);
  head.add(box(0.3, 0.06, 0.04, eyeMat, 0, -0.1, 0.21));      // sensor strip
  g.add(head);
  g.userData.head = head;
  g.userData.eye = eye;
  g.userData.muzzleY = 0.82;

  g.add(socket('hit_center', 0, 0.7, 0));
  g.add(socket('death', 0, 0.2, 0));
  g.userData.height = 1.2;
  g.userData.radius = 0.6;
  defineRig(g, {
    type: 'mechanical',
    joints: [
      { id: 'turret_head', label: 'Turret Head', group: 'weapon', node: head, limits: {
        x: { min: -20, max: 35 }, y: { min: -180, max: 180 },
      } },
    ],
  });
  const visualRoot = group('visual_root');
  for (const child of [...g.children]) visualRoot.add(child);
  g.add(visualRoot);
  g.userData.visualRoot = visualRoot;
  return g;
}

export const meta = {
  id: 'enemy_turret', displayName: 'Turret', category: 'enemy',
  budgets: { maxTriangles: 800, maxMaterials: 5 },
};
