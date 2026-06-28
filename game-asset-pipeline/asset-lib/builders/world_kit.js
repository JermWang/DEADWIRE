// world_kit — coded low-poly map kit for Breaker Yard.
// Each export is a self-contained parametric prop. The map definition places them.
// Props that block movement set userData.blocker + radius (or box half-extents).
import * as THREE from 'three';
import { mat, PALETTE as P } from '../palette.js?v=wii-voxel-toy-v3';
import { box, cyl, cylX, cylZ, cone, plate, group } from '../prim.js?v=wii-voxel-toy-v3';

// Big reactor centerpiece for the central pit. Pulses via userData.glow.
export function reactor_tower() {
  const g = group('reactor_tower');
  const shell = mat(P.steelDark, { metal: 0.5, rough: 0.4 });
  const ring = mat(P.rust);
  g.add(cyl(1.58, 1.72, 0.18, 8, shell, 0, 0.09, 0));      // buried foundation shoe
  // Segmented shell leaves sightlines to the unstable energy column.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const panel = box(0.68, 2.35, 0.16, shell, Math.cos(a) * 1.18, 1.36, Math.sin(a) * 1.18);
    panel.rotation.y = -a + Math.PI / 2;
    g.add(panel);
  }
  g.add(cyl(1.5, 1.5, 0.3, 8, ring, 0, 0.5, 0));
  g.add(cyl(1.3, 1.3, 0.2, 8, ring, 0, 2.2, 0));
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const rib = box(0.16, 2.35, 0.18, ring, Math.cos(a) * 1.12, 1.34, Math.sin(a) * 1.12);
    rib.rotation.y = -a;
    g.add(rib);
  }
  // Radial feet, service conduits, and a crown cage make the landmark feel assembled.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const foot = box(0.34, 0.22, 0.62, ring, Math.cos(a) * 1.48, 0.18, Math.sin(a) * 1.48);
    foot.rotation.y = -a;
    g.add(foot);
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    g.add(cyl(0.07, 0.09, 2.15, 6, ring, Math.cos(a) * 1.28, 1.22, Math.sin(a) * 1.28));
  }
  const glowMat = mat(P.coreGlow, { emissive: P.coreGlow, emissiveIntensity: 1.4 });
  const core = cyl(0.55, 0.55, 2.2, 6, glowMat, 0, 1.4, 0);
  g.add(core);
  g.add(cyl(0.72, 0.72, 0.08, 8, glowMat, 0, 2.55, 0));       // hot top aperture
  g.add(cyl(0.72, 0.72, 0.08, 8, glowMat, 0, 0.25, 0));       // hot base aperture
  g.add(cyl(0.92, 0.92, 0.1, 8, shell, 0, 2.72, 0));          // crown collar
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(box(0.08, 0.5, 0.08, ring, Math.cos(a) * 0.72, 2.94, Math.sin(a) * 0.72));
  }
  g.add(cyl(0.76, 0.76, 0.08, 8, ring, 0, 3.18, 0));
  g.userData.glow = core;
  g.userData.blocker = true;
  g.userData.radius = 1.5;
  return g;
}

export function generator() {
  const g = group('generator');
  const steel = mat(P.steel, { metal: 0.3 });
  const dark = mat(P.steelDark);
  const rust = mat(P.rust);
  const glow = mat(P.warningAmber, { emissive: P.warningAmber, emissiveIntensity: 1 });
  for (const sx of [-1, 1]) g.add(box(0.16, 0.12, 1.62, dark, 0.38 * sx, 0.06, 0)); // transport skids
  g.add(box(1.0, 0.9, 1.4, steel, 0, 0.45, 0));
  g.add(box(0.86, 0.12, 1.46, dark, 0, 0.88, 0));             // top service lip
  g.add(box(0.5, 0.4, 0.5, dark, 0.0, 1.0, 0));
  g.add(cyl(0.12, 0.12, 0.7, 6, rust, 0.5, 1.1, -0.4));       // exhaust pipe
  g.add(cyl(0.16, 0.12, 0.16, 6, rust, 0.5, 1.58, -0.4));     // exhaust cap
  g.add(box(0.5, 0.2, 0.04, dark, 0, 0.48, 0.72));            // front vent block
  g.add(box(0.2, 0.2, 0.06, glow, 0, 0.6, 0.71));
  // Service grille, side alternator housing, and battered access panel.
  for (let i = 0; i < 4; i++) g.add(box(0.08, 0.34, 0.035, dark, -0.3 + i * 0.2, 0.35, 0.725));
  g.add(cylZ(0.25, 0.25, 1.08, 8, dark, 0, 0.48, -0.42));
  g.add(cylZ(0.13, 0.13, 1.12, 6, rust, 0, 0.48, -0.43));
  g.add(box(0.05, 0.34, 0.46, rust, -0.51, 0.55, 0.16));
  g.add(cyl(0.09, 0.09, 0.08, 6, glow, -0.51, 0.73, 0.18));
  g.userData.blocker = true;
  g.userData.half = [0.5, 0.7]; // x,z half-extents
  return g;
}

