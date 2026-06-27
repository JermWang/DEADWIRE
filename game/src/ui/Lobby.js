// Lobby — pre-match squad assembly screen with a live 3D party lineup.
// The layout follows familiar squad-lobby conventions while keeping Deadwire's
// own reactor-yard visual language and a lightweight real party protocol.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildAsset, mat, mountWeaponToSocket, PALETTE } from '../assets.js';
import { makeSky } from '../render/Sky.js';
import { DistantBackdrop } from '../world/DistantBackdrop.js';
import { disposeObjectTree } from '../render/dispose.js';
import { Stash } from '../systems/Stash.js';
import { matchWsBase } from '../config/runtime.js';

const MAX_PARTY = 4;

function makePartyCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let value = 'DW-';
  for (let i = 0; i < 5; i++) value += chars[Math.floor(Math.random() * chars.length)];
  return value;
}

class PartyClient {
  constructor({ onRoster, onStatus, onLaunch }) {
    this.onRoster = onRoster;
    this.onStatus = onStatus;
    this.onLaunch = onLaunch;
  }

  connect(code, name) {
    this.disconnect();
    this.lastError = '';
    const url = `${matchWsBase()}/lobby?party=${encodeURIComponent(code)}&name=${encodeURIComponent(name)}`;
    this.onStatus('CONNECTING');
    try { this.ws = new WebSocket(url); }
    catch { this.onStatus('PARTY SERVER OFFLINE'); return; }
    this.ws.onopen = () => this.onStatus('PARTY ONLINE');
    this.ws.onmessage = (event) => {
      let message; try { message = JSON.parse(event.data); } catch { return; }
      if (message.t === 'lobby_roster') this.onRoster(message);
      if (message.t === 'lobby_launch') this.onLaunch();
      if (message.t === 'lobby_error') {
        this.lastError = message.message || 'PARTY ERROR';
        this.onStatus(this.lastError);
      }
    };
    this.ws.onerror = () => this.onStatus('PARTY SERVER OFFLINE');
    this.ws.onclose = () => this.onStatus(this.lastError || 'PARTY DISCONNECTED');
  }

  update(payload) { this.send({ t: 'lobby_update', ...payload }); }
  launch() { this.send({ t: 'lobby_launch' }); }
  send(message) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }
  disconnect() { try { this.ws?.close(); } catch { /* noop */ } this.ws = null; }
}

export class Lobby {
  constructor(root, { loadout = {}, online = false, name = 'Runner', onDeploy, onBack }) {
    this.root = root;
    this.loadout = loadout;
    this.online = online;
    this.name = name;
    this.onDeploy = onDeploy;
    this.onBack = onBack;
    this.partyCode = new URLSearchParams(location.search).get('party') || makePartyCode();
    this.members = [{ id: 'local', name, ready: false, leader: true }];
    this.localReady = false;
    this.partyStatus = online ? 'CONNECTING' : 'SOLO PARTY';
    this.running = false;
    this.deploying = false;
    this.platforms = [];
    this._build();
  }

