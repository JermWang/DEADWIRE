// enemy_hauler — slow armored guardian that camps high-value loot / the core.
// Heavy layered plating, hydraulic piston arms, crushing fists, glowing reactor chest.
import * as THREE from 'three';
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cyl, cylX, capsule, plate, sphere, group, socket } from '../prim.js?v=wii-voxel-toy-v3';
import { defineRig } from '../rig.js?v=rig-workbench-v1';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { hull: P.machineHull, plate: P.rust, dark: P.machineHullDark, eye: P.machineEye, ...colors };
  const hull = mat(C.hull, { metal: 0.3, rough: 0.6 });
  const plateMat = mat(C.plate, { metal: 0.2, rough: 0.7 });
  const dark = mat(C.dark, { metal: 0.4, rough: 0.5 });
  const steel = mat(P.steelDark, { metal: 0.5, rough: 0.4 });
  const eyeMat = mat(C.eye, { emissive: C.eye, emissiveIntensity: 1.4 });
  const coreMat = mat(P.warningAmber, { emissive: P.warningAmber, emissiveIntensity: 1.6 });

  const g = group('enemy_hauler');

  // ---- torso: core block + layered armor + reactor chest ----
  g.add(box(1.2, 1.2, 1.0, dark, 0, 1.05, 0));                 // core block
  g.add(plate(1.36, 0.34, 1.0, plateMat, 0, 1.55, 0.02, -0.18)); // sloped upper plate
  g.add(box(1.34, 0.4, 1.12, hull, 0, 1.25, 0));              // chest band
  g.add(box(1.1, 0.12, 1.14, steel, 0, 0.72, 0));             // lower armor rail
  g.add(box(0.96, 0.22, 0.1, plateMat, 0, 0.95, 0.57));       // belly plate
  g.add(cyl(0.22, 0.22, 0.2, 6, steel, 0, 1.3, 0.5));        // reactor housing
  const reactor = sphere(0.16, coreMat, 0, 1.3, 0.56, 1);
  g.add(reactor); g.userData.glow = reactor;                  // glowing reactor core
  // rivet plates
  for (const sx of [-1, 1]) g.add(box(0.12, 0.9, 0.12, steel, 0.5 * sx, 1.05, 0.5));

  // ---- head: bunkered sensor cluster ----
  const head = group('joint_head');
  head.position.set(0, 1.75, 0);
  head.add(box(0.66, 0.46, 0.56, dark, 0, 0.2, 0));
  head.add(plate(0.6, 0.14, 0.4, steel, 0, 0.43, 0, -0.25));    // helm crest
  const eye = box(0.4, 0.1, 0.06, eyeMat, 0, 0.21, 0.29); head.add(eye); g.userData.eye = eye;
  head.add(box(0.5, 0.06, 0.08, steel, 0, 0.07, 0.28));         // jaw guard
  g.add(head);

  // ---- heavy piston arms + crushing fists ----
  g.add(cylX(0.09, 0.09, 1.9, 6, steel, 0, 1.47, -0.22));     // shoulder axle
  const arms = {};
  for (const sx of [-1, 1]) {
    const side = sx > 0 ? 'r' : 'l';
    const shoulder = group(`joint_shoulder_${side}`);
    shoulder.position.set(0.68 * sx, 1.45, 0);
    shoulder.add(box(0.4, 0.5, 0.5, plateMat, 0.18 * sx, 0, 0));   // pauldron
    shoulder.add(plate(0.44, 0.18, 0.5, dark, 0.18 * sx, 0.27, 0, -0.3)); // pauldron crest
    shoulder.add(box(0.34, 0.07, 0.52, coreMat, 0.18 * sx, 0.07, 0.28)); // shoulder warning slit
    shoulder.add(cyl(0.14, 0.14, 0.5, 6, steel, 0.24 * sx, -0.45, 0.06)); // hydraulic upper

    const elbow = group(`joint_elbow_${side}`);
    elbow.position.set(0.24 * sx, -0.45, 0.06);
    elbow.add(cyl(0.06, 0.06, 0.4, 5, dark, 0, 0, 0));        // piston rod
    elbow.add(capsule(0.17, 0.3, hull, 0.04 * sx, -0.45, 0.04)); // forearm
    elbow.add(box(0.5, 0.38, 0.56, dark, 0.06 * sx, -0.78, 0.06)); // crushing fist
    elbow.add(box(0.5, 0.12, 0.12, steel, 0.06 * sx, -0.6, 0.06)); // knuckle ridge
    shoulder.add(elbow);
    g.add(shoulder);
    arms[side] = { shoulder, elbow };
  }

  // ---- stomper legs ----
  for (const sx of [-1, 1]) {
    g.add(box(0.46, 0.55, 0.55, hull, 0.32 * sx, 0.32, 0));
    g.add(box(0.5, 0.2, 0.5, plateMat, 0.32 * sx, 0.55, 0.04)); // thigh plate
    g.add(box(0.56, 0.16, 0.66, steel, 0.32 * sx, 0.08, 0.06)); // foot
    g.add(box(0.5, 0.08, 0.18, plateMat, 0.32 * sx, 0.16, 0.38)); // toe armor
  }

  g.add(socket('hit_center', 0, 1.2, 0));
  g.add(socket('death', 0, 0.3, 0));
  g.userData.height = 2.4;
  g.userData.radius = 1.0;
  g.userData.arms = arms;
  defineRig(g, {
    type: 'heavy-humanoid',
    joints: [
      { id: 'head', label: 'Sensor Head', group: 'spine', node: head, limits: {
        x: { min: -20, max: 25 }, y: { min: -55, max: 55 }, z: { min: -15, max: 15 },
      } },
      { id: 'shoulder_l', label: 'Shoulder L', group: 'arms', node: arms.l.shoulder, limits: {
        x: { min: -75, max: 75 }, y: { min: -40, max: 40 }, z: { min: -80, max: 45 },
      } },
      { id: 'elbow_l', label: 'Elbow L', group: 'arms', node: arms.l.elbow, limits: {
        x: { min: -20, max: 110 }, z: { min: -20, max: 20 },
      } },
      { id: 'shoulder_r', label: 'Shoulder R', group: 'arms', node: arms.r.shoulder, limits: {
        x: { min: -75, max: 75 }, y: { min: -40, max: 40 }, z: { min: -45, max: 80 },
      } },
      { id: 'elbow_r', label: 'Elbow R', group: 'arms', node: arms.r.elbow, limits: {
        x: { min: -20, max: 110 }, z: { min: -20, max: 20 },
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
  id: 'enemy_hauler', displayName: 'Hauler', category: 'enemy',
  budgets: { maxTriangles: 1400, maxMaterials: 7 },
};