export function vent() {
  const g = group('vent');
  const dark = mat(P.steelDark, { metal: 0.4 });
  const steel = mat(P.steel);
  const warn = mat(P.warningAmber);
  g.add(cyl(0.6, 0.7, 0.4, 8, dark, 0, 0.2, 0));
  g.add(cyl(0.72, 0.72, 0.08, 8, steel, 0, 0.43, 0));         // lip
  g.add(box(0.8, 0.04, 0.12, warn, 0, 0.48, 0));              // simple hazard bar
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.add(box(0.12, 0.08, 0.18, steel, Math.cos(a) * 0.62, 0.08, Math.sin(a) * 0.62));
  }
  const fan = group('fan');
  for (let i = 0; i < 4; i++) {
    const blade = box(0.5, 0.04, 0.12, steel, 0, 0, 0);
    blade.rotation.y = (i * Math.PI) / 2;
    fan.add(blade);
  }
  fan.add(cyl(0.12, 0.12, 0.06, 8, dark, 0, 0.02, 0));        // fan hub
  fan.position.y = 0.42;
  g.add(fan);
  // Protective cross-grid and side cooling fins.
  for (const a of [0, Math.PI / 4, Math.PI / 2, -Math.PI / 4]) {
    const guard = box(1.0, 0.025, 0.035, dark, 0, 0.5, 0);
    guard.rotation.y = a;
    g.add(guard);
  }
  for (const sx of [-1, 1]) g.add(box(0.1, 0.28, 0.5, warn, 0.55 * sx, 0.24, 0));
  g.userData.fan = fan; // game spins it
  g.userData.blocker = true;
  g.userData.radius = 0.7;
  return g;
}

export function terminal() {
  const g = group('terminal');
  const body = mat(P.steelDark, { metal: 0.3 });
  const glow = mat(P.accentCyan, { emissive: P.accentCyan, emissiveIntensity: 1.3 });
  g.add(box(0.74, 0.18, 0.36, body, 0, 0.09, 0));             // foot
  g.add(box(0.7, 1.0, 0.3, body, 0, 0.58, 0));
  const screen = box(0.5, 0.4, 0.04, glow, 0, 0.78, 0.16);
  screen.rotation.x = -0.2;
  g.add(screen);
  g.add(box(0.44, 0.08, 0.08, body, 0, 0.38, 0.18));          // keyboard shelf
  // Deep screen bezel, chunky keys, side junction box, and antenna.
  for (const sx of [-1, 1]) g.add(box(0.045, 0.48, 0.06, body, 0.28 * sx, 0.79, 0.17));
  for (const sy of [-1, 1]) g.add(box(0.6, 0.045, 0.06, body, 0, 0.79 + 0.24 * sy, 0.17));
  for (let i = 0; i < 4; i++) g.add(box(0.055, 0.025, 0.04, glow, -0.12 + i * 0.08, 0.43, 0.24));
  g.add(box(0.16, 0.38, 0.12, body, -0.42, 0.55, 0));
  g.add(cyl(0.018, 0.018, 0.5, 5, body, -0.42, 1.2, 0));
  g.add(box(0.16, 0.08, 0.05, glow, -0.42, 1.45, 0));
  g.userData.glow = screen;
  g.userData.blocker = true;
  g.userData.half = [0.35, 0.2];
  return g;
}

// Irregular stacked scrap wall. length in units (x). Acts as cover/blocker.
export function scrap_wall(opts = {}) {
  const { length = 3, height = 1.4 } = opts;
  const g = group('scrap_wall');
  const cols = Math.max(2, Math.round(length / 0.7));
  const rail = mat(P.steelDark, { metal: 0.25, rough: 0.7 });
  for (let i = 0; i < cols; i++) {
    const x = -length / 2 + (i + 0.5) * (length / cols);
    const h = height * (0.7 + ((i * 7) % 5) / 10);
    const c = i % 2 ? P.scrap : P.rust;
    g.add(box(length / cols + 0.04, h, 0.5, mat(c, { rough: 0.95 }), x, h / 2, 0));
    const patch = box(length / cols * 0.55, h * 0.35, 0.04, rail, x + (i % 2 ? -0.08 : 0.08), h * 0.48, 0.28);
    patch.rotation.z = (i % 3 - 1) * 0.12;
    g.add(patch);
  }
  g.add(box(length + 0.16, 0.08, 0.08, rail, 0, 0.88, 0.29)); // tie beam
  for (const sx of [-1, 1]) g.add(box(0.12, height + 0.25, 0.14, rail, sx * length * 0.48, height * 0.48, 0));
  const brace = box(0.1, height * 1.15, 0.1, rail, 0, height * 0.46, -0.28);
  brace.rotation.z = -0.72;
  g.add(brace);
  for (let i = 0; i < Math.max(2, cols - 1); i++) {
    g.add(box(0.05, 0.05, 0.08, mat(P.rust, { rough: 0.95 }), -length * 0.35 + i * (length * 0.7 / Math.max(1, cols - 2)), 0.92, 0.34));
  }
  g.userData.blocker = true;
  g.userData.half = [length / 2, 0.25];
  return g;
}

