// Shared procedural animation clips for coded Deadwire rigs.
// The studio previews these exact samplers and gameplay drives them in real time.
import { resetRig } from './rig.js?v=rig-workbench-v1';

const D = Math.PI / 180;
const TAU = Math.PI * 2;

export const ANIMATION_LIBRARY = {
  humanoid: [
    { id: 'idle', label: 'Idle', duration: 2.4, loop: true },
    { id: 'walk', label: 'Walk', duration: 0.9, loop: true },
    { id: 'run', label: 'Run / Sprint', duration: 0.58, loop: true },
    { id: 'jump', label: 'Jump', duration: 0.8, loop: true },
    { id: 'hip_fire', label: 'Shoot · Hip', duration: 0.34, loop: false },
    { id: 'ads_fire', label: 'Shoot · ADS', duration: 0.34, loop: false },
    { id: 'reload', label: 'Reload / Weapon Swap', duration: 1.1, loop: false },
    { id: 'roll', label: 'Combat Roll', duration: 0.62, loop: false },
    { id: 'interact', label: 'Loot / Interact', duration: 1.0, loop: false },
    { id: 'hit', label: 'Hit React', duration: 0.5, loop: false },
    { id: 'death', label: 'Death', duration: 1.2, loop: false },
  ],
  creature: [
    { id: 'idle', label: 'Idle Scan', duration: 1.8, loop: true },
    { id: 'move', label: 'Scuttle', duration: 0.48, loop: true },
    { id: 'attack', label: 'Lunge Attack', duration: 0.55, loop: false },
    { id: 'hit', label: 'Hit React', duration: 0.38, loop: false },
    { id: 'death', label: 'Death', duration: 0.8, loop: false },
  ],
  mechanical: [
    { id: 'idle', label: 'Idle Scan', duration: 2.4, loop: true },
    { id: 'attack', label: 'Fire', duration: 0.42, loop: false },
    { id: 'hit', label: 'Hit React', duration: 0.35, loop: false },
    { id: 'death', label: 'Power Down', duration: 0.9, loop: false },
  ],
  'heavy-humanoid': [
    { id: 'idle', label: 'Idle', duration: 2.2, loop: true },
    { id: 'move', label: 'Heavy Walk', duration: 0.95, loop: true },
    { id: 'attack', label: 'Crushing Slam', duration: 0.9, loop: false },
    { id: 'hit', label: 'Hit React', duration: 0.45, loop: false },
    { id: 'death', label: 'Collapse', duration: 1.15, loop: false },
  ],
};

export function clipsForRig(rigType) {
  return ANIMATION_LIBRARY[rigType] || [];
}

function mapJoints(root) {
  const out = {};
  for (const joint of root.userData.rig?.joints || []) out[joint.id] = joint;
  return out;
}

function delta(joint, axis, degrees) {
  if (!joint) return;
  joint.node.rotation[axis] += degrees * D;
}

function visual(root) {
  return root.userData.visualRoot || root;
}

export function applyArmPose(root, pose = 'idle') {
  const arms = root?.userData?.arms;
  const poses = root?.userData?.armPoses;
  if (!arms || !poses) return;
  for (const side of ['l', 'r']) {
    const arm = arms[side], base = poses[side]?.[pose];
    if (!arm || !base) continue;
    arm.shoulder.quaternion.copy(base.q);
    arm.elbow.rotation.x = base.elbowX;
    arm.elbow.rotation.y = 0;
    arm.elbow.rotation.z = 0;
  }
}

export function resetAnimatedRoot(root) {
  resetRig(root?.userData?.rig);
  const v = root?.userData?.visualRoot;
  if (!v) return;
  v.position.set(0, 0, 0);
  v.rotation.set(0, 0, 0);
  v.scale.set(1, 1, 1);
}

