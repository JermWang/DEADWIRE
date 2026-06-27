export function disposeObjectTree(root) {
  if (!root?.traverse) return;
  root.traverse((object) => {
    const geometry = object.geometry;
    if (geometry && !geometry.userData?.deadwireShared) geometry.dispose?.();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of materials) {
      if (!material || material.userData?.deadwireShared) continue;
      material.map?.dispose?.();
      material.dispose?.();
    }
  });
}