export function warning_light() {
  const g = group('warning_light');
  const dark = mat(P.steelDark);
  const red = mat(P.warningRed, { emissive: P.warningRed, emissiveIntensity: 1.8 });
  g.add(cyl(0.12, 0.16, 0.12, 6, dark, 0, 0.06, 0));
  g.add(cyl(0.06, 0.08, 1.4, 5, dark, 0, 0.76, 0));
  g.add(box(0.42, 0.06, 0.08, dark, 0, 1.32, 0));             // lamp bracket
  g.add(box(0.25, 0.28, 0.16, dark, 0, 0.34, 0));             // weatherproof relay box
  const bulb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.16, 0),
    red
  );
  bulb.position.y = 1.5;
  g.add(bulb);
  // Protective cage and rain hood.
  for (const sx of [-1, 1]) g.add(box(0.035, 0.38, 0.035, dark, 0.15 * sx, 1.5, 0));
  for (const sz of [-1, 1]) g.add(box(0.035, 0.38, 0.035, dark, 0, 1.5, 0.15 * sz));
  g.add(cyl(0.21, 0.16, 0.08, 6, dark, 0, 1.72, 0));
  g.userData.glow = bulb; // game pulses it
  g.userData.height = 1.66;
  return g;
}

export function rail_track(opts = {}) {
  const { length = 6 } = opts;
  const g = group('rail_track');
  const railMat = mat(P.steel, { metal: 0.5, rough: 0.5 });
  const tieMat = mat(P.rustDark);
  for (const sx of [-1, 1]) g.add(box(0.08, 0.08, length, railMat, 0.4 * sx, 0.08, 0));
  const ties = Math.round(length / 0.6);
  for (let i = 0; i < ties; i++) {
    const z = -length / 2 + (i + 0.5) * (length / ties);
    g.add(box(1.1, 0.06, 0.16, tieMat, 0, 0.04, z));
    if (i % 2 === 0) {
      g.add(box(0.18, 0.05, 0.22, tieMat, -0.62, 0.025, z + 0.08));
      g.add(box(0.22, 0.04, 0.16, tieMat, 0.64, 0.02, z - 0.06));
    }
  }
  for (const sx of [-1, 1]) {
    for (const z of [-length * 0.28, length * 0.28]) g.add(box(0.18, 0.035, 0.34, railMat, 0.4 * sx, 0.115, z));
  }
  return g;
}

// Low cover block runners can hide behind.
export function cover_block() {
  const g = group('cover_block');
  const concrete = mat(P.concrete, { rough: 0.95 });
  const warn = mat(P.warningAmber);
  g.add(box(1.2, 0.8, 0.6, concrete, 0, 0.4, 0));
  g.add(box(1.24, 0.12, 0.64, warn, 0, 0.74, 0));
  g.add(box(1.34, 0.12, 0.74, concrete, 0, 0.06, 0));         // broad chipped foot
  for (const sx of [-1, 1]) {
    const cheek = plate(0.16, 0.55, 0.64, concrete, 0.55 * sx, 0.42, 0, 0, -0.12 * sx);
    g.add(cheek);
    g.add(cyl(0.025, 0.025, 0.42, 5, warn, 0.42 * sx, 0.98, 0));
  }
  g.add(box(0.28, 0.06, 0.03, warn, -0.3, 0.42, 0.315));
  g.add(box(0.2, 0.05, 0.03, warn, 0.36, 0.28, 0.315));
  g.userData.blocker = true;
  g.userData.half = [0.6, 0.3];
  return g;
}

