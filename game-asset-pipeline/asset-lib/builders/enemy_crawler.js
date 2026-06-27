// enemy_crawler — rogue scout machine. Low, wide, aggressive insectoid silhouette.
// Faces +Z (forward). The game yaws the whole body toward its target.
import * as THREE from 'three';
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cyl, cone, plate, sphere, group, socket } from '../prim.js?v=wii-voxel-toy-v3';
import { defineRig } from '../rig.js?v=rig-workbench-v1';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { hull: P.machineHull, hullDark: P.machineHullDark, eye: P.machineEye, ...colors };
  const hull = mat(C.hull, { metal: 0.35, rough: 0.55 });
  const dark = mat(C.hullDark, { metal: 0.35, rough: 0.55 });
  const steel = mat(P.steelDark, { metal: 0.5, rough: 0.4 });
  const eyeMat = mat(C.eye, { emissive: C.eye, emissiveIntensity: 1.7 });
  const ember = mat(P.warningAmber, { emissive: P.warningAmber, emissiveIntensity: 0.8 });

  const g = group('enemy_crawler');

  // ---- body: low armored core + sloped carapace (tilted box, reliable) ----
  g.add(box(0.6, 0.22, 0.8, dark, 0, 0.44, 0));               // underbody
  const shell = box(0.66, 0.2, 0.74, hull, 0, 0.58, -0.04);
  shell.rotation.x = -0.12; g.add(shell);                      // sloped carapace
  g.add(box(0.28, 0.12, 0.44, steel, 0, 0.66, -0.08));        // spine ridge
  g.add(plate(0.24, 0.08, 0.46, hull, -0.32, 0.6, -0.04, -0.08, 0.28)); // side shell L
  g.add(plate(0.24, 0.08, 0.46, hull, 0.32, 0.6, -0.04, -0.08, -0.28)); // side shell R
  g.add(box(0.5, 0.07, 0.1, ember, 0, 0.4, 0.36));           // front underglow vent

  // ---- head / sensor module leaning forward (+z) ----
  const head = group('head');
  head.position.set(0, 0.48, 0.46);
  head.add(box(0.34, 0.2, 0.28, hull, 0, 0, 0));
  const brow = box(0.32, 0.08, 0.16, dark, 0, 0.11, 0.05); brow.rotation.x = -0.2; head.add(brow);
  const eye = sphere(0.1, eyeMat, 0, 0.0, 0.16, 0);
  head.add(eye);
  // mandible claws (cones tip forward-down: rotation.x = +90° points +Y -> +Z)
  for (const s of [-1, 1]) {
    const claw = cone(0.05, 0.22, 4, steel, 0.13 * s, -0.05, 0.16);
    claw.rotation.x = Math.PI / 2 + 0.25; head.add(claw);
  }
  g.add(head);
  g.userData.eye = eye;

  // ---- six legs (reliable boxes): thigh splays out, shin drops to a clawed foot ----
  const legZ = [0.26, -0.02, -0.3];
  const legNames = ['front', 'mid', 'rear'];
  const legJoints = [];
  for (const sx of [-1, 1]) {
    for (let i = 0; i < legZ.length; i++) {
      const lz = legZ[i];
      const hipX = 0.3 * sx;
      const side = sx > 0 ? 'r' : 'l';
      const hip = group(`joint_leg_${legNames[i]}_${side}`);
      hip.position.set(hipX, 0.44, lz);
      const thigh = box(0.32, 0.08, 0.1, dark, 0.12 * sx, 0, 0);
      thigh.rotation.z = 0.55 * sx;                            // angle outward-up
      hip.add(thigh);
      hip.add(box(0.08, 0.42, 0.1, steel, 0.27 * sx, -0.24, 0)); // vertical shin
      const foot = cone(0.055, 0.18, 4, steel, 0.27 * sx, -0.38, 0.15);
      foot.rotation.x = Math.PI / 2;
      hip.add(foot);                                           // forward foot claw
      g.add(hip);
      legJoints.push({
        id: `leg_${legNames[i]}_${side}`,
        label: `${legNames[i][0].toUpperCase() + legNames[i].slice(1)} Leg ${side.toUpperCase()}`,
        group: 'legs',
        node: hip,
        limits: {
          x: { min: -45, max: 45 }, y: { min: -25, max: 25 }, z: { min: -35, max: 35 },
        },
      });
    }
  }

  // ---- tail antenna ----
  g.add(cyl(0.012, 0.012, 0.4, 4, steel, 0, 0.72, -0.4));
  g.add(sphere(0.03, ember, 0, 0.92, -0.4));

  g.add(socket('hit_center', 0, 0.5, 0));
  g.add(socket('death', 0, 0.1, 0));
  g.userData.height = 0.9;
  g.userData.radius = 0.5;
  defineRig(g, {
    type: 'creature',
    joints: [
      { id: 'head', label: 'Sensor Head', group: 'head', node: head, limits: {
        x: { min: -30, max: 35 }, y: { min: -55, max: 55 }, z: { min: -20, max: 20 },
      } },
      ...legJoints,
    ],
  });
  const visualRoot = group('visual_root');
  for (const child of [...g.children]) visualRoot.add(child);
  g.add(visualRoot);
  g.userData.visualRoot = visualRoot;
  return g;
}

export const meta = {
  id: 'enemy_crawler', displayName: 'Crawler', category: 'enemy',
  budgets: { maxTriangles: 900, maxMaterials: 6 },
};
