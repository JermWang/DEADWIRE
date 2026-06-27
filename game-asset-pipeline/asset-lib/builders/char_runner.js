// char_runner — Deadwire base runner (player avatar + menu hero centerpiece).
// Authored rig-ready: T-pose is the default; the game passes pose:'aim' for combat.
// Chunky scavenger silhouette: broad color blocks, simple gear shapes, clean
// T-pose sockets. The game passes pose:'aim' for the playable combat stance.
import * as THREE from 'three';
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cyl, cylX, capsule, sphere, group, socket } from '../prim.js?v=wii-voxel-toy-v3';
import { defineRig } from '../rig.js?v=rig-workbench-v1';

export function build(opts = {}) {
  const { pose = 'tpose', colors = {} } = opts;
  const C = {
    jacket: P.runnerJacket, pants: P.runnerPants, boots: P.runnerBoots,
    skin: P.runnerSkin, pack: P.runnerPack, accent: P.warningAmber,
    strap: P.cableBlack, metal: P.steel, glove: P.steelDark, pad: P.rustDark,
    ...colors,
  };
  const jacket = mat(C.jacket);
  const jacketDk = mat(new THREE.Color(C.jacket).multiplyScalar(0.7).getStyle());
  const pants = mat(C.pants);
  const boots = mat(C.boots);
  const skin = mat(C.skin);
  const accent = mat(C.accent, { emissive: C.accent, emissiveIntensity: 0.3 });
  const strap = mat(C.strap, { rough: 0.95 });
  const metal = mat(C.metal, { metal: 0.5, rough: 0.4 });
  const glove = mat(C.glove, { rough: 0.85 });
  const pad = mat(C.pad, { rough: 0.9 });
  const visorMat = mat(P.accentCyan, { emissive: P.accentCyan, emissiveIntensity: 0.8 });

  const g = group('char_runner');

  // ---------- legs ----------
  const legs = {};
  for (const s of [-1, 1]) {
    const right = s > 0;
    const x = 0.17 * s;
    const hip = group(right ? 'joint_hip_r' : 'joint_hip_l');
    hip.position.set(x, 1.01, 0);
    const knee = group(right ? 'joint_knee_r' : 'joint_knee_l');
    knee.position.set(0, -0.31, 0);
    // boot: sole + upper + toe + ankle cuff
    knee.add(box(0.26, 0.07, 0.44, mat(P.cableBlack), 0, -0.66, 0.04)); // oversized sole
    knee.add(box(0.23, 0.17, 0.32, boots, 0, -0.54, 0.0));              // upper
    knee.add(box(0.24, 0.12, 0.17, boots, 0, -0.57, 0.22));             // chunky toe cap
    knee.add(box(0.24, 0.06, 0.27, strap, 0, -0.45, 0.0));              // ankle cuff
    // lower leg (tapered) + shin guard + knee pad
    knee.add(cyl(0.085, 0.1, 0.42, 6, pants, 0, -0.24, 0));
    knee.add(box(0.16, 0.3, 0.05, pad, 0, -0.2, 0.11));                 // shin guard
    knee.add(sphere(0.11, pad, 0, 0, 0.04, 0));                         // knee pad
    // thigh (tapered)
    hip.add(cyl(0.12, 0.135, 0.3, 6, pants, 0, -0.15, 0));
    if (s > 0) hip.add(box(0.12, 0.2, 0.08, strap, 0.02, -0.21, 0.1));  // thigh holster strap
    hip.add(knee);
    g.add(hip);
    legs[right ? 'r' : 'l'] = { hip, knee };
  }

  // ---------- pelvis + belt ----------
  g.add(box(0.46, 0.2, 0.27, pants, 0, 1.0, 0));
  g.add(box(0.5, 0.09, 0.3, strap, 0, 1.07, 0));                       // belt
  g.add(box(0.12, 0.08, 0.06, accent, 0, 1.07, 0.16));                  // buckle
  g.add(box(0.13, 0.16, 0.1, glove, 0.26, 0.98, 0.05));                 // hip holster
  g.add(box(0.1, 0.12, 0.08, pad, -0.25, 1.0, 0.08));                   // belt pouch

  // ---------- torso (layered) ----------
  g.add(box(0.54, 0.46, 0.32, jacket, 0, 1.31, 0));                     // broad jacket block
  g.add(box(0.38, 0.28, 0.07, jacketDk, 0, 1.36, 0.18));                // simple chest plate
  g.add(box(0.16, 0.16, 0.05, pad, -0.13, 1.32, 0.22));                 // chest pouch
  // crossing harness straps
  const strapL = box(0.06, 0.46, 0.04, strap, 0, 1.34, 0.17); strapL.rotation.z = 0.32; g.add(strapL);
  const strapR = box(0.06, 0.46, 0.04, strap, 0, 1.34, 0.17); strapR.rotation.z = -0.32; g.add(strapR);
  g.add(box(0.2, 0.06, 0.02, accent, 0, 1.46, 0.18));                   // chest light bar
  // collar / neck gaiter
  g.add(cyl(0.11, 0.13, 0.12, 6, strap, 0, 1.56, 0));

  // ---------- head ----------
  const headY = 1.72;
  const head = group('joint_head');
  head.position.set(0, 1.56, 0);
  head.add(box(0.31, 0.3, 0.29, skin, 0, headY - head.position.y, 0));                       // toy-proportioned head
  head.add(box(0.34, 0.14, 0.32, jacketDk, 0, headY + 0.15 - head.position.y, 0));           // cap / hood top
  head.add(box(0.34, 0.06, 0.06, jacketDk, 0, headY + 0.09 - head.position.y, 0.17));        // simple brim
  head.add(box(0.28, 0.12, 0.06, visorMat, 0, headY + 0.01 - head.position.y, 0.16));        // bright visor band
  head.add(box(0.18, 0.1, 0.1, mat(P.steelDark, { metal: 0.2 }), 0, headY - 0.12 - head.position.y, 0.1)); // mask block
  head.add(cyl(0.022, 0.022, 0.1, 4, metal, 0.08, headY - 0.08 - head.position.y, 0.13));    // mask filter
  head.add(sphere(0.03, mat(P.warningRed, { emissive: P.warningRed, emissiveIntensity: 1.6 }), -0.14, headY + 0.05 - head.position.y, 0)); // side light
  g.add(head);

  // ---------- arms: 2-bone rig (shoulder + elbow pivots) ----------
  // poses: 'tpose' (rig), 'game'/'idle' (arms down), 'aim' (both hands on the gun, forward).
  const metalPad = mat(C.metal, { metal: 0.5, rough: 0.4 });
  const GRIP = new THREE.Vector3(0.12, 1.42, 0.5);   // where the gun sits (character-local)
  const DOWN = new THREE.Vector3(0, -1, 0);
  const arms = {};
  const armPoses = {};
  for (const s of [-1, 1]) {
    const right = s > 0;
    const shoulderPos = new THREE.Vector3(0.28 * s, 1.5, 0);
    const shoulder = new THREE.Object3D();
    shoulder.name = right ? 'joint_shoulder_r' : 'joint_shoulder_l';
    shoulder.position.copy(shoulderPos);
    shoulder.add(box(0.22, 0.14, 0.25, pad, 0.02 * s, 0.02, 0));        // chunky shoulder pad
    shoulder.add(box(0.15, 0.06, 0.18, metalPad, 0.03 * s, 0.1, 0));
    shoulder.add(capsule(0.09, 0.22, jacket, 0, -0.16, 0));             // upper arm
    const elbow = new THREE.Object3D();
    elbow.name = right ? 'joint_elbow_r' : 'joint_elbow_l';
    elbow.position.set(0, -0.3, 0);
    shoulder.add(elbow);
    elbow.add(capsule(0.078, 0.22, jacketDk, 0, -0.15, 0));             // forearm
    const hand = box(0.14, 0.13, 0.15, glove, 0, -0.3, 0);
    hand.add(box(0.13, 0.05, 0.06, metal, 0, 0, 0.07));                 // knuckle plate
    elbow.add(hand);
    hand.add(socket(right ? 'hand_r' : 'hand_l'));

    // Stable arm bases let animation clips switch rotation spaces cleanly.
    const idleQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.12 * s));
    const tposeQ = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, Math.PI / 2 * s));
    const aimTarget = right ? GRIP.clone() : new THREE.Vector3(-0.03, 1.4, 0.43);
    const aimDir = aimTarget.sub(shoulderPos).normalize();
    const aimElbowX = right ? -0.3 : -0.42;
    const aimQ = new THREE.Quaternion().setFromUnitVectors(DOWN, aimDir)
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -aimElbowX * 0.5));
    const hipTarget = new THREE.Vector3(0.16, 1.28, 0.45);
    const hipElbowX = right ? -0.22 : -0.5;
    const hipQ = right
      ? new THREE.Quaternion().setFromUnitVectors(DOWN, hipTarget.sub(shoulderPos).normalize())
        .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -hipElbowX * 0.5))
      : idleQ.clone();
    armPoses[right ? 'r' : 'l'] = {
      idle: { q: idleQ, elbowX: -0.14 },
      tpose: { q: tposeQ, elbowX: 0 },
      aim: { q: aimQ, elbowX: aimElbowX },
      hip: { q: hipQ, elbowX: hipElbowX },
    };
    const chosen = pose === 'tpose' ? armPoses[right ? 'r' : 'l'].tpose
      : pose === 'aim' ? armPoses[right ? 'r' : 'l'].aim
        : armPoses[right ? 'r' : 'l'].idle;
    shoulder.quaternion.copy(chosen.q);
    elbow.rotation.x = chosen.elbowX;
    g.add(shoulder);
    arms[right ? 'r' : 'l'] = { shoulder, elbow };
  }
  g.userData.arms = arms;        // exposed so the game can drive recoil / aim pitch later
  g.userData.armPoses = armPoses;

  // forward gun mount — the weapon parents here and always points +Z (where you aim)
  g.add(socket('grip', GRIP.x, GRIP.y, GRIP.z));
  g.userData.aimGrip = 'grip';

  // ---------- backpack (compact, sits low so it doesn't block the OTS camera) ----------
  const packMat = C.pack ? mat(C.pack, { rough: 0.95 }) : pad;
  const packG = group('pack');
  packG.position.set(0, 1.2, -0.2);
  packG.add(box(0.3, 0.34, 0.13, packMat, 0, 0, 0));                    // main
  packG.add(box(0.26, 0.12, 0.12, pad, 0, -0.22, 0.01));               // bottom pouch
  packG.add(cylX(0.05, 0.05, 0.34, 6, strap, 0, 0.2, 0.0));            // bedroll on top
  packG.add(cyl(0.01, 0.01, 0.3, 4, metal, 0.1, 0.28, -0.03));         // antenna
  packG.add(box(0.12, 0.05, 0.03, accent, -0.08, 0.12, -0.08));         // rear status light
  g.add(packG);

  // ---------- universal sockets ----------
  g.add(socket('head', 0, 1.9, 0));
  g.add(socket('face', 0, headY, 0.16));
  g.add(socket('torso', 0, 1.32, 0));
  g.add(socket('backpack', 0, 1.34, -0.2));
  g.add(socket('shoulder_l', -0.34, 1.52, 0));
  g.add(socket('shoulder_r', 0.34, 1.52, 0));
  g.add(socket('hip', 0.26, 1.0, 0.05));
  g.add(socket('mount', 0, 0.0, -0.6));
  g.add(socket('aura', 0, 0.02, 0));
  g.add(socket('nameplate', 0, 2.2, 0));
  g.add(socket('extraction', 0, 0.02, 0));
  g.add(socket('death', 0, 0.02, 0));
  g.userData.weaponSocketName = 'hand_r';

  g.userData.height = 1.9;
  g.userData.radius = 0.32;
  defineRig(g, {
    type: 'humanoid',
    joints: [
      { id: 'head', label: 'Head', group: 'spine', node: head, limits: {
        x: { min: -35, max: 35 }, y: { min: -65, max: 65 }, z: { min: -25, max: 25 },
      } },
      { id: 'hip_l', label: 'Hip L', group: 'legs', node: legs.l.hip, limits: {
        x: { min: -95, max: 65 }, y: { min: -35, max: 35 }, z: { min: -50, max: 30 },
      } },
      { id: 'knee_l', label: 'Knee L', group: 'legs', node: legs.l.knee, limits: {
        x: { min: 0, max: 135 },
      } },
      { id: 'hip_r', label: 'Hip R', group: 'legs', node: legs.r.hip, limits: {
        x: { min: -95, max: 65 }, y: { min: -35, max: 35 }, z: { min: -30, max: 50 },
      } },
      { id: 'knee_r', label: 'Knee R', group: 'legs', node: legs.r.knee, limits: {
        x: { min: 0, max: 135 },
      } },
      { id: 'shoulder_l', label: 'Shoulder L', group: 'arms', node: arms.l.shoulder, limits: {
        x: { min: -100, max: 100 }, y: { min: -80, max: 80 }, z: { min: -110, max: 110 },
      } },
      { id: 'elbow_l', label: 'Elbow L', group: 'arms', node: arms.l.elbow, limits: {
        x: { min: -145, max: 0 }, y: { min: -25, max: 25 },
      } },
      { id: 'shoulder_r', label: 'Shoulder R', group: 'arms', node: arms.r.shoulder, limits: {
        x: { min: -100, max: 100 }, y: { min: -80, max: 80 }, z: { min: -110, max: 110 },
      } },
      { id: 'elbow_r', label: 'Elbow R', group: 'arms', node: arms.r.elbow, limits: {
        x: { min: -145, max: 0 }, y: { min: -25, max: 25 },
      } },
    ],
  });
  g.userData.legs = legs;
  const visualRoot = group('visual_root');
  for (const child of [...g.children]) visualRoot.add(child);
  g.add(visualRoot);
  g.userData.visualRoot = visualRoot;
  return g;
}

export const meta = {
  id: 'char_runner',
  displayName: 'Runner',
  category: 'character',
  budgets: { maxTriangles: 2200, maxMaterials: 16 },
};