// Cargo container (warehouse / landmark, blocker).
export function container(opts = {}) {
  const { color = P.warningAmber } = opts;
  const g = group('container');
  const body = mat(color, { rough: 0.9 });
  const dark = mat(P.steelDark);
  g.add(box(3.0, 1.6, 1.4, body, 0, 0.8, 0));
  // rib lines
  for (let i = -1; i <= 1; i++) g.add(box(0.06, 1.6, 1.42, dark, i * 0.9, 0.8, 0));
  for (const y of [0.12, 1.48]) g.add(box(3.08, 0.08, 1.48, dark, 0, y, 0)); // rails
  // Corrugation, corner castings, and functional rear-door hardware.
  for (let i = -3; i <= 3; i++) {
    for (const sz of [-1, 1]) g.add(box(0.05, 1.28, 0.045, dark, i * 0.38, 0.8, 0.72 * sz));
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) g.add(box(0.12, 1.7, 0.12, dark, 1.5 * sx, 0.82, 0.7 * sz));
  }
  g.add(box(0.05, 1.2, 0.05, dark, -0.34, 0.8, 0.75));
  g.add(box(0.05, 1.2, 0.05, dark, 0.34, 0.8, 0.75));
  g.add(box(0.32, 0.05, 0.05, dark, 0, 0.72, 0.76));
  g.userData.blocker = true;
  g.userData.half = [1.5, 0.7];
  return g;
}

// ============================ flagship district props ============================

// Cooling tower — big hyperbolic landmark (waisted). Pulses via userData.glow.
export function cooling_tower() {
  const g = group('cooling_tower');
  const shell = mat(P.concreteDark, { rough: 0.95 });
  const rust = mat(P.rustDark);
  g.add(cyl(1.7, 3.0, 4.2, 10, shell, 0, 2.1, 0));          // flared base
  g.add(cyl(2.6, 1.7, 3.4, 10, shell, 0, 5.9, 0));          // flared top
  g.add(cyl(2.7, 2.7, 0.3, 10, rust, 0, 7.55, 0));           // rim
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const rib = box(0.12, 4.9, 0.12, rust, Math.cos(a) * 1.95, 3.1, Math.sin(a) * 1.95);
    rib.rotation.y = -a;
    g.add(rib);
  }
  g.add(cyl(2.1, 2.1, 0.08, 10, rust, 0, 4.8, 0));          // service band
  // Exterior buttresses, maintenance deck, and intake ducts sell the scale.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const buttress = box(0.28, 2.5, 0.5, rust, Math.cos(a) * 2.15, 1.3, Math.sin(a) * 2.15);
    buttress.rotation.y = -a;
    buttress.rotation.x = -0.12;
    g.add(buttress);
  }
  g.add(cyl(2.28, 2.28, 0.12, 10, rust, 0, 4.92, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(box(0.09, 0.52, 0.09, rust, Math.cos(a) * 2.24, 5.18, Math.sin(a) * 2.24));
  }
  for (const sx of [-1, 1]) g.add(cylX(0.32, 0.32, 1.5, 8, rust, 2.45 * sx, 0.55, 0));
  const glow = cyl(1.2, 1.2, 0.4, 8, mat(P.coreGlow, { emissive: P.coreGlow, emissiveIntensity: 0.9 }), 0, 0.3, 0);
  g.add(glow); g.userData.glow = glow;
  g.userData.blocker = true; g.userData.radius = 2.9;
  return g;
}

// Industrial silo — tall cylinder with a conical cap.
export function silo() {
  const g = group('silo');
  const steel = mat(P.steel, { metal: 0.4, rough: 0.5 });
  const rust = mat(P.rust);
  const dark = mat(P.steelDark);
  const glow = mat(P.warningAmber, { emissive: P.warningAmber, emissiveIntensity: 0.8 });
  g.add(cyl(0.95, 1.05, 4.4, 8, steel, 0, 2.2, 0));
  g.add(cone(1.05, 0.9, 8, rust, 0, 4.85, 0));
  for (let i = 0; i < 3; i++) g.add(cyl(1.07, 1.07, 0.1, 8, dark, 0, 1.0 + i * 1.3, 0)); // bands
  g.add(box(0.5, 0.06, 0.5, glow, 0, 0.4, 0.95));
  // Ladder, inspection hatch, base shoes, and transfer pipe.
  for (const sx of [-1, 1]) g.add(box(0.05, 3.5, 0.05, dark, 0.24 * sx, 2.15, 1.0));
  for (let i = 0; i < 8; i++) g.add(box(0.52, 0.04, 0.05, dark, 0, 0.55 + i * 0.43, 1.02));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.22, 0.32, 0.22, rust, 0.7 * sx, 0.16, 0.7 * sz));
  g.add(box(0.48, 0.62, 0.06, dark, 0, 2.55, 1.0));
  g.add(cylZ(0.11, 0.11, 0.9, 6, rust, -0.55, 0.75, 1.0));
  g.add(cyl(0.08, 0.08, 0.5, 6, rust, -0.55, 0.95, 1.4));
  g.userData.blocker = true; g.userData.radius = 1.1;
  return g;
}

