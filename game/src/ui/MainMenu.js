// MainMenu — a deliberately sparse cinematic threshold into Deadwire.
// The lobby owns all game choices; this screen only establishes the world.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildAsset, mat, PALETTE } from '../assets.js';
import { disposeObjectTree } from '../render/dispose.js';
import { Stash } from '../systems/Stash.js';
import { RUNTIME } from '../config/runtime.js';

// Pixabay sources, free under the Pixabay Content License. Kept remote so the
// landing page stays light; the mechanical reactor bed is synthesized locally.
const CRAWL_SOUNDS = [
  'https://static.wikia.nocookie.net/dandys-world-fanon/images/c/cb/U_xu8o84gxds-medium-bug-crawling-quickly-sound-effect-449530.mp3/revision/latest?cb=20260418212646',
  'https://static.wikia.nocookie.net/dandys-world-fanon/images/c/c8/Dragon-studio-giant-spider-walking-511319.mp3/revision/latest?cb=20260418212850',
];

class ReactorSoundscape {
  constructor() {
    this.started = false;
    this.media = [];
  }

  start() {
    if (this.started) {
      this.context?.resume?.().catch(() => {});
      return;
    }
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    this.started = true;
    this.context = new AudioContext();
    this.master = this.context.createGain();
    this.master.gain.setValueAtTime(0.0001, this.context.currentTime);
    this.master.gain.exponentialRampToValueAtTime(0.12, this.context.currentTime + 2.6);
    this.master.connect(this.context.destination);

    const humFilter = this.context.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 190;
    humFilter.Q.value = 1.2;
    humFilter.connect(this.master);

    for (const [frequency, gainValue] of [[43, 0.34], [57, 0.12], [86, 0.06]]) {
      const oscillator = this.context.createOscillator();
      const gain = this.context.createGain();
      oscillator.type = frequency === 43 ? 'sawtooth' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = gainValue;
      oscillator.connect(gain).connect(humFilter);
      oscillator.start();
    }

    const bufferSize = this.context.sampleRate * 2;
    const noiseBuffer = this.context.createBuffer(1, bufferSize, this.context.sampleRate);
    const noise = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) noise[i] = (Math.random() * 2 - 1) * 0.18;
    const noiseSource = this.context.createBufferSource();
    const noiseFilter = this.context.createBiquadFilter();
    const noiseGain = this.context.createGain();
    noiseSource.buffer = noiseBuffer;
    noiseSource.loop = true;
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 720;
    noiseFilter.Q.value = 0.6;
    noiseGain.gain.value = 0.035;
    noiseSource.connect(noiseFilter).connect(noiseGain).connect(this.master);
    noiseSource.start();

    this._scheduleCrawl(1800);
  }

  _scheduleCrawl(delay = 6500 + Math.random() * 8000) {
    clearTimeout(this.crawlTimer);
    this.crawlTimer = setTimeout(() => {
      if (!this.started) return;
      const audio = new Audio(CRAWL_SOUNDS[Math.floor(Math.random() * CRAWL_SOUNDS.length)]);
      audio.volume = 0.08 + Math.random() * 0.06;
      audio.playbackRate = 0.82 + Math.random() * 0.3;
      this.media.push(audio);
      audio.play().catch(() => {});
      audio.onended = () => { this.media = this.media.filter((item) => item !== audio); };
      this._scheduleCrawl();
    }, delay);
  }

  stop() {
    if (!this.started) return;
    this.started = false;
    clearTimeout(this.crawlTimer);
    this.media.forEach((audio) => audio.pause());
    this.media = [];
    const now = this.context?.currentTime || 0;
    this.master?.gain.cancelScheduledValues(now);
    this.master?.gain.setTargetAtTime(0.0001, now, 0.22);
    setTimeout(() => this.context?.close().catch(() => {}), 1200);
  }
}

function reactorAudio() {
  if (!window.__deadwireReactorAudio) window.__deadwireReactorAudio = new ReactorSoundscape();
  return window.__deadwireReactorAudio;
}

export class MainMenu {
  constructor(root, { onPlay }) {
    this.root = root;
    this.onPlay = onPlay;
    this.running = false;
    this.entering = false;
    this.crawlers = [];
    this.warningLights = [];
    this.electricalLights = [];
    this.pointer = new THREE.Vector2();
    this._onPointerMove = (event) => {
      this.pointer.x = (event.clientX / Math.max(1, innerWidth) - 0.5) * 2;
      this.pointer.y = (event.clientY / Math.max(1, innerHeight) - 0.5) * 2;
    };
    this._build();
  }