function sampleRunner(root, clip, phase, time, params) {
  const j = mapJoints(root);
  const v = visual(root);
  const wave = Math.sin(phase * TAU);
  const cos = Math.cos(phase * TAU);
  const pulse = Math.sin(Math.min(1, phase) * Math.PI);
  const armBase = clip === 'hip_fire' ? 'hip'
    : clip === 'ads_fire' || clip === 'reload' ? 'aim'
      : 'idle';
  applyArmPose(root, armBase);

  // Quiet life in every pose: breathing and a tiny visor scan.
  v.position.y += Math.sin(time * 2.6) * 0.012;
  delta(j.head, 'y', Math.sin(time * 0.65) * 3);

  if (clip === 'walk' || clip === 'run') {
    const run = clip === 'run';
    const stride = run ? 52 : 28;
    const knee = run ? 62 : 34;
    delta(j.hip_l, 'x', wave * stride);
    delta(j.hip_r, 'x', -wave * stride);
    delta(j.knee_l, 'x', Math.max(0, -wave) * knee);
    delta(j.knee_r, 'x', Math.max(0, wave) * knee);
    delta(j.shoulder_l, 'x', wave * (run ? 42 : 22));
    delta(j.shoulder_r, 'x', -wave * (run ? 42 : 22));
    delta(j.elbow_l, 'x', -(run ? 56 : 24) - wave * (run ? 9 : 4));
    delta(j.elbow_r, 'x', -(run ? 56 : 24) + wave * (run ? 9 : 4));
    v.position.y += Math.abs(cos) * (run ? 0.055 : 0.025);
    v.rotation.z = wave * (run ? 2.8 : 1.4) * D;
  } else if (clip === 'jump') {
    const lift = Math.sin(phase * Math.PI);
    const edgeCrouch = Math.pow(Math.abs(Math.cos(phase * Math.PI)), 8);
    const reachPhase = Math.max(0, Math.min(1, (phase - 0.08) / 0.84));
    const reach = Math.pow(Math.sin(reachPhase * Math.PI), 0.8);
    // Compress before takeoff and on landing; tuck only lightly through the apex.
    delta(j.hip_l, 'x', -10 - edgeCrouch * 26 - lift * 12);
    delta(j.hip_r, 'x', -10 - edgeCrouch * 26 - lift * 12);
    delta(j.knee_l, 'x', 20 + edgeCrouch * 42 + lift * 20);
    delta(j.knee_r, 'x', 20 + edgeCrouch * 42 + lift * 20);
    // Arms sweep from the sides into a broad overhead V at the apex.
    delta(j.shoulder_l, 'z', -152 * reach);
    delta(j.shoulder_r, 'z', 152 * reach);
    delta(j.shoulder_l, 'x', -8 * reach);
    delta(j.shoulder_r, 'x', -8 * reach);
    delta(j.elbow_l, 'x', -18 * reach);
    delta(j.elbow_r, 'x', -18 * reach);
    delta(j.head, 'x', -5 * reach);
    if (!params.physical) v.position.y += lift * 0.48;
  } else if (clip === 'roll') {
    const tuckIn = Math.sin(Math.min(1, phase / 0.18) * Math.PI / 2);
    const tuckOut = Math.sin(Math.min(1, (1 - phase) / 0.18) * Math.PI / 2);
    const tuck = tuckIn * tuckOut;
    delta(j.hip_l, 'x', -78 * tuck);
    delta(j.hip_r, 'x', -78 * tuck);
    delta(j.knee_l, 'x', 125 * tuck);
    delta(j.knee_r, 'x', 125 * tuck);
    delta(j.shoulder_l, 'x', -42 * tuck);
    delta(j.shoulder_r, 'x', -42 * tuck);
    delta(j.elbow_l, 'x', -118 * tuck);
    delta(j.elbow_r, 'x', -118 * tuck);
    delta(j.head, 'x', 20 * tuck);

    // Rotate around the runner's center of mass instead of the model origin at
    // the feet. Ease the spin so takeoff and landing read as planted moments.
    const spinPhase = phase * phase * (3 - 2 * phase);
    const angle = spinPhase * TAU;
    const pivotY = 0.94;
    v.rotation.x = angle;
    v.position.y += pivotY * (1 - Math.cos(angle)) + Math.sin(phase * Math.PI) * 0.16;
    v.position.z -= pivotY * Math.sin(angle);
  } else if (clip === 'reload') {
    const work = Math.sin(phase * Math.PI);
    delta(j.shoulder_l, 'x', 34 * work);
    delta(j.shoulder_r, 'x', 18 * work);
    delta(j.elbow_l, 'x', -80 * work);
    delta(j.elbow_r, 'x', -45 * work);
    delta(j.head, 'x', 12 * work);
  } else if (clip === 'interact') {
    delta(j.hip_l, 'x', -22 * pulse);
    delta(j.hip_r, 'x', -22 * pulse);
    delta(j.knee_l, 'x', 42 * pulse);
    delta(j.knee_r, 'x', 42 * pulse);
    delta(j.shoulder_r, 'x', -55 * pulse);
    delta(j.elbow_r, 'x', -65 * pulse);
    v.position.y -= pulse * 0.16;
  } else if (clip === 'hit') {
    v.rotation.z = Math.sin(phase * Math.PI) * -13 * D;
    delta(j.head, 'z', 18 * pulse);
    delta(j.shoulder_l, 'x', 28 * pulse);
    delta(j.shoulder_r, 'x', 28 * pulse);
  } else if (clip === 'death') {
    const fall = 1 - Math.pow(1 - Math.min(1, phase), 3);
    v.rotation.z = -fall * Math.PI / 2;
    v.position.y += fall * 0.34;
    delta(j.hip_l, 'x', -30 * fall);
    delta(j.knee_l, 'x', 55 * fall);
    delta(j.shoulder_l, 'x', 60 * fall);
    delta(j.shoulder_r, 'x', -40 * fall);
  } else if (clip === 'hip_fire' || clip === 'ads_fire') {
    const ads = clip === 'ads_fire';
    const kick = Math.max(0, Math.sin(phase * TAU));
    if (ads) {
      delta(j.shoulder_l, 'x', -8 - kick * 6);
      delta(j.shoulder_r, 'x', -8 - kick * 6);
      delta(j.elbow_l, 'x', -8);
      delta(j.elbow_r, 'x', -8);
    } else {
      delta(j.shoulder_r, 'x', 4 - kick * 10);
      delta(j.elbow_r, 'x', -10);
      delta(j.shoulder_l, 'x', 8);
    }
    delta(j.head, 'x', ads ? -6 : 0);
    v.position.z -= kick * 0.035;
  } else {
    delta(j.hip_l, 'z', Math.sin(time * 1.1) * 1.2);
    delta(j.hip_r, 'z', -Math.sin(time * 1.1) * 1.2);
  }

  if (params.aiming) delta(j.head, 'x', -5);
}