// Horizontal fuel tank on supports with hazard stripes.
export function fuel_tank() {
  const g = group('fuel_tank');
  const steel = mat(P.steel, { metal: 0.45, rough: 0.45 });
  const warn = mat(P.warningAmber);
  const dark = mat(P.steelDark);
  const rust = mat(P.rust);
  const body = cyl(0.85, 0.85, 2.6, 10, steel, 0, 1.1, 0);
  body.rotation.z = Math.PI / 2; g.add(body);                // lying along x
  for (const sx of [-1, 1]) {
    g.add(cylX(0.86, 0.86, 0.12, 10, warn, 1.34 * sx, 1.1, 0)); // end caps
    g.add(box(0.18, 0.5, 0.8, dark, 0.8 * sx, 0.3, 0));         // legs
    g.add(plate(0.38, 0.16, 1.2, dark, 0.8 * sx, 0.55, 0, 0, 0.18 * sx));
  }
  g.add(cyl(0.1, 0.1, 0.4, 6, rust, 0, 1.7, 0));              // valve
  g.add(box(0.46, 0.06, 0.08, warn, 0, 1.86, 0.2));           // hazard label
  // Ladder, fill neck, valve wheel, and bolted saddle feet.
  for (const sx of [-1, 1]) g.add(box(0.05, 1.05, 0.05, dark, -0.5 + sx * 0.18, 0.75, 0.78));
  for (let i = 0; i < 4; i++) g.add(box(0.42, 0.04, 0.05, dark, -0.5, 0.35 + i * 0.25, 0.8));
  g.add(cyl(0.18, 0.14, 0.18, 8, rust, 0, 1.92, 0));
  for (let i = 0; i < 4; i++) {
    const spoke = box(0.04, 0.04, 0.42, warn, 0, 2.12, 0);
    spoke.rotation.y = i * Math.PI / 4;
    g.add(spoke);
  }
  g.userData.blocker = true; g.userData.half = [1.5, 0.9];
  return g;
}

// Pipe run — parallel pipes on low supports (connective tissue + low cover). length along z.
export function pipe_run(opts = {}) {
  const { length = 8 } = opts;
  const g = group('pipe_run');
  const pipe = mat(P.rust, { metal: 0.3, rough: 0.7 });
  const dark = mat(P.steelDark);
  const warn = mat(P.warningAmber);
  for (const [px, py] of [[-0.3, 0.5], [0, 0.7], [0.3, 0.5]]) {
    g.add(cylZ(0.12, 0.12, length, 8, pipe, px, py, 0));
    for (const z of [-length * 0.32, length * 0.32]) g.add(cylZ(0.16, 0.16, 0.1, 8, dark, px, py, z));
  }
  const n = Math.max(2, Math.round(length / 2.5));
  for (let i = 0; i < n; i++) {
    const z = -length / 2 + (i + 0.5) * (length / n);
    g.add(box(0.9, 0.7, 0.16, dark, 0, 0.35, z));
    g.add(box(1.02, 0.08, 0.3, dark, 0, 0.08, z));
  }
  g.add(cyl(0.08, 0.08, 0.42, 6, warn, 0.3, 0.92, 0));
  for (let i = 0; i < 4; i++) {
    const spoke = box(0.035, 0.035, 0.34, warn, 0.3, 1.14, 0);
    spoke.rotation.y = i * Math.PI / 4;
    g.add(spoke);
  }
  g.userData.blocker = true; g.userData.half = [0.5, length / 2];
  return g;
}

// Jersey/concrete barrier — angled cover. length along x.
export function barrier(opts = {}) {
  const { length = 2.4 } = opts;
  const g = group('barrier');
  const concrete = mat(P.concrete, { rough: 0.95 });
  const warn = mat(P.warningAmber);
  g.add(box(length, 0.5, 0.5, concrete, 0, 0.25, 0));   // wide base
  g.add(box(length, 0.5, 0.22, concrete, 0, 0.7, 0));   // narrow top
  g.add(box(length, 0.08, 0.24, warn, 0, 0.96, 0));     // hazard cap
  for (const sx of [-1, 1]) g.add(box(0.34, 0.14, 0.72, concrete, sx * length * 0.4, 0.08, 0));
  for (const sx of [-1, 0, 1]) g.add(box(0.22, 0.1, 0.04, warn, sx * length * 0.3, 0.62, 0.27));
  for (const sx of [-1, 1]) {
    g.add(box(0.04, 0.28, 0.04, warn, sx * length * 0.18, 1.08, 0));
    g.add(box(0.42, 0.04, 0.04, warn, sx * length * 0.18, 1.22, 0));
  }
  g.userData.blocker = true; g.userData.half = [length / 2, 0.25];
  return g;
}

