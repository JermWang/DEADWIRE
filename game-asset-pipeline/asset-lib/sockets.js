// Universal cosmetic socket system (from MASTER_BLUEPRINT.md).
// Every humanoid asset exposes these named Object3D sockets so any cosmetic
// can attach to any character silhouette. Cosmetics declare which slot they fill.

export const SLOTS = [
  'head',        // helmets, hats
  'face',        // masks, visors
  'torso',       // jackets, chest plates (mesh-swap region)
  'arms',        // arm wraps / pauldron base
  'legs',        // pants region
  'boots',       // footwear
  'hands',       // gloves
  'backpack',    // back-mounted gear
  'shoulder_l',
  'shoulder_r',
  'weapon',      // primary weapon mount (right hand)
  'hip',         // holster / belt gear
  'mount',       // drone/pet/mount anchor
  'aura',        // ground/body fx
  'nameplate',   // floating title above head
  'extraction',  // extraction flare origin
  'death',       // death-marker origin
];

// Slots that are pure attachment points (cosmetic snaps on) vs. region swaps.
export const ATTACH_SLOTS = new Set([
  'head', 'face', 'backpack', 'shoulder_l', 'shoulder_r',
  'weapon', 'hip', 'mount', 'aura', 'nameplate', 'extraction', 'death', 'hands',
]);

export function isAttachSlot(slot) {
  return ATTACH_SLOTS.has(slot);
}