  _build() {
    const profile = Stash.load().profile;
    const contract = RUNTIME.deadMint?.trim() || 'PENDING REACTOR LINK';
    const xUrl = RUNTIME.xUrl?.trim();

    this.el = document.createElement('div');
    this.el.className = 'start-screen';
    this.el.innerHTML = `
      <canvas id="reactorCanvas" aria-hidden="true"></canvas>
      <div class="start-grade"></div>
      <div class="start-noise"></div>
      <div class="start-content">
        <div class="start-mark" aria-label="Deadwire">
          <span>DEAD</span><b>WIRE</b>
        </div>
        <button class="enter-game" type="button">
          <span>ENTER GAME</span>
          <i></i>
        </button>
      </div>
      <footer class="start-links">
        <button class="contract-link" type="button" title="Copy contract address">
          <span>CA</span><b>${this._esc(contract)}</b>
        </button>
        <a ${xUrl
          ? `href="${this._esc(xUrl)}" target="_blank" rel="noopener noreferrer"`
          : 'class="is-pending" aria-disabled="true"'} aria-label="Deadwire on X">X</a>
      </footer>`;
    this.root.appendChild(this.el);

    this.el.addEventListener('pointerdown', () => reactorAudio().start(), { once: true, capture: true });
    this.el.querySelector('.enter-game').onclick = () => this._enter(profile);
    this.el.querySelector('.contract-link').onclick = async () => {
      if (!RUNTIME.deadMint?.trim()) return;
      await navigator.clipboard?.writeText(RUNTIME.deadMint.trim());
      const label = this.el.querySelector('.contract-link span');
      label.textContent = 'COPIED';
      setTimeout(() => { if (label) label.textContent = 'CA'; }, 1400);
    };
    addEventListener('pointermove', this._onPointerMove, { passive: true });
    this._initScene();
    reactorAudio().start();
  }