// Server rack — flooded-data-center district. Cyan-lit slot stack.
export function server_rack() {
  const g = group('server_rack');
  const body = mat(P.machineHullDark, { metal: 0.4, rough: 0.5 });
  const dark = mat(P.steelDark);
  g.add(box(1.0, 2.0, 0.7, body, 0, 1.0, 0));
  const lit = mat(P.accentCyan, { emissive: P.accentCyan, emissiveIntensity: 1.0 });
  for (let i = 0; i < 4; i++) g.add(box(0.8, 0.14, 0.04, lit, 0, 0.45 + i * 0.34, 0.36));   // slot lights
  for (const sx of [-1, 1]) g.add(box(0.06, 1.86, 0.76, dark, 0.5 * sx, 1.0, 0));            // rails
  g.add(box(1.06, 0.12, 0.74, dark, 0, 1.95, 0));                                           // top
  // Fan modules, cable trunk, feet, and a damaged service door.
  for (const sx of [-1, 1]) {
    g.add(cylZ(0.14, 0.14, 0.06, 8, dark, 0.25 * sx, 1.7, 0.38));
    g.add(box(0.14, 0.06, 0.05, lit, 0.25 * sx, 1.7, 0.42));
    g.add(box(0.16, 0.12, 0.16, dark, 0.34 * sx, 0.06, 0));
  }
  g.add(box(0.12, 1.5, 0.1, dark, -0.62, 0.85, -0.22));
  const door = box(0.42, 0.7, 0.05, body, 0.48, 0.9, -0.38);
  door.rotation.y = -0.3;
  g.add(door);
  g.userData.blocker = true; g.userData.half = [0.5, 0.35];
  return g;
}

// Shanty — black-market settlement shack with a slanted corrugated roof.
export function shanty(opts = {}) {
  const { color = P.scrap } = opts;
  const g = group('shanty');
  const wall = mat(color, { rough: 0.95 });
  const roof = mat(P.rust);
  const black = mat(P.cableBlack);
  const sign = mat(P.warningAmber, { emissive: P.warningAmber, emissiveIntensity: 1.0 });
  g.add(box(2.0, 1.6, 1.8, wall, 0, 0.8, 0));                  // body
  g.add(box(0.42, 0.28, 0.05, black, -0.58, 1.0, 0.95));      // dark window
  g.add(plate(2.2, 0.12, 2.0, roof, 0, 1.7, 0, -0.18));       // slanted roof
  g.add(cyl(0.09, 0.11, 0.48, 6, roof, -0.68, 1.96, -0.42));  // stove pipe
  g.add(box(0.7, 1.1, 0.06, black, 0, 0.55, 0.91));           // dark doorway
  g.add(box(0.3, 0.1, 0.06, sign, 0.6, 1.3, 0.92));           // sign light
  // Patched wall planks, roof ribs, awning, antenna, and doorstep clutter.
  for (let i = 0; i < 5; i++) {
    const plank = box(0.32, 1.25, 0.05, i % 2 ? wall : roof, -0.78 + i * 0.39, 0.72, -0.92);
    plank.rotation.z = (i % 2 ? 0.04 : -0.05);
    g.add(plank);
  }
  for (let i = -2; i <= 2; i++) g.add(box(0.06, 0.12, 2.08, black, i * 0.42, 1.74, 0));
  const awning = plate(1.25, 0.07, 0.72, roof, 0.35, 1.48, 1.12, -0.25);
  g.add(awning);
  g.add(cyl(0.02, 0.02, 1.1, 5, black, 0.78, 2.25, -0.55));
  g.add(box(0.4, 0.32, 0.35, wall, -0.72, 0.16, 1.04));
  g.add(box(0.7, 0.05, 0.18, sign, 0.35, 1.58, 1.28));
  g.userData.blocker = true; g.userData.half = [1.0, 0.9];
  return g;
}

// Market stall — open frame with canopy (settlement flavor, partial cover).
export function market_stall(opts = {}) {
  const { color = P.warningRed } = opts;
  const g = group('market_stall');
  const pole = mat(P.steelDark);
  const canopy = mat(color, { rough: 0.9 });
  const scrap = mat(P.scrap);
  const toxic = mat(P.toxic, { emissive: P.toxic, emissiveIntensity: 0.4 });
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.add(cyl(0.05, 0.05, 1.4, 5, pole, 0.8 * sx, 0.7, 0.6 * sz));
  g.add(plate(1.9, 0.08, 1.5, canopy, 0, 1.45, 0, -0.12)); // canopy
  g.add(box(1.7, 0.5, 0.4, scrap, 0, 0.6, -0.4));           // counter
  g.add(box(0.3, 0.3, 0.3, toxic, 0.4, 1.0, -0.4));         // goods crate
  g.add(box(0.34, 0.12, 0.04, toxic, 0, 1.18, -0.66));      // hanging sign
  // Canopy ribs, striped valance, varied stock, and hanging work lights.
  for (const sx of [-1, 0, 1]) g.add(box(0.05, 0.1, 1.55, pole, sx * 0.62, 1.48, 0));
  for (const sx of [-1, 1]) g.add(box(0.42, 0.12, 0.05, canopy, 0.48 * sx, 1.32, -0.76));
  g.add(box(0.26, 0.22, 0.25, scrap, -0.42, 0.98, -0.4));
  g.add(box(0.18, 0.36, 0.18, toxic, 0.02, 1.02, -0.38));
  for (const sx of [-1, 1]) {
    g.add(cyl(0.018, 0.018, 0.32, 5, pole, 0.5 * sx, 1.22, 0.25));
    g.add(box(0.12, 0.1, 0.12, toxic, 0.5 * sx, 1.04, 0.25));
  }
  g.userData.blocker = true; g.userData.half = [0.9, 0.6];
  return g;
}

