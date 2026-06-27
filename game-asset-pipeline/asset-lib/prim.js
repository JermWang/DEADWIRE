// Deadwire asset-lib — low-level primitive helpers.
// Keep every builder terse and consistent. PS1/PS2 facet look uses flatShading.
import * as THREE from 'three';

const _geoCache = new Map();

function cachedGeometry(key, create) {
  if (_geoCache.has(key)) return _geoCache.get(key);
  const geometry = create();
  geometry.userData.deadwireShared = true;
  _geoCache.set(key, geometry);
  return geometry;
}

export function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(cachedGeometry(`box|${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function cyl(rTop, rBot, h, seg, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(cachedGeometry(`cyl|${rTop}|${rBot}|${h}|${seg}`, () => new THREE.CylinderGeometry(rTop, rBot, h, seg)), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

export function cylX(rTop, rBot, h, seg, mat, x = 0, y = 0, z = 0) {
  const m = cyl(rTop, rBot, h, seg, mat, x, y, z);
  m.rotation.z = Math.PI / 2;
  return m;
}

export function cylZ(rTop, rBot, h, seg, mat, x = 0, y = 0, z = 0) {
  const m = cyl(rTop, rBot, h, seg, mat, x, y, z);
  m.rotation.x = Math.PI / 2;
  return m;
}

export function sphere(r, mat, x = 0, y = 0, z = 0, detail = 0) {
  const m = new THREE.Mesh(cachedGeometry(`ico|${r}|${detail}`, () => new THREE.IcosahedronGeometry(r, detail)), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// Faceted capsule — nicer limb/joint silhouette than a box, still low-poly.
export function capsule(r, len, mat, x = 0, y = 0, z = 0, radial = 6, caps = 2) {
  const m = new THREE.Mesh(cachedGeometry(`capsule|${r}|${len}|${radial}|${caps}`, () => new THREE.CapsuleGeometry(r, len, caps, radial)), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// Cone (tapered cylinder to a point). seg low = faceted.
export function cone(r, h, seg, mat, x = 0, y = 0, z = 0) {
  return cyl(0.0001, r, h, seg, mat, x, y, z);
}

// Sloped plate — a thin box you can tilt for armor crests/ramps. Reliable winding
// (unlike a hand-rolled prism, which can cull faces under flat shading).
export function plate(w, h, d, mat, x = 0, y = 0, z = 0, tiltX = 0, tiltZ = 0) {
  const m = box(w, h, d, mat, x, y, z);
  m.rotation.x = tiltX; m.rotation.z = tiltZ;
  return m;
}

// A named, empty socket the game/studio can look up via getObjectByName().
export function socket(name, x = 0, y = 0, z = 0) {
  const o = new THREE.Object3D();
  o.name = name;
  o.position.set(x, y, z);
  o.userData.socket = true;
  return o;
}

export function group(name) {
  const g = new THREE.Group();
  g.name = name;
  return g;
}

// Count triangles + materials of a built asset (used by the studio QA readout).
export function inspect(object3d) {
  let triangles = 0;
  const materials = new Set();
  object3d.traverse((n) => {
    if (!n.isMesh) return;
    const g = n.geometry;
    if (g.index) triangles += g.index.count / 3;
    else if (g.attributes.position) triangles += g.attributes.position.count / 3;
    const m = n.material;
    (Array.isArray(m) ? m : [m]).forEach((mat) => materials.add(mat.uuid));
  });
  return { triangles: Math.round(triangles), materials: materials.size };
}
