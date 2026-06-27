// Deadwire master palette + material factory.
// Wii-voxel toy industrial: brighter blocks, simple contrast, readable energy cues.
// Every asset pulls colors from here so the whole game stays visually unified.
import * as THREE from 'three';

export const PALETTE = {
  // structure
  steel: '#8192a0',
  steelDark: '#344552',
  concrete: '#8b9694',
  concreteDark: '#596866',
  rust: '#c66a3a',
  rustDark: '#8d4930',
  scrap: '#a39578',
  cableBlack: '#202832',
  ground: '#6c7f87',
  groundDust: '#837967',
  // hazard / signal
  warningRed: '#f04b37',
  warningAmber: '#ffc347',
  hazardStripe: '#ffe05a',
  // energy
  coreGlow: '#50ffd6',
  coreHot: '#baffef',
  toxic: '#a8ff54',
  accentCyan: '#62cfff',
  signalViolet: '#9c76ff',
  // characters
  runnerJacket: '#2f78b7',
  runnerPants: '#263f66',
  runnerBoots: '#1c2733',
  runnerSkin: '#d7a26f',
  runnerPack: '#6e6750',
  // machines
  machineHull: '#66737c',
  machineHullDark: '#2e3b43',
  machineEye: '#ff563f',
  light: '#fff7d6',
};

// MeshStandardMaterial factory with PS1/PS2 flat shading by default.
// Plain (non-emissive, non-transparent) materials are SHARED via a cache — the
// runtime never mutates them, so reusing one instance cuts material count and
// draw-call material switches. Emissive/transparent materials (glow, fx, fades)
// are always fresh because the game animates them per-instance.
const _matCache = new Map();

export function mat(color, opts = {}) {
  const {
    rough = 0.92,
    metal = 0.05,
    emissive = null,
    emissiveIntensity = 1,
    flat = true,
    transparent = false,
    opacity = 1,
  } = opts;

  const cacheable = !emissive && !transparent;
  const hex = new THREE.Color(color).getHexString();
  const key = cacheable ? `${hex}|${rough}|${metal}|${flat}` : null;
  if (key && _matCache.has(key)) return _matCache.get(key);

  const m = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: rough,
    metalness: metal,
    flatShading: flat,
    transparent,
    opacity,
  });
  if (emissive) {
    m.emissive = new THREE.Color(emissive);
    m.emissiveIntensity = emissiveIntensity;
  }
  m.userData.deadwireShared = cacheable;
  if (key) _matCache.set(key, m);
  return m;
}