// Light tower — tall floodlight pole (atmosphere). Pulses via userData.glow.
export function light_tower() {
  const g = group('light_tower');
  const dark = mat(P.steelDark, { metal: 0.4 });
  g.add(cyl(0.18, 0.24, 0.16, 6, dark, 0, 0.08, 0));              // base plate
  g.add(cyl(0.1, 0.14, 4.6, 6, dark, 0, 2.3, 0));
  g.add(box(1.2, 0.12, 0.2, dark, 0, 4.5, 0));                 // crossbar
  // Tripod braces and a waist-high junction box keep the pole grounded.
  for (const sx of [-1, 1]) {
    const brace = box(0.08, 1.7, 0.08, dark, 0.42 * sx, 0.78, 0);
    brace.rotation.z = -0.45 * sx;
    g.add(brace);
  }
  g.add(box(0.34, 0.48, 0.22, dark, 0, 1.1, 0.12));
  g.add(box(0.18, 0.08, 0.04, dark, 0, 1.18, 0.25));
  const lamp = mat(P.light, { emissive: P.light, emissiveIntensity: 1.2 });
  let lastLamp = null;
  for (const sx of [-1, 1]) {
    lastLamp = box(0.3, 0.2, 0.18, lamp, 0.4 * sx, 4.45, 0.06);
    g.add(lastLamp);
    g.add(box(0.36, 0.05, 0.2, dark, 0.4 * sx, 4.6, 0.04));    // lamp hood
  }
  g.userData.glow = lastLamp;
  g.userData.height = 4.7;
  return g;
}

// Rough grass patch — low-cost voxel tufts with a dead, uneven wasteland
// palette. Instanced meshes keep broad vegetation fields inexpensive.
export function rough_grass_patch(opts = {}) {
  const { radius = 1.4, lushness = 0.55 } = opts;
  const g = group('rough_grass_patch');
  const soil = mat('#454331', { rough: 1, transparent: true, opacity: 0.58 });
  const grass = mat(lushness > 0.65 ? '#4f6d42' : '#625f3f', { rough: 1 });
  const dryTips = mat(lushness > 0.65 ? '#78925b' : '#8a7b4d', { rough: 1 });
  const patch = new THREE.Mesh(new THREE.CircleGeometry(radius, 10), soil);
  patch.rotation.x = -Math.PI / 2;
  patch.position.y = 0.009;
  patch.receiveShadow = true;
  g.add(patch);

  const tuftCount = Math.max(12, Math.round(14 + lushness * 14));
  const tufts = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.1, 0.38, 0.16),
    grass,
    tuftCount,
  );
  const tallCount = Math.max(8, Math.round(8 + lushness * 10));
  const tallBlades = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.045, 0.62, 0.07),
    grass,
    tallCount,
  );
  const tipCount = Math.max(4, Math.round(4 + lushness * 6));
  const tips = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.09, 0.055, 0.09),
    dryTips,
    tipCount,
  );
  const dummy = new THREE.Object3D();
  for (let i = 0; i < tuftCount; i++) {
    const angle = i * 2.399963 + radius * 0.61;
    const distance = radius * (0.16 + ((i * 37) % 73) / 104);
    const height = 0.55 + ((i * 17) % 43) / 100;
    const lean = (i % 5 - 2) * 0.08;
    dummy.position.set(Math.cos(angle) * distance, height * 0.19, Math.sin(angle) * distance);
    dummy.rotation.set(lean, angle, (i % 3 - 1) * 0.16);
    dummy.scale.set(0.75 + (i % 4) * 0.14, height, 0.85 + (i % 3) * 0.12);
    dummy.updateMatrix();
    tufts.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < tallCount; i++) {
    const angle = i * 2.77 + radius * 0.38;
    const distance = radius * (0.12 + ((i * 29) % 68) / 112);
    const height = 0.72 + ((i * 19) % 42) / 100;
    dummy.position.set(Math.cos(angle) * distance, height * 0.24, Math.sin(angle) * distance);
    dummy.rotation.set((i % 4 - 1.5) * 0.12, angle + Math.PI * 0.25, (i % 5 - 2) * 0.1);
    dummy.scale.set(1, height, 1);
    dummy.updateMatrix();
    tallBlades.setMatrixAt(i, dummy.matrix);
  }
  for (let i = 0; i < tipCount; i++) {
    const angle = i * 2.19 + radius * 0.9;
    const distance = radius * (0.2 + ((i * 41) % 57) / 105);
    dummy.position.set(Math.cos(angle) * distance, 0.34 + (i % 4) * 0.035, Math.sin(angle) * distance);
    dummy.rotation.set(0, angle, (i % 2 ? 1 : -1) * 0.12);
    dummy.scale.setScalar(0.75 + (i % 3) * 0.16);
    dummy.updateMatrix();
    tips.setMatrixAt(i, dummy.matrix);
  }
  for (const mesh of [tufts, tallBlades, tips]) {
    mesh.castShadow = false;
    mesh.receiveShadow = true;
    g.add(mesh);
  }
  return g;
}