  _esc(value) {
    return String(value).replace(/[<>&"]/g, (char) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;',
    }[char]));
  }

  _enter(profile) {
    if (this.entering) return;
    this.entering = true;
    reactorAudio().start();
    this.el.classList.add('is-entering');
    const name = profile.onboarded ? profile.callsign : 'Runner';
    const loadout = {
      ...(profile.equipped || {}),
      _colors: { jacket: profile.tint || '#3b4a5a' },
      _primaryWeapon: profile.primaryWeapon || 'weapon_scrap_pistol',
    };
    setTimeout(() => {
      this.destroy();
      this.onPlay(loadout, false, name);
    }, 760);
  }

  _place(id, x, y, z, scale = 1, rotationY = 0, options) {
    const asset = buildAsset(id, options);
    asset.position.set(x, y, z);
    asset.scale.setScalar(scale);
    asset.rotation.y = rotationY;
    this.scene.add(asset);
    return asset;
  }

  _addElectricalFixture(x, y, z, {
    color = 0xffc85e,
    intensity = 10,
    distance = 10,
    vertical = false,
    phase = Math.random() * Math.PI * 2,
  } = {}) {
    const fixture = new THREE.Group();
    fixture.position.set(x, y, z);
    const housing = new THREE.Mesh(
      new THREE.BoxGeometry(vertical ? 0.24 : 1.15, vertical ? 1.15 : 0.24, 0.18),
      mat('#20292b', { metal: 0.72, rough: 0.48 }),
    );
    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(vertical ? 0.08 : 0.88, vertical ? 0.88 : 0.08, 0.05),
      mat(color, { emissive: color, emissiveIntensity: 5.5, rough: 0.2 }),
    );
    tube.position.z = 0.12;
    fixture.add(housing, tube);
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.z = 0.45;
    fixture.add(light);
    fixture.userData.electrical = { light, tube, intensity, phase };
    this.electricalLights.push(fixture);
    this.scene.add(fixture);
  }

  _initScene() {
    const canvas = this.el.querySelector('#reactorCanvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.7));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.38;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x071014);
    this.scene.fog = new THREE.FogExp2(0x071014, 0.038);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 160);
    this.camera.position.set(0.2, 2.15, 9.8);
    this.camera.lookAt(0, 1.2, -3.6);

    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(34, 44, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x182327, metalness: 0.58, roughness: 0.76 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.02, -8);
    this.scene.add(floor);

    const floorGrid = new THREE.GridHelper(34, 34, 0x334044, 0x151d20);
    floorGrid.position.z = -8;
    floorGrid.material.transparent = true;
    floorGrid.material.opacity = 0.34;
    this.scene.add(floorGrid);

    const wallMat = mat('#111719', { metal: 0.68, rough: 0.74 });
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(28, 14, 0.45), wallMat);
    backWall.position.set(0, 5.5, -17);
    this.scene.add(backWall);
    for (const x of [-11.5, -7.7, -3.9, 3.9, 7.7, 11.5]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.42, 11, 0.7), wallMat);
      rib.position.set(x, 4.5, -16.65);
      this.scene.add(rib);
    }
    for (const x of [-7.2, 7.2]) {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10, 30), wallMat);
      side.position.set(x, 4.2, -4);
      this.scene.add(side);
    }

    this._place('reactor_tower', 0, 0, -13.2, 2.3);
    this._place('obj_unstable_core', 0, 0.78, -4.9, 1.55);
    this._place('generator', -4.9, 0, -8.2, 1.45, 0.08);
    this._place('generator', 4.9, 0, -8.2, 1.45, -0.08);
    this._place('server_rack', -6.2, 0, -12.1, 1.25, Math.PI / 2);
    this._place('server_rack', 6.2, 0, -12.1, 1.25, -Math.PI / 2);
    this._place('vent', -3.7, 0, -3.5, 1.2, 0.2);
    this._place('vent', 3.8, 0, -2.6, 1.05, -0.3);
    this._place('pipe_run', -5.9, 3.7, -7.6, 1.55, Math.PI / 2);
    this._place('pipe_run', 5.9, 4.5, -9.7, 1.75, -Math.PI / 2);
    this._place('rail_track', 0, 0.012, -8, 1.1);
    this._place('prop_loot_crate', -2.7, 0, -8.4, 0.92, 0.55);
    this._place('prop_loot_crate', 3.4, 0, -11.2, 0.8, -0.34);
    this._addElectricalFixture(-5.75, 3.6, -2.2, { color: 0xffc85e, intensity: 13, distance: 12 });
    this._addElectricalFixture(5.75, 4.35, -4.8, { color: 0xf2f7ef, intensity: 15, distance: 13, vertical: true });
    this._addElectricalFixture(-5.75, 5.4, -10.4, { color: 0xffd36f, intensity: 11, distance: 11, vertical: true });
    this._addElectricalFixture(5.75, 2.2, -12.2, { color: 0xf7fbf2, intensity: 12, distance: 11 });
    this._addElectricalFixture(-3.9, 5.8, -16.35, { color: 0xf4f8ed, intensity: 15, distance: 14 });
    this._addElectricalFixture(3.9, 5.8, -16.35, { color: 0xffbd42, intensity: 14, distance: 14, phase: 1.8 });

    for (const [x, z, phase, scale] of [
      [-3.45, -0.8, 0.2, 1.08],
      [3.15, -2.5, 1.8, 0.92],
      [-4.8, -9.8, 3.4, 0.82],
      [4.7, -12.7, 4.8, 0.7],
      [1.2, -10.5, 6.1, 0.52],
    ]) {
      const crawler = this._place('enemy_crawler', x, 0, z, scale);
      crawler.userData.cinematic = { originX: x, originZ: z, phase, speed: 0.22 + scale * 0.08 };
      const eyeSpill = new THREE.PointLight(0xff4b24, scale > 0.9 ? 2.8 : 1.2, 3.2, 2);
      eyeSpill.position.set(0, 0.58, 0.48);
      crawler.add(eyeSpill);
      this.crawlers.push(crawler);
    }
    this.turret = this._place('enemy_turret', 4.8, 0, -6.8, 0.86, -2.2);
    this.hauler = this._place('enemy_hauler', -5.1, 0, -14.1, 0.9, 0.35);

    this.scene.add(new THREE.HemisphereLight(0xe8efe5, 0x1b1610, 1.28));
    this.scene.add(new THREE.AmbientLight(0xdce5df, 0.42));
    const coreLight = new THREE.PointLight(0xffc34e, 25, 18, 2);
    coreLight.position.set(0, 1.35, -4.6);
    this.scene.add(coreLight);
    this.coreLight = coreLight;
    const redLight = new THREE.PointLight(0xff311f, 10, 14, 2);
    redLight.position.set(-4.5, 2.4, -9);
    this.scene.add(redLight);
    this.redLight = redLight;
    const foregroundFill = new THREE.PointLight(0xf4f8ed, 12.5, 16, 2);
    foregroundFill.position.set(3.4, 1.25, 2.5);
    this.scene.add(foregroundFill);
    const crawlerRim = new THREE.PointLight(0xe94b2b, 8.8, 10, 2);
    crawlerRim.position.set(-4.4, 0.85, 1.2);
    this.scene.add(crawlerRim);
    const shaft = new THREE.SpotLight(0xffefc5, 21, 39, 0.42, 0.82, 1.8);
    shaft.position.set(1.5, 10, 2);
    shaft.target.position.set(0, 0, -7);
    this.scene.add(shaft, shaft.target);

    const dustGeometry = new THREE.BufferGeometry();
    const dust = new Float32Array(270 * 3);
    for (let i = 0; i < 270; i++) {
      dust[i * 3] = (Math.random() - 0.5) * 14;
      dust[i * 3 + 1] = Math.random() * 7;
      dust[i * 3 + 2] = 5 - Math.random() * 24;
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    this.dust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({ color: 0x9bb9b8, size: 0.025, transparent: true, opacity: 0.34 }),
    );
    this.scene.add(this.dust);

    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 720;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 1.18, 0.92, 0.57));
    this.composer.addPass(new OutputPass());
    this.clock = new THREE.Clock();
    this.running = true;
    this._loop();
  }

  _animateCrawler(crawler, time) {
    const c = crawler.userData.cinematic;
    const travel = Math.sin(time * c.speed + c.phase);
    crawler.position.x = c.originX + travel * 1.15;
    crawler.position.z = c.originZ + Math.cos(time * c.speed * 0.7 + c.phase) * 0.62;
    crawler.rotation.y = Math.atan2(
      Math.cos(time * c.speed + c.phase) * 1.15,
      -Math.sin(time * c.speed * 0.7 + c.phase) * 0.44,
    );
    const visual = crawler.userData.visualRoot;
    if (visual) visual.position.y = Math.abs(Math.sin(time * 5.8 + c.phase)) * 0.035;
    const legs = crawler.userData.rig?.joints?.filter((joint) => joint.group === 'legs') || [];
    legs.forEach((leg, index) => {
      leg.node.rotation.z = Math.sin(time * 7.2 + c.phase + index * Math.PI) * 0.22;
    });
    const head = crawler.getObjectByName('head');
    if (head) head.rotation.y = Math.sin(time * 0.9 + c.phase) * 0.48;
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    const time = this.clock.elapsedTime;
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * this.renderer.getPixelRatio()) ||
        canvas.height !== Math.floor(h * this.renderer.getPixelRatio())) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
      this.composer.setSize(w, h);
    }

    const targetX = this.pointer.x * 0.2 + Math.sin(time * 0.09) * 0.22;
    const targetY = 2.15 - this.pointer.y * 0.09 + Math.sin(time * 0.18) * 0.035;
    this.camera.position.x += (targetX - this.camera.position.x) * 0.012;
    this.camera.position.y += (targetY - this.camera.position.y) * 0.012;
    this.camera.position.z = 9.8 + Math.sin(time * 0.11) * 0.14;
    this.camera.lookAt(this.pointer.x * 0.16, 1.12 - this.pointer.y * 0.06, -4.1);

    this.crawlers.forEach((crawler) => this._animateCrawler(crawler, time));
    if (this.turret) this.turret.rotation.y = -2.2 + Math.sin(time * 0.24) * 0.72;
    if (this.hauler) this.hauler.position.z = -14.1 + Math.sin(time * 0.18) * 1.1;
    if (this.dust) this.dust.rotation.y = time * 0.006;
    this.coreLight.intensity = 18 + Math.sin(time * 2.1) * 4.2;
    this.redLight.intensity = Math.sin(time * 3.8) > 0.72 ? 12 : 3.8;
    this.electricalLights.forEach((fixture, index) => {
      const electric = fixture.userData.electrical;
      const flutter = Math.sin(time * (7.5 + index * 0.7) + electric.phase);
      const pulse = flutter > 0.93 ? 0.58 : 1;
      electric.light.intensity = electric.intensity * pulse;
      electric.tube.material.emissiveIntensity = 4.8 + pulse * 1.5;
    });
    this.composer.render(dt);
  }

  destroy() {
    this.running = false;
    removeEventListener('pointermove', this._onPointerMove);
    disposeObjectTree(this.scene);
    try { this.composer?.dispose?.(); } catch { /* noop */ }
    try { this.renderer?.dispose(); } catch { /* noop */ }
    this.el.remove();
  }
}
