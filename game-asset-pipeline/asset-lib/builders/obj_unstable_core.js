// obj_unstable_core — the match's high-value objective. Glowing caged energy core.
// userData.glow lets the game pulse the emissive each frame.
import * as THREE from 'three';
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { cyl, group, sphere, socket } from '../prim.js?v=wii-voxel-toy-v3';

export function build(opts = {}) {
  const { colors = {} } = opts;
  const C = { core: P.coreGlow, cage: P.steelDark, base: P.steel, ...colors };
  const coreMat = mat(C.core, { emissive: C.core, emissiveIntensity: 2.2, rough: 0.3 });
  const cage = mat(C.cage, { metal: 0.5, rough: 0.4 });
  const base = mat(C.base, { metal: 0.4 });

  const g = group('obj_unstable_core');
  g.add(cyl(0.26, 0.34, 0.12, 6, base, 0, 0.06, 0)); // base
  g.add(cyl(0.18, 0.24, 0.16, 6, cage, 0, 0.18, 0)); // inner pedestal
  const orb = sphere(0.22, coreMat, 0, 0.42, 0, 1);
  g.add(orb);
  g.userData.glow = orb;

  // two cage rings
  for (let i = 0; i < 2; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 12), cage);
    ring.position.y = 0.42;
    ring.rotation.x = i === 0 ? Math.PI / 2 : 0;
    g.add(ring);
  }
  // cage struts
  for (const a of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
    const strut = cyl(0.02, 0.02, 0.5, 4, cage, Math.cos(a) * 0.29, 0.42, Math.sin(a) * 0.29);
    g.add(strut);
  }

  g.add(socket('carry', 0, 0.42, 0));
  g.userData.radius = 0.4;
  g.userData.interactRange = 1.6;
  return g;
}

export const meta = {
  id: 'obj_unstable_core',
  displayName: 'Unstable Core',
  category: 'objective',
  budgets: { maxTriangles: 700, maxMaterials: 4 },
};