  _build() {
    const stash = Stash.load();
    this.el = document.createElement('div');
    this.el.className = 'lobby';
    this.el.innerHTML = `
      <canvas id="lobbyCanvas"></canvas>
      <div class="lobby-wash"></div>
      <header class="lobby-top">
        <button class="lobby-brand" data-act="back">DEAD<span>WIRE</span></button>
        <nav class="lobby-nav">
          <button class="on">LOBBY</button>
          <button data-act="loadout">LOADOUT</button>
          <button data-act="career">CAREER</button>
        </nav>
        <div class="lobby-wallet"><span>SEASON ZERO</span><b>LV ${stash.level}</b><i>${stash.xp} XP</i></div>
      </header>

      <aside class="lobby-social glass">
        <div class="panel-kicker">SQUAD CHANNEL</div>
        <div class="party-code-row">
          <div><small>PARTY CODE</small><b id="partyCode">${this.partyCode}</b></div>
          <button data-act="copy">COPY</button>
        </div>
        <div class="party-status" id="partyStatus">${this.partyStatus}</div>
        <div class="party-roster" id="partyRoster"></div>
        <div class="join-party">
          <input id="joinCode" maxlength="12" placeholder="ENTER PARTY CODE" />
          <button data-act="join">JOIN</button>
        </div>
        <div class="social-rule"></div>
        <div class="panel-kicker">RECENT RUNNERS</div>
        <div class="recent-empty">Runners from online raids appear here.<br/>Share your party code to squad up.</div>
      </aside>

      <main class="lobby-stage">
        <div class="lobby-chapter">
          <small>REACTOR DISTRICT // SEASON ZERO</small>
          <h1>ASSEMBLE YOUR CREW</h1>
          <p>The yard is unstable. Nobody extracts alone by accident.</p>
        </div>
        <div class="stage-labels" id="stageLabels"></div>
      </main>

      <aside class="lobby-command">
        <section class="mode-card glass">
          <div class="mode-art">
            <span>CORE RUN</span>
            <b>BREAKER YARD</b>
            <small>4 RUNNERS · PvPvE · 8 MIN</small>
          </div>
          <div class="mode-choices" aria-label="Game mode">
            <button data-act="setSolo" class="${this.online ? '' : 'on'}">
              <span>SOLO</span><b>PRIVATE RUN</b>
            </button>
            <button data-act="setOnline" class="${this.online ? 'on' : ''}">
              <span>MULTIPLAYER</span><b>ONLINE PARTY</b>
            </button>
          </div>
        </section>
        <section class="mission-card glass">
          <div class="panel-kicker">FIELD DIRECTIVES</div>
          <div class="directive"><span>Extract successfully</span><b>${Math.min(stash.extractions, 3)} / 3</b></div>
          <div class="directive"><span>Extract a reactor core</span><b>${Math.min(stash.items?.['Reactor Core'] || 0, 1)} / 1</b></div>
          <div class="directive"><span>Recover machine parts</span><b>${Math.min(stash.items?.Parts || 0, 12)} / 12</b></div>
        </section>
        <button class="ready-btn" id="readyBtn" data-act="ready"></button>
        <div class="ready-note" id="readyNote"></div>
      </aside>

      <footer class="lobby-bottom glass">
        <button data-act="back">← START SCREEN</button>
        <div class="loadout-strip">
          <span><small>PRIMARY</small>SCRAP PISTOL</span>
          <span><small>SECONDARY</small>BURST RIFLE</span>
          <span><small>HEAVY</small>ARC SHOTGUN</span>
        </div>
        <div class="lobby-motto">STEAL THE CORE. OUTRUN THE YARD.</div>
      </footer>`;
    this.root.appendChild(this.el);

    this.el.querySelectorAll('[data-act]').forEach((button) => {
      button.onclick = () => this._action(button.dataset.act);
    });

    this.party = new PartyClient({
      onRoster: (message) => {
        this.partyCode = message.partyCode;
        this.members = message.members.slice(0, MAX_PARTY);
        const mine = this.members.find((member) => member.name === this.name);
        if (mine) this.localReady = mine.ready;
        this._renderParty();
      },
      onStatus: (status) => {
        this.partyStatus = status;
        this.el.querySelector('#partyStatus').textContent = status;
        this._renderReady();
      },
      onLaunch: () => this._deploy(true),
    });

    this._initScene();
    this._renderParty();
    if (this.online) this.party.connect(this.partyCode, this.name);
  }

  _action(action) {
    if (action === 'back') {
      this.destroy();
      this.onBack();
      return;
    }
    if (action === 'copy') {
      const link = `${location.origin}${location.pathname}?party=${this.partyCode}`;
      navigator.clipboard?.writeText(link);
      this.el.querySelector('#partyStatus').textContent = 'INVITE LINK COPIED';
      return;
    }
    if (action === 'join') {
      const code = this.el.querySelector('#joinCode').value.trim().toUpperCase();
      if (!code) return;
      this.partyCode = code;
      this.online = true;
      this.localReady = false;
      this.party.connect(code, this.name);
      this._renderParty();
      return;
    }
    if (action === 'setSolo' || action === 'setOnline') {
      const nextOnline = action === 'setOnline';
      if (nextOnline === this.online) return;
      this.online = nextOnline;
      this.localReady = false;
      if (this.online) this.party.connect(this.partyCode, this.name);
      else {
        this.party.disconnect();
        this.members = [{ id: 'local', name: this.name, ready: false, leader: true }];
        this.partyStatus = 'SOLO PARTY';
      }
      this._renderParty();
      return;
    }
    if (action === 'loadout') {
      this.el.querySelector('.lobby-bottom').classList.toggle('expanded');
      return;
    }
    if (action === 'career') {
      this.el.querySelector('.mission-card').classList.toggle('spotlight');
      return;
    }
    if (action === 'ready') this._ready();
  }

  _ready() {
    if (!this.online) return this._deploy(false);
    const me = this.members.find((member) => member.name === this.name);
    const isLeader = me?.leader ?? this.members.length <= 1;
    const allReady = this.members.length > 0 && this.members.every((member) => member.ready);
    if (this.localReady && isLeader && allReady) {
      this.party.launch();
      return;
    }
    this.localReady = !this.localReady;
    this.party.update({ name: this.name, ready: this.localReady });
    this._renderReady();
  }

  _deploy(online) {
    if (this.deploying) return;
    this.deploying = true;
    const loadout = { ...this.loadout };
    this.destroy();
    this.onDeploy(loadout, online, this.name);
  }

