// ObjectiveIndicator — perspective-scaled world-space objective beacon.
// Sprites still billboard toward the camera, but size attenuation makes them
// feel anchored in the scene instead of behaving like full-size HUD cards.
import * as THREE from 'three';

const glowCanvas = document.createElement('canvas');
glowCanvas.width = glowCanvas.height = 256;
const glowCtx = glowCanvas.getContext('2d');
const glowGradient = glowCtx.createRadialGradient(128, 128, 4, 128, 128, 124);
glowGradient.addColorStop(0, 'rgba(255,255,255,0.95)');
glowGradient.addColorStop(0.18, 'rgba(255,255,255,0.5)');
glowGradient.addColorStop(0.55, 'rgba(255,255,255,0.12)');
glowGradient.addColorStop(1, 'rgba(255,255,255,0)');
glowCtx.fillStyle = glowGradient;
glowCtx.fillRect(0, 0, 256, 256);
const GLOW_TEXTURE = new THREE.CanvasTexture(glowCanvas);

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export class ObjectiveIndicator {
  constructor({ label, color = '#54f7c8', icon = '◆', height = 3.2 } = {}) {
    this.label = label || 'OBJECTIVE';
    this.color = color;
    this.icon = icon;
    this.height = height;
    this.t = 0;
    this.drawTimer = 0;
    this.lastText = '';

    this.root = new THREE.Group();
    this.root.name = `objective_indicator_${this.label.toLowerCase().replaceAll(' ', '_')}`;

    this.canvas = document.createElement('canvas');
    this.canvas.width = 768;
    this.canvas.height = 224;
    this.ctx = this.canvas.getContext('2d');
    this.texture = new THREE.CanvasTexture(this.canvas);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.minFilter = THREE.LinearFilter;

    const plateMaterial = new THREE.SpriteMaterial({
      map: this.texture,
      transparent: true,
      sizeAttenuation: true,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.plate = new THREE.Sprite(plateMaterial);
    this.plate.scale.set(3, 0.86, 1);
    this.plate.renderOrder = 1000;
    this.root.add(this.plate);

    const hotColor = new THREE.Color(color).multiplyScalar(2.2);
    const haloMaterial = new THREE.SpriteMaterial({
      map: GLOW_TEXTURE,
      color: hotColor,
      transparent: true,
      sizeAttenuation: true,
      opacity: 0.42,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.halo = new THREE.Sprite(haloMaterial);
    this.halo.scale.set(0.72, 0.72, 1);
    this.halo.renderOrder = 998;
    this.root.add(this.halo);

    const beaconMaterial = new THREE.MeshBasicMaterial({
      color: hotColor,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthTest: false,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    });
    this.pointer = new THREE.Mesh(new THREE.OctahedronGeometry(0.14, 0), beaconMaterial);
    this.pointer.renderOrder = 999;
    this.root.add(this.pointer);

    this.beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.018, 0.045, 1.25, 6, 1, true),
      beaconMaterial.clone(),
    );
    this.beam.material.opacity = 0.34;
    this.beam.renderOrder = 997;
    this.root.add(this.beam);

    this._draw('--', 'TEAM OBJECTIVE');
  }

  _draw(distance, status) {
    const key = `${distance}|${status}`;
    if (key === this.lastText) return;
    this.lastText = key;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 24;
    roundedRect(ctx, 26, 22, 716, 178, 30);
    ctx.fillStyle = 'rgba(8,13,16,0.9)';
    ctx.fill();
    ctx.restore();

    roundedRect(ctx, 26, 22, 716, 178, 30);
    ctx.lineWidth = 7;
    ctx.strokeStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 18;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.fillStyle = this.color;
    ctx.font = '900 72px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(this.icon, 95, 111);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#f5faf7';
    ctx.font = '900 46px system-ui, sans-serif';
    ctx.letterSpacing = '3px';
    ctx.fillText(this.label, 154, 82);

    ctx.fillStyle = this.color;
    ctx.font = '800 28px system-ui, sans-serif';
    ctx.fillText(`${status}  ·  ${distance}`, 156, 145);

    this.texture.needsUpdate = true;
  }

  setVisible(visible) { this.root.visible = !!visible; }

  update(dt, worldPosition, viewerPosition, status = 'TEAM OBJECTIVE') {
    this.t += dt;
    this.drawTimer -= dt;
    this.root.position.copy(worldPosition);

    const hover = Math.sin(this.t * 2.2) * 0.09;
    const y = this.height + hover;
    this.plate.position.y = y;
    this.halo.position.y = y;
    this.pointer.position.y = y - 0.52;
    this.beam.position.y = y - 1.15;
    this.pointer.rotation.y += dt * 1.8;
    this.pointer.rotation.x = Math.sin(this.t * 1.7) * 0.18;
    // Preserve perspective while gently compensating at long range. A nearby
    // marker remains several times larger on screen than a distant one.
    const meters = Math.max(1, worldPosition.distanceTo(viewerPosition));
    const distanceScale = THREE.MathUtils.clamp(Math.sqrt(meters / 18), 0.62, 1.9);
    const pulse = 1 + Math.sin(this.t * 3.5) * 0.08;
    this.plate.scale.set(3 * distanceScale, 0.86 * distanceScale, 1);
    this.halo.scale.set(0.72 * distanceScale * pulse, 0.72 * distanceScale * pulse, 1);

    if (this.drawTimer <= 0) {
      this.drawTimer = 0.2;
      this._draw(`${Math.round(meters)}m`, status);
    }
  }

  dispose() {
    this.texture.dispose();
    this.plate.material.dispose();
    this.halo.material.dispose();
    this.pointer.geometry.dispose();
    this.pointer.material.dispose();
    this.beam.geometry.dispose();
    this.beam.material.dispose();
  }
}
