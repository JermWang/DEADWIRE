// textures.js — procedural canvas textures (zero files, license-free). Subtle
// surface grunge breaks up flat solid colors so big surfaces read like a real
// game floor instead of a browser-toy plane.
import * as THREE from 'three';

// Multi-octave value-noise grunge tile (tileable-ish), tinted toward `base`.
export function groundTexture(base = '#454f57', repeat = 12) {
  const S = 256;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);

  // speckle noise (light + dark grains)
  const img = ctx.getImageData(0, 0, S, S);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * 26;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
  }
  ctx.putImageData(img, 0, 0);

  // larger blotches / stains
  for (let k = 0; k < 60; k++) {
    const x = Math.random() * S, y = Math.random() * S, r = 6 + Math.random() * 34;
    const dark = Math.random() < 0.55;
    ctx.fillStyle = dark ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.04)';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // a few cracks / streaks
  ctx.strokeStyle = 'rgba(0,0,0,0.10)';
  for (let k = 0; k < 10; k++) {
    ctx.lineWidth = 0.5 + Math.random() * 1.5;
    ctx.beginPath();
    let x = Math.random() * S, y = Math.random() * S;
    ctx.moveTo(x, y);
    for (let s = 0; s < 5; s++) { x += (Math.random() - 0.5) * 60; y += (Math.random() - 0.5) * 60; ctx.lineTo(x, y); }
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