  _renderParty() {
    this.el.querySelector('#partyCode').textContent = this.partyCode;
    this.el.querySelector('#partyStatus').textContent = this.partyStatus;
    this.el.querySelector('[data-act="setSolo"]')?.classList.toggle('on', !this.online);
    this.el.querySelector('[data-act="setOnline"]')?.classList.toggle('on', this.online);

    const roster = this.el.querySelector('#partyRoster');
    roster.innerHTML = '';
    for (let i = 0; i < MAX_PARTY; i++) {
      const member = this.members[i];
      const row = document.createElement('div');
      row.className = `party-member ${member?.ready ? 'ready' : ''} ${member ? '' : 'empty'}`;
      row.innerHTML = member
        ? `<i>${member.leader ? '★' : '◆'}</i><span>${member.name}<small>${member.leader ? 'PARTY LEADER' : member.ready ? 'READY' : 'IN LOBBY'}</small></span><b>${member.ready ? '✓' : '…'}</b>`
        : `<i>＋</i><span>OPEN SLOT<small>INVITE A RUNNER</small></span><b></b>`;
      roster.appendChild(row);
    }

    const labels = this.el.querySelector('#stageLabels');
    labels.innerHTML = this.members.map((member, index) =>
      `<div data-slot="${index}" class="${member.ready ? 'ready' : ''}"><b>${member.name}</b><span>${member.ready ? 'READY' : member.leader ? 'LEADER' : 'NOT READY'}</span></div>`
    ).join('');

    this._rebuildModels();
    this._renderReady();
  }

  _renderReady() {
    const button = this.el.querySelector('#readyBtn');
    const note = this.el.querySelector('#readyNote');
    if (!this.online) {
      button.textContent = 'DEPLOY SOLO';
      button.className = 'ready-btn';
      note.textContent = 'PRIVATE CORE RUN · LOCAL MATCH';
      return;
    }
    const me = this.members.find((member) => member.name === this.name);
    const leader = me?.leader ?? true;
    const allReady = this.members.length > 0 && this.members.every((member) => member.ready);
    if (this.localReady && leader && allReady) button.textContent = 'DEPLOY SQUAD';
    else if (this.localReady) button.textContent = leader ? 'WAITING FOR SQUAD' : 'CANCEL READY';
    else button.textContent = 'READY UP';
    button.className = `ready-btn ${this.localReady ? 'is-ready' : ''}`;
    note.textContent = this.partyStatus === 'PARTY ONLINE'
      ? `${this.members.filter((m) => m.ready).length}/${this.members.length} RUNNERS READY`
      : 'START THE MATCH SERVER TO ENABLE PARTIES';
  }

  _initScene() {
    const canvas = this.el.querySelector('#lobbyCanvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x6f695a, 18, 82);
    this.scene.add(makeSky({ top: '#172733', horizon: '#6f695a' }));
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
    this.camera.position.set(0, 2.4, 10.2);
    this.camera.lookAt(0, 1.05, -0.35);
    this.backdrop = new DistantBackdrop({
      min: { x: -34, z: -24 },
      max: { x: 34, z: 24 },
    });
    this.backdrop.root.position.y = -0.22;
    this.scene.add(this.backdrop.root);

    this.scene.add(new THREE.HemisphereLight(0xcde8ff, 0x41352d, 2.5));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.42));
    const key = new THREE.DirectionalLight(0xffe4bd, 3.4); key.position.set(4, 7, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5ee8ff, 2.8); rim.position.set(-5, 3, -4); this.scene.add(rim);

    this.partyRoot = new THREE.Group();
    this.scene.add(this.partyRoot);
    for (let i = 0; i < MAX_PARTY; i++) {
      const platform = new THREE.Group();
      platform.position.set(0, -0.05, 0);
      const base = new THREE.Mesh(
        new THREE.CylinderGeometry(0.56, 0.7, 0.24, 8),
        mat(PALETTE.steelDark, { metal: 0.42, rough: 0.52 }),
      );
      platform.add(base);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.58, 0.022, 5, 32),
        mat(PALETTE.coreGlow, { emissive: PALETTE.coreGlow, emissiveIntensity: 2.1 }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.14;
      platform.add(ring);
      const model = new THREE.Group();
      model.position.y = 0.14;
      platform.add(model);
      platform.userData.model = model;
      platform.userData.ring = ring;
      platform.userData.baseY = platform.position.y;
      platform.visible = false;
      this.partyRoot.add(platform);
      this.platforms.push(platform);
    }
    this._rebuildModels();