// Dead shrub — now reads as a chunky voxel bush: angular branch bones with
// blocky leaf/needle masses instead of sparse sticks.
export function dead_shrub(opts = {}) {
  const { green = false } = opts;
  const g = group('dead_shrub');
  const wood = mat('#514739', { rough: 1 });
  const dark = mat(green ? '#2f4b39' : '#4d4d36', { rough: 1 });
  const mid = mat(green ? '#456947' : '#68613f', { rough: 1 });

  const addBlock = (w, h, d, material, x, y, z, rot = 0) => {
    const clump = box(w, h, d, material, x, y, z);
    clump.rotation.y = rot;
    clump.castShadow = true;
    g.add(clump);
    return clump;
  };
  const addBranch = (w, h, d, x, y, z, rotY, tiltZ) => {
    const branch = box(w, h, d, wood, x, y, z);
    branch.rotation.y = rotY;
    branch.rotation.z = tiltZ;
    g.add(branch);
  };

  addBlock(0.32, 0.2, 0.24, wood, 0, 0.12, 0, 0.2);
  for (let i = 0; i < 6; i++) {
    const angle = (i / 6) * Math.PI * 2 + 0.18;
    const length = 0.42 + (i % 3) * 0.08;
    addBranch(0.07, length, 0.08, Math.cos(angle) * 0.18, 0.3 + (i % 2) * 0.06, Math.sin(angle) * 0.18, angle, (i % 2 ? 1 : -1) * 0.34);
  }
  const blocks = [
    [0.5, 0.32, 0.42, dark, 0, 0.42, 0, 0.12],
    [0.38, 0.26, 0.34, mid, -0.32, 0.36, 0.08, -0.2],
    [0.42, 0.3, 0.32, mid, 0.34, 0.38, -0.06, 0.28],
    [0.34, 0.24, 0.36, dark, 0.08, 0.3, 0.33, -0.08],
    [0.34, 0.22, 0.32, mid, -0.1, 0.32, -0.34, 0.35],
    [0.3, 0.24, 0.26, dark, -0.44, 0.48, -0.22, 0.12],
    [0.28, 0.22, 0.3, mid, 0.46, 0.5, 0.22, -0.28],
    [0.32, 0.24, 0.28, green ? mid : dark, 0.04, 0.66, 0.02, 0.22],
    [0.2, 0.18, 0.22, mid, -0.18, 0.62, 0.28, -0.18],
    [0.22, 0.16, 0.2, dark, 0.24, 0.62, -0.26, 0.18],
  ];
  blocks.forEach((args) => addBlock(...args));
  g.userData.radius = 0.56;
  return g;
}

// Evergreen — stacked faceted cones in the chunky coded-kit language.
export function evergreen_tree(opts = {}) {
  const { height = 5.5, dead = false } = opts;
  const g = group('evergreen_tree');
  const trunk = mat('#4b392c', { rough: 1 });
  const dark = mat(dead ? '#4f4a3b' : '#273f37', { rough: 1 });
  const mid = mat(dead ? '#625942' : '#355443', { rough: 1 });
  g.add(cyl(0.14, 0.25, height * 0.62, 6, trunk, 0, height * 0.31, 0));
  for (let i = 0; i < 4; i++) {
    const tierHeight = height * (0.28 - i * 0.025);
    const y = height * (0.42 + i * 0.14);
    const radius = height * (0.24 - i * 0.035);
    g.add(cone(radius, tierHeight, 7, i % 2 ? dark : mid, 0, y, 0));
  }
  g.userData.blocker = true;
  g.userData.radius = 0.55;
  return g;
}
