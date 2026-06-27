// Mount a weapon by its authored grip point, not by an approximate group offset.
// The grip point is transformed after rotation, then placed exactly at the hand.
export function mountWeaponToSocket(weapon, socket) {
  const mount = weapon.userData.handMount || {};
  if (mount.quaternion) weapon.quaternion.fromArray(mount.quaternion);
  else weapon.rotation.fromArray(mount.rotation || [0, 0, 0]);
  weapon.position.fromArray(mount.gripPoint || [0, 0, 0])
    .applyQuaternion(weapon.quaternion)
    .multiplyScalar(-1);
  socket.add(weapon);
  return weapon;
}