    const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.72, 0.7, 0.78));
    this.composer.addPass(new OutputPass());
    this.running = true;
    this.clock = new THREE.Clock();
    this._loop();
  }

  _updateResponsiveCamera(w, h) {
    const narrow = w < 700 || w / Math.max(1, h) < 1.05;
    this.camera.position.set(0, narrow ? 2.75 : 2.4, narrow ? 11.35 : 10.2);
    this.camera.lookAt(0, narrow ? 1.18 : 1.05, narrow ? -0.9 : -0.35);
    this.partyRoot.position.set(0, narrow ? 0.24 : 0, narrow ? -0.75 : 0);
    this.partyRoot.scale.setScalar(narrow ? 0.86 : 1);
  }

  _updateStageLabels() {
    const labels = this.el.querySelector('#stageLabels');
    if (!labels) return;
    const labelRect = labels.getBoundingClientRect();
    const canvasRect = this.renderer.domElement.getBoundingClientRect();
    if (!labelRect.width || !labelRect.height) return;
    this._labelWorld = this._labelWorld || new THREE.Vector3();
    this.platforms.forEach((platform, index) => {
      if (!platform.visible) return;
      const label = labels.querySelector(`[data-slot="${index}"]`);
      if (!label) return;
      this._labelWorld.set(0, 0.22, 0);
      platform.localToWorld(this._labelWorld);
      this._labelWorld.project(this.camera);
      const x = (this._labelWorld.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left - labelRect.left;
      const y = (-this._labelWorld.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top - labelRect.top + 72 * platform.scale.x;
      label.style.transform = `translate(${x}px, ${y}px) translate(-50%, 0)`;
    });
  }

  _rebuildModels() {
    if (!this.platforms.length) return;
    const tints = ['#2f78b7', '#7c4353', '#3f7658', '#8a6a38'];
    const layouts = {
      1: [{ x: 0, z: 0.2, scale: 1.08 }],
      2: [{ x: -1.12, z: 0.24, scale: 1.04 }, { x: 1.12, z: 0.24, scale: 1.04 }],
      3: [{ x: -1.85, z: -0.3, scale: 0.96 }, { x: 0, z: 0.4, scale: 1.05 }, { x: 1.85, z: -0.3, scale: 0.96 }],
      4: [
        { x: -1.12, z: 0.38, scale: 1.04 },
        { x: 1.12, z: 0.38, scale: 1.02 },
        { x: -2.32, z: -1.18, scale: 0.94 },
        { x: 2.32, z: -1.18, scale: 0.94 },
      ],
    };
    const activeLayouts = layouts[Math.max(1, Math.min(MAX_PARTY, this.members.length))];
    for (let i = 0; i < this.platforms.length; i++) {
      const slot = this.platforms[i].userData.model;
      disposeObjectTree(slot);
      slot.clear();
      const member = this.members[i];
      this.platforms[i].visible = Boolean(member);
      if (!member) continue;
      const layout = activeLayouts[i];
      this.platforms[i].position.set(layout.x, -0.05, layout.z);
      this.platforms[i].scale.setScalar(layout.scale);
      this.platforms[i].userData.baseY = -0.05;
      this.platforms[i].userData.ring.material.emissiveIntensity = member?.ready ? 3.4 : member ? 1.7 : 0.7;
      const localColors = i === 0 ? this.loadout._colors : null;
      const runner = buildAsset('char_runner', { pose: 'aim', colors: { jacket: localColors?.jacket || tints[i] } });
      const hand = runner.getObjectByName(runner.userData.weaponSocketName || 'hand_r') || runner;
      mountWeaponToSocket(buildAsset('weapon_scrap_pistol'), hand);
      if (i === 0) {
        for (const [socketName, id] of Object.entries(this.loadout)) {
          if (socketName.startsWith('_')) continue;
          if (!id) continue;
          (runner.getObjectByName(socketName) || runner).add(buildAsset(id));
        }
      }
      runner.scale.setScalar(0.92);
      slot.add(runner);
    }
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / Math.max(1, h);
      this.camera.updateProjectionMatrix();
      this.composer.setSize(w, h);
    }
    this._updateResponsiveCamera(w, h);
    const time = performance.now() * 0.001;
    this.backdrop?.update(time);
    this.platforms.forEach((platform, index) => {
      platform.position.y = platform.userData.baseY + Math.sin(time * 1.25 + index * 0.8) * 0.055;
      const model = platform.userData.model;
      if (model.children[0]) model.children[0].rotation.y = Math.sin(time * 0.5 + index) * 0.12;
    });
    this.partyRoot.rotation.y = Math.sin(time * 0.16) * 0.035;
    this._updateStageLabels();
    this.composer.render(dt);
  }

  destroy() {
    this.running = false;
    this.party?.disconnect();
    disposeObjectTree(this.scene);
    try { this.composer?.dispose?.(); } catch { /* noop */ }
    try { this.renderer?.dispose(); } catch { /* noop */ }
    this.el.remove();
  }
}