function sampleCrawler(root, clip, phase, time) {
  const j = mapJoints(root), v = visual(root);
  const wave = Math.sin(phase * TAU);
  delta(j.head, 'y', Math.sin(time * 1.4) * 14);
  if (clip === 'move') {
    for (const [index, name] of ['front_l', 'mid_l', 'rear_l', 'front_r', 'mid_r', 'rear_r'].entries()) {
      delta(j[`leg_${name}`], 'x', Math.sin(phase * TAU + (index % 2) * Math.PI) * 28);
    }
    v.position.y += Math.abs(wave) * 0.035;
  } else if (clip === 'attack') {
    const lunge = Math.sin(phase * Math.PI);
    delta(j.head, 'x', -32 * lunge);
    v.position.z += lunge * 0.42;
  } else if (clip === 'hit') {
    v.rotation.z = Math.sin(phase * Math.PI) * 18 * D;
  } else if (clip === 'death') {
    v.rotation.z = -Math.min(1, phase * 1.4) * Math.PI / 2;
    v.position.y += Math.min(1, phase * 1.4) * 0.18;
  }
}

function sampleTurret(root, clip, phase, time, params) {
  const j = mapJoints(root), v = visual(root);
  const head = j.turret_head;
  delta(head, 'y', params.aimYaw != null ? params.aimYaw / D : Math.sin(time * 0.7) * 45);
  if (clip === 'attack') delta(head, 'x', -Math.sin(phase * Math.PI) * 12);
  else if (clip === 'hit') v.rotation.z = Math.sin(phase * Math.PI) * 9 * D;
  else if (clip === 'death') {
    delta(head, 'x', Math.min(1, phase * 1.6) * 30);
    v.position.y -= Math.min(1, phase * 1.6) * 0.18;
  }
}

function sampleHauler(root, clip, phase, time) {
  const j = mapJoints(root), v = visual(root);
  const wave = Math.sin(phase * TAU);
  delta(j.head, 'y', Math.sin(time * 0.7) * 5);
  if (clip === 'move') {
    delta(j.shoulder_l, 'x', wave * 15);
    delta(j.shoulder_r, 'x', -wave * 15);
    v.position.y += Math.abs(wave) * 0.045;
    v.rotation.z = wave * 2 * D;
  } else if (clip === 'attack') {
    const slam = Math.sin(phase * Math.PI);
    delta(j.shoulder_l, 'x', -105 * slam);
    delta(j.shoulder_r, 'x', -105 * slam);
    delta(j.elbow_l, 'x', 65 * slam);
    delta(j.elbow_r, 'x', 65 * slam);
    v.position.y -= slam * 0.12;
  } else if (clip === 'hit') {
    v.rotation.z = Math.sin(phase * Math.PI) * -9 * D;
  } else if (clip === 'death') {
    const fall = Math.min(1, phase * 1.25);
    v.rotation.z = -fall * Math.PI / 2;
    v.position.y += fall * 0.75;
  }
}

export function applyAnimation(root, clipId = 'idle', time = 0, params = {}) {
  if (!root?.userData?.rig) return;
  resetAnimatedRoot(root);
  const type = root.userData.rig.type;
  const def = clipsForRig(type).find((clip) => clip.id === clipId) || clipsForRig(type)[0];
  if (!def) return;
  const localTime = def.loop ? time % def.duration : Math.min(time, def.duration);
  const phase = def.duration ? localTime / def.duration : 0;
  if (type === 'humanoid') sampleRunner(root, def.id, phase, localTime, params);
  else if (type === 'creature') sampleCrawler(root, def.id, phase, localTime, params);
  else if (type === 'mechanical') sampleTurret(root, def.id, phase, localTime, params);
  else if (type === 'heavy-humanoid') sampleHauler(root, def.id, phase, localTime, params);
}
