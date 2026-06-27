import * as THREE from 'three';
import { buildAsset, mat, PALETTE } from '../assets.js';
import { makeSky } from '../render/Sky.js';
import { DistantBackdrop } from '../world/DistantBackdrop.js';
import { disposeObjectTree } from '../render/dispose.js';

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

export class LoadingScreen {
  constructor(root, { online = false, name = 'Runner' } = {}) {
    this.root = root;
    this.online = online;
    this.name = name;
    this.running = false;
    this.progress = 0;
    this._build();
  }

  _build() {
    this.el = document.createElement('div');
    this.el.className = 'loading-screen';
    this.el.innerHTML = `
      <canvas id="loadingCanvas"></canvas>
      <div class="loading-wash"></div>
      <div class="loading-top">
        <b>DEAD<span>WIRE</span></b>
        <i>${this.online ? 'SQUAD LINK' : 'PRIVATE RUN'}</i>
      </div>
      <div class="loading-panel">
        <small>BREAKER YARD</small>
        <h2 id="loadingStep">CREW LOCKED</h2>
        <div class="loading-runner">${this._esc(this.name)}</div>
        <div class="loading-bar"><span id="loadingFill"></span></div>
      </div>`;
    this.root.appendChild(this.el);
    this._initScene();
  }

  _esc(value) {
    return String(value).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  }

  _initScene() {
    const canvas = this.el.querySelector('#loadingCanvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x756d59, 18, 86);
    this.scene.add(makeSky({ top: '#1b2b35', horizon: '#756d59' }));
    this.backdrop = new DistantBackdrop({
      min: { x: -36, z: -24 },
      max: { x: 36, z: 24 },
    });
    this.backdrop.root.position.y = -0.2;
    this.scene.add(this.backdrop.root);
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 220);
    this.camera.position.set(0, 2.1, 7.7);
    this.camera.lookAt(0, 0.9, 0);

    this.scene.add(new THREE.HemisphereLight(0xcde8ff, 0x4a3a2c, 2.4));
    const key = new THREE.DirectionalLight(0xffe3bd, 3.2);
    key.position.set(4, 6, 4);
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5ee8ff, 2.1);
    rim.position.set(-5, 3, -3);
    this.scene.add(rim);

    this.assetRoot = new THREE.Group();
    this.scene.add(this.assetRoot);

    const core = buildAsset('obj_unstable_core');
    core.position.set(0, 0.95, 0);
    core.scale.setScalar(1.1);
    this.assetRoot.add(core);
    this.core = core;

    const crateL = buildAsset('prop_loot_crate');
    crateL.position.set(-1.7, 0.05, -0.35);
    crateL.rotation.y = -0.32;
    this.assetRoot.add(crateL);
    const crateR = buildAsset('prop_loot_crate');
    crateR.position.set(1.7, 0.05, -0.25);
    crateR.rotation.y = 0.35;
    this.assetRoot.add(crateR);

    const pistol = buildAsset('weapon_scrap_pistol');
    pistol.position.set(0, 0.22, 1.0);
    pistol.rotation.set(-0.2, Math.PI / 2, 0.08);
    pistol.scale.setScalar(1.2);
    this.assetRoot.add(pistol);

    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(2.25, 2.55, 0.18, 8),
      mat(PALETTE.steelDark, { metal: 0.35, rough: 0.55 }),
    );
    pad.position.y = -0.04;
    this.assetRoot.add(pad);

    this.running = true;
    this._loop();
  }

  async step(label, progress, ms = 260) {
    this.progress = Math.max(this.progress, progress);
    const fill = this.el.querySelector('#loadingFill');
    const step = this.el.querySelector('#loadingStep');
    if (fill) fill.style.width = `${Math.round(this.progress * 100)}%`;
    if (step) step.textContent = label;
    await wait(ms);
  }

  async intro() {
    await nextFrame();
    await this.step('CREW LOCKED', 0.18, 220);
    await this.step('ARMING RUNNER', 0.42, 260);
    await this.step('OPENING YARD GATE', 0.66, 280);
  }

  async finish() {
    await this.step('DEPLOYING', 1, 380);
    this.el.classList.add('out');
    await wait(280);
    this.destroy();
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (canvas.width !== w || canvas.height !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
    }
    const time = performance.now() * 0.001;
    this.backdrop?.update(time);
    this.assetRoot.rotation.y = Math.sin(time * 0.42) * 0.18;
    this.core.rotation.y += 0.018;
    this.core.position.y = 0.95 + Math.sin(time * 2.4) * 0.08;
    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    if (!this.el) return;
    this.running = false;
    disposeObjectTree(this.scene);
    try { this.renderer?.dispose(); } catch { /* noop */ }
    this.el.remove();
    this.el = null;
  }
}
