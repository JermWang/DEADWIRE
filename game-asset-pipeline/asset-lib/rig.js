// Deadwire procedural rig contract.
// Builders keep using lightweight Object3D pivots, while the studio and game
// get one predictable description of every controllable joint.

const AXES = ['x', 'y', 'z'];

function normalizeLimit(limit = {}) {
  const out = {};
  for (const axis of AXES) {
    const range = limit[axis];
    if (!range) continue;
    out[axis] = {
      min: Number(range.min ?? -180),
      max: Number(range.max ?? 180),
    };
  }
  return out;
}

export function defineRig(root, { type = 'procedural', joints = [] } = {}) {
  const normalized = joints.map((joint) => {
    if (!joint?.id || !joint?.node) {
      throw new Error(`Invalid rig joint on ${root.name || 'asset'}: id and node are required`);
    }
    joint.node.name ||= `joint_${joint.id}`;
    joint.node.userData.rigJoint = joint.id;
    return {
      id: joint.id,
      label: joint.label || joint.id,
      group: joint.group || 'body',
      node: joint.node,
      limits: normalizeLimit(joint.limits),
      rest: {
        position: joint.node.position.clone(),
        rotation: joint.node.rotation.clone(),
      },
    };
  });

  root.userData.rig = {
    version: 1,
    type,
    joints: normalized,
  };
  return root.userData.rig;
}

export function resetJoint(joint) {
  if (!joint?.node || !joint?.rest) return;
  joint.node.position.copy(joint.rest.position);
  joint.node.rotation.copy(joint.rest.rotation);
}

export function resetRig(rig) {
  for (const joint of rig?.joints || []) resetJoint(joint);
}

