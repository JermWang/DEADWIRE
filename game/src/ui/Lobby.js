// Lobby — pre-match squad assembly screen with a live 3D party lineup.
// The layout follows familiar squad-lobby conventions while keeping Deadwire's
// own reactor-yard visual language and a lightweight real party protocol.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ASSETS, buildAsset, mat, mountWeaponToSocket, PALETTE } from '../assets.js';
import { makeSky } from '../render/Sky.js';
import { groundTexture } from '../render/textures.js';
import { DistantBackdrop } from '../world/DistantBackdrop.js';
import { disposeObjectTree } from '../render/dispose.js';
import { Stash } from '../systems/Stash.js';
import { Account } from '../net/account.js';
import { matchWsBase } from '../config/runtime.js';
import { CORE_TIER_LIST, coreTierOdds, coreTokenRange, estimateCoreTokenValue, formatDeadTokens, runUpgradeModifiers } from '../data/economy.js';

const MAX_PARTY = 4;
const MARKET_CATEGORIES = ['all', 'cores', 'cosmetics', 'weapons', 'resources'];
const PARTY_MODE_LABELS = { 1: 'SOLO', 2: 'DUO', 3: 'TRIO', 4: 'SQUAD' };

// Real /public artwork used for listings that are not single procedural meshes.
const RESOURCE_IMAGES = {
  'res-parts': '/silo-7.png',
  'res-components': '/pods.png',
  'res-shards': '/portal.png',
  'res-gold': '/dead%20gold%20token.png',
};

// Colorable runner params exposed in the live locker (mirrors char_runner colors).
const LOCKER_COLOR_FIELDS = [
  { key: 'jacket', label: 'JACKET', swatches: ['#3b4a5a', '#8a4b3f', '#3e6b55', '#b28a3f', '#d9ddda', '#242a2e'] },
  { key: 'pants', label: 'PANTS', swatches: ['#2b3137', '#4a3b2f', '#34423a', '#5a5048', '#1c2024', '#6b5436'] },
  { key: 'boots', label: 'BOOTS', swatches: ['#23282c', '#3a2c24', '#2e3a32', '#4a4038', '#161a1d', '#7a6a4a'] },
  { key: 'pack', label: 'PACK', swatches: ['#3a4046', '#6b4a3a', '#3e6b55', '#7a6038', '#d2d6d3', '#1f2327'] },
  { key: 'accent', label: 'ACCENT', swatches: ['#f2a93b', '#5ee8ff', '#ff5a78', '#9c76ff', '#7dff9b', '#ffe14d'] },
];

// Lazy shared offscreen renderer that turns buildAsset(id) into cached thumbnail data URLs.
let _thumbRenderer = null;
const _thumbCache = new Map();
function assetThumbnail(id, options, accent = '#5ee8ff') {
  const cacheKey = `${id}::${JSON.stringify(options || {})}`;
  if (_thumbCache.has(cacheKey)) return _thumbCache.get(cacheKey);
  let dataUrl = '';
  try {
    if (!_thumbRenderer) {
      _thumbRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      _thumbRenderer.setSize(160, 160, false);
      _thumbRenderer.setPixelRatio(1);
      _thumbRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      _thumbRenderer.toneMappingExposure = 1.18;
    }
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x202428, 2.0));
    const key = new THREE.DirectionalLight(0xfff0d6, 2.6); key.position.set(2.5, 4, 3); scene.add(key);
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 2.2); rim.position.set(-3, 2, -2); scene.add(rim);
    const model = buildAsset(id, options);
    scene.add(model);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100);
    const dist = radius / Math.tan((35 * Math.PI / 180) / 2) * 1.35;
    camera.position.set(center.x + dist * 0.55, center.y + dist * 0.42, center.z + dist);
    camera.lookAt(center);
    _thumbRenderer.render(scene, camera);
    dataUrl = _thumbRenderer.domElement.toDataURL('image/png');
    disposeObjectTree(scene);
  } catch { dataUrl = ''; }
  _thumbCache.set(cacheKey, dataUrl);
  return dataUrl;
}

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
      if (message.t === 'lobby_launch') this.onLaunch(message);
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
    this.practicalLights = [];
    this.page = 'lobby';
    this.social = { friends: [], incoming: [], outgoing: [], discord: [], results: [], message: '' };
    this.market = {
      open: false,
      type: 'all',
      category: 'all',
      grade: 'all',
      sort: 'value_desc',
      query: '',
      min: '',
      max: '',
      watch: new Set(),
    };
    this._build();
  }

  _build() {
    const stash = Stash.load();
    // Seed the working loadout from the saved profile so the lineup + locker reflect colors/cosmetics/weapon.
    this._syncLoadoutFromProfile(stash.profile);
    this.el = document.createElement('div');
    this.el.className = 'lobby';
    this.el.innerHTML = `
      <canvas id="lobbyCanvas"></canvas>
      <div class="lobby-wash"></div>
      <header class="lobby-top">
        <button class="lobby-brand" data-act="back">DEAD<span>WIRE</span></button>
        <nav class="lobby-nav">
          <button class="on" data-act="lobby">LOBBY</button>
          <button data-act="friends">FRIENDS</button>
          <button data-act="market">MARKET</button>
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
        <div class="social-rule" id="recentRule"></div>
        <div class="panel-kicker" id="recentKicker">RECENT RUNNERS</div>
        <div class="recent-list" id="recentRunners"></div>
      </aside>

      <section class="market-panel glass" id="marketPanel" aria-label="Black market">
        <div class="market-head">
          <div>
            <small>BLACK MARKET</small>
            <h2>CORE EXCHANGE</h2>
          </div>
          <button data-act="closeMarket">CLOSE</button>
        </div>
        <div class="market-metrics">
          <div><span>Base</span><b>LV ${stash.progression?.baseLevel || 1}</b></div>
          <div><span>Weapons</span><b>LV ${stash.progression?.weaponLevel || 1}</b></div>
          <div><span>Crafting</span><b>LV ${stash.progression?.craftingLevel || 1}</b></div>
          <div><span>Supply</span><b>1B</b></div>
        </div>
        <div class="market-tools">
          <input id="marketSearch" placeholder="SEARCH CORES, GEAR, COSMETICS" />
          <select id="marketCategory">${MARKET_CATEGORIES.map((category) => `<option value="${category}">${category.toUpperCase()}</option>`).join('')}</select>
          <select id="marketGrade">
            <option value="all">ALL GRADES</option>
            <option value="LOW">LOW</option>
            <option value="REGULAR">REGULAR</option>
            <option value="APEX">APEX</option>
          </select>
          <select id="marketSort">
            <option value="value_desc">VALUE HIGH</option>
            <option value="value_asc">VALUE LOW</option>
            <option value="owned">OWNED FIRST</option>
            <option value="name">NAME</option>
          </select>
          <input id="marketMin" inputmode="numeric" placeholder="MIN" />
          <input id="marketMax" inputmode="numeric" placeholder="MAX" />
        </div>
        <div class="market-tabs">
          <button class="on" data-market-type="all">ALL</button>
          <button data-market-type="cores">CORES</button>
          <button data-market-type="cosmetics">COSMETICS</button>
          <button data-market-type="owned">MY VAULT</button>
        </div>
        <div class="market-formula">
          <b>VALUE RAIL</b>
          <span>Core grade x run pressure x base/weapons/crafting skill, damped against 1B supply so listings sit in common 10K-10M trade bands.</span>
        </div>
        <div class="market-count" id="marketCount"></div>
        <div class="market-grid" id="marketGrid"></div>
      </section>

      <section class="lobby-page glass" id="friendsPanel" aria-label="Friends">
        <div class="page-head">
          <div><small>SOCIAL UPLINK</small><h2>FRIENDS</h2></div>
          <button data-act="lobby">CLOSE</button>
        </div>
        <div class="identity-block" id="identityBlock"></div>
        <div class="friends-tools">
          <input id="friendSearch" placeholder="SEARCH IN-GAME USERNAME" maxlength="20" />
          <button data-act="searchFriends">SEARCH</button>
        </div>
        <div class="social-message" id="socialMessage"></div>
        <div class="friends-columns">
          <div><h3>FRIENDS</h3><div class="social-list" id="friendsList"></div></div>
          <div><h3>REQUESTS</h3><div class="social-list" id="requestsList"></div></div>
          <div><h3>DISCORD</h3><div class="social-list" id="discordList"></div></div>
        </div>
        <div class="search-results" id="friendResults"></div>
      </section>

      <section class="lobby-page glass locker-page" id="loadoutPanel" aria-label="Loadout">
        <div class="page-head">
          <div><small>RUNNER CONFIGURATION</small><h2>LOCKER</h2></div>
          <button data-act="lobby">CLOSE</button>
        </div>
        <div class="locker-layout">
          <div class="locker-viewport">
            <canvas id="lockerCanvas"></canvas>
            <div class="locker-viewport-hint">DRAG TO ROTATE</div>
            <div class="locker-viewport-controls">
              <button data-act="lockerSpin" id="lockerSpinBtn">SPIN: ON</button>
              <button data-act="lockerReset">RESET VIEW</button>
            </div>
          </div>
          <div class="locker-controls">
            <h3>FIELD KIT</h3>
            <div class="weapon-grid" id="weaponGrid"></div>
            <h3>COLORWAYS</h3>
            <div class="color-fields" id="colorFields"></div>
            <h3>COSMETICS</h3>
            <div class="cosmetic-grid" id="cosmeticGrid"></div>
          </div>
        </div>
      </section>

      <section class="lobby-page glass" id="careerPanel" aria-label="Career">
        <div class="page-head">
          <div><small>RUNNER RECORD</small><h2>CAREER</h2></div>
          <button data-act="lobby">CLOSE</button>
        </div>
        <div id="careerContent"></div>
      </section>

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
            <span id="modeKicker">CORE RUN</span>
            <b>BREAKER YARD</b>
            <small id="modeLine">1 RUNNER · SOLO · 8 MIN</small>
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
          <div class="progression-block" id="progressionBlock"></div>
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
      </footer>

      <div class="beta-gate" id="betaGate" role="dialog" aria-modal="true" aria-labelledby="betaTitle">
        <div class="beta-panel glass">
          <small>PUBLIC BETA</small>
          <h2 id="betaTitle">Desktop Access Only</h2>
          <p>Deadwire is in beta and available on desktop browsers for the moment. Mobile support is coming soon.</p>
          <button data-act="betaContinue">Continue to Lobby</button>
        </div>
      </div>`;
    this.root.appendChild(this.el);

    this.el.addEventListener('input', (event) => this._marketInput(event));
    this.el.addEventListener('change', (event) => this._marketInput(event));
    this.el.addEventListener('click', (event) => {
      const action = event.target.closest?.('[data-act]');
      if (action && this.el.contains(action)) {
        this._action(action.dataset.act, action);
        return;
      }
      this._marketClick(event);
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
      onLaunch: (message) => this._deploy(true, message?.size),
    });

    this._initScene();
    this._renderParty();
    this._renderProgression();
    this._renderLoadout();
    this._renderCareer();
    this._renderFriends();
    this._renderRecentRunners();
    if (this.online) this.party.connect(this.partyCode, this.name);
  }

  async _action(action, source) {
    if (action === 'lobby' || action === 'closeMarket') {
      this._showPage('lobby');
      return;
    }
    if (['market', 'friends', 'loadout', 'career'].includes(action)) {
      this._showPage(action);
      return;
    }
    if (action === 'back') {
      this.destroy();
      this.onBack();
      return;
    }
    if (action === 'betaContinue') {
      this.el.querySelector('#betaGate')?.remove();
      return;
    }
    if (action === 'copy') {
      const ok = await this._copyInviteLink();
      this.el.querySelector('#partyStatus').textContent = ok ? 'INVITE LINK COPIED' : `INVITE: ${this._inviteLink()}`;
      return;
    }
    if (action === 'join') {
      const input = this.el.querySelector('#joinCode');
      // Accept a raw code or a pasted ?party=CODE invite link.
      let code = (input?.value || '').trim();
      const match = code.match(/[?&]party=([^&\s]+)/i);
      if (match) code = decodeURIComponent(match[1]);
      code = code.toUpperCase();
      if (!code) return;
      this.partyCode = code;
      this.online = true;
      this.localReady = false;
      this._syncPartyUrl();
      this.party.connect(code, this.name);
      this._renderParty();
      return;
    }
    if (action === 'setSolo' || action === 'setOnline') {
      const nextOnline = action === 'setOnline';
      if (nextOnline === this.online) return;
      this.online = nextOnline;
      this.localReady = false;
      if (this.online) { this._syncPartyUrl(); this.party.connect(this.partyCode, this.name); }
      else {
        this.party.disconnect();
        this.members = [{ id: 'local', name: this.name, ready: false, leader: true }];
        this.partyStatus = 'SOLO PARTY';
      }
      this._renderParty();
      return;
    }
    if (action === 'signInDiscord') {
      this._setSocialMessage('OPENING DISCORD...');
      try { await Account.signInDiscord(); } catch (error) { this._setSocialMessage(error.message); }
      return;
    }
    if (action === 'signInWallet') {
      this._setSocialMessage('CHECK YOUR WALLET...');
      try {
        await Account.signIn();
        this.name = Account.profile?.handle || Stash.load().profile.callsign;
        this._setSocialMessage('SOLANA PROFILE CONNECTED');
        await this._renderFriends(true);
      } catch (error) { this._setSocialMessage(error.message); }
      return;
    }
    if (action === 'signOut') {
      await Account.signOut();
      this._setSocialMessage('PROFILE DISCONNECTED');
      this._renderFriends();
      return;
    }
    if (action === 'saveHandle') {
      const handle = this.el.querySelector('#profileHandle')?.value.trim();
      try {
        await Account.updateProfile(handle);
        this.name = Account.profile?.handle || this.name;
        this._setSocialMessage('USERNAME UPDATED');
        this._renderFriends();
      } catch (error) { this._setSocialMessage(error.message); }
      return;
    }
    if (action === 'searchFriends') {
      const query = this.el.querySelector('#friendSearch')?.value.trim();
      try {
        this.social.results = await Account.searchProfiles(query);
        this._renderFriendResults();
        this._setSocialMessage(`${this.social.results.length} RUNNERS FOUND`);
      } catch (error) { this._setSocialMessage(error.message); }
      return;
    }
    if (action === 'friendAdd') {
      try {
        await Account.friendRequest(source.dataset.profileId);
        this._setSocialMessage('FRIEND REQUEST SENT');
        await this._renderFriends(true);
      } catch (error) { this._setSocialMessage(error.message); }
      return;
    }
    if (action === 'friendAccept' || action === 'friendDecline') {
      try {
        await Account.friendRespond(source.dataset.friendshipId, action === 'friendAccept');
        this._setSocialMessage(action === 'friendAccept' ? 'FRIEND ADDED' : 'REQUEST DECLINED');
        await this._renderFriends(true);
      } catch (error) { this._setSocialMessage(error.message); }
      return;
    }
    if (action === 'friendRemove') {
      try {
        await Account.friendRemove(source.dataset.friendshipId);
        this._setSocialMessage('FRIEND REMOVED');
        await this._renderFriends(true);
      } catch (error) { this._setSocialMessage(error.message); }
      return;
    }
    if (action === 'friendInvite') {
      const ok = await this._copyInviteLink();
      this._setSocialMessage(ok
        ? `PARTY INVITE COPIED FOR ${source.dataset.handle || 'FRIEND'}`
        : `INVITE LINK: ${this._inviteLink()}`);
      return;
    }
    if (action === 'discordAdd') {
      try {
        await Account.importDiscordFriend(source.dataset.discordId);
        this._setSocialMessage('DISCORD FRIEND REQUEST SENT');
        await this._renderFriends(true);
      } catch (error) { this._setSocialMessage(error.message); }
      return;
    }
    if (action === 'equipCosmetic') {
      this._equipCosmetic(source.dataset.assetId);
      return;
    }
    if (action === 'selectWeapon') {
      this._selectWeapon(source.dataset.weaponId);
      return;
    }
    if (action === 'setColor') {
      this._setColor(source.dataset.colorKey, source.dataset.color);
      return;
    }
    if (action === 'lockerSpin') {
      this.lockerSpin = !this.lockerSpin;
      source.textContent = `SPIN: ${this.lockerSpin ? 'ON' : 'OFF'}`;
      return;
    }
    if (action === 'lockerReset') {
      this.lockerYaw = 0.6;
      this.lockerPitch = 0.05;
      return;
    }
    if (action === 'ready') this._ready();
  }

  _showPage(page) {
    this.page = page;
    const overlay = page !== 'lobby';
    this.market.open = page === 'market';
    this.el.classList.toggle('market-open', overlay);
    this.el.querySelector('#marketPanel')?.classList.toggle('open', page === 'market');
    this.el.querySelectorAll('.lobby-page').forEach((panel) => panel.classList.toggle('open', panel.id === `${page}Panel`));
    this.el.querySelectorAll('.lobby-nav button').forEach((button) => button.classList.toggle('on', button.dataset.act === page));
    if (page === 'market') this._renderMarket();
    if (page === 'friends') this._renderFriends(true);
    if (page === 'loadout') this._renderLoadout();
    if (page === 'career') this._renderCareer();
  }

  _setMarketOpen(open) {
    this._showPage(open ? 'market' : 'lobby');
  }

  _marketInput(event) {
    if (!event.target?.id?.startsWith?.('market')) return;
    this.market.query = this.el.querySelector('#marketSearch')?.value.trim().toLowerCase() || '';
    this.market.category = this.el.querySelector('#marketCategory')?.value || 'all';
    this.market.grade = this.el.querySelector('#marketGrade')?.value || 'all';
    this.market.sort = this.el.querySelector('#marketSort')?.value || 'value_desc';
    this.market.min = this.el.querySelector('#marketMin')?.value || '';
    this.market.max = this.el.querySelector('#marketMax')?.value || '';
    this._renderMarket();
  }

  _marketClick(event) {
    const upgrade = event.target.closest?.('[data-upgrade]');
    if (upgrade) {
      this._upgradeProgression(upgrade.dataset.upgrade);
      return;
    }
    const tab = event.target.closest?.('[data-market-type]');
    if (tab) {
      this.market.type = tab.dataset.marketType;
      this.el.querySelectorAll('[data-market-type]').forEach((button) => button.classList.toggle('on', button === tab));
      this._renderMarket();
      return;
    }
    const watch = event.target.closest?.('[data-market-watch]');
    if (watch) {
      const id = watch.dataset.marketWatch;
      if (this.market.watch.has(id)) this.market.watch.delete(id);
      else this.market.watch.add(id);
      this._renderMarket();
    }
  }

  _inviteLink() {
    return `${location.origin}${location.pathname}?party=${encodeURIComponent(this.partyCode)}`;
  }

  async _copyInviteLink() {
    const link = this._inviteLink();
    try {
      if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(link); return true; }
    } catch { /* fall through to legacy copy */ }
    try {
      const ta = document.createElement('textarea');
      ta.value = link; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch { return false; }
  }

  _syncPartyUrl() {
    // Keep the address bar's ?party= in sync so the page URL is itself a working invite.
    try {
      const url = new URL(location.href);
      url.searchParams.set('party', this.partyCode);
      history.replaceState(null, '', url);
    } catch { /* noop */ }
  }

  _esc(value) {
    return String(value ?? '').replace(/[<>&"]/g, (char) => ({
      '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;',
    }[char]));
  }

  _setSocialMessage(message) {
    this.social.message = message || '';
    const target = this.el.querySelector('#socialMessage');
    if (target) target.textContent = this.social.message;
  }

  _socialRow(person, actions = '') {
    const initial = this._esc((person.handle || person.username || '?').slice(0, 1).toUpperCase());
    const name = this._esc(person.handle || person.username || 'Unknown Runner');
    const meta = person.level ? `LV ${person.level}` : person.profileId ? 'DEADWIRE PROFILE' : 'DISCORD CONTACT';
    return `<div class="social-row">
      ${person.avatar ? `<img src="${this._esc(person.avatar)}" alt="" />` : `<i>${initial}</i>`}
      <span><b>${name}</b><small>${meta}</small></span>
      <div>${actions}</div>
    </div>`;
  }

  async _renderFriends(refresh = false) {
    const identity = this.el.querySelector('#identityBlock');
    if (!identity) return;
    const stash = Stash.load();
    if (!Account.isLoggedIn()) {
      identity.innerHTML = `
        <div class="identity-copy">
          <b>CREATE YOUR RUNNER PROFILE</b>
          <span>Connect Discord or sign with Solana to claim a username, add friends, and keep your crew together.</span>
        </div>
        <div class="identity-actions">
          <button class="discord-login" data-act="signInDiscord">DISCORD LOGIN</button>
          <button data-act="signInWallet">CONNECT SOLANA</button>
        </div>`;
      this.el.querySelector('#friendsList').innerHTML = '<div class="social-empty">Connect a profile to manage friends.</div>';
      this.el.querySelector('#requestsList').innerHTML = '<div class="social-empty">No request inbox while offline.</div>';
      this.el.querySelector('#discordList').innerHTML = '<div class="social-empty">Discord friends appear after login and permission.</div>';
      this._renderFriendResults();
      return;
    }
    const profile = Account.profile || {};
    identity.innerHTML = `
      <div class="identity-profile">
        <div class="profile-avatar">${profile.avatar ? `<img src="${this._esc(profile.avatar)}" alt="" />` : this._esc((profile.handle || 'R').slice(0, 1))}</div>
        <div><small>${Account.provider()?.toUpperCase()} CONNECTED</small><b>${this._esc(profile.handle || stash.profile.callsign)}</b></div>
      </div>
      <div class="handle-edit">
        <input id="profileHandle" value="${this._esc(profile.handle || stash.profile.callsign)}" maxlength="20" aria-label="In-game username" />
        <button data-act="saveHandle">SAVE USERNAME</button>
        <button class="quiet" data-act="signOut">SIGN OUT</button>
      </div>`;
    if (refresh) {
      try {
        const data = await Account.listFriends();
        this.social = { ...this.social, ...data };
      } catch (error) {
        this._setSocialMessage(error.message);
      }
    }
    const friends = this.el.querySelector('#friendsList');
    friends.innerHTML = this.social.friends.map((person) => this._socialRow(person,
      `<button data-act="friendInvite" data-handle="${this._esc(person.handle)}">INVITE</button>
       <button class="quiet" data-act="friendRemove" data-friendship-id="${person.friendshipId}">REMOVE</button>`)).join('')
      || '<div class="social-empty">Search for a runner or import a Discord friend.</div>';
    const requests = [
      ...this.social.incoming.map((person) => this._socialRow(person,
        `<button data-act="friendAccept" data-friendship-id="${person.friendshipId}">ACCEPT</button>
         <button class="quiet" data-act="friendDecline" data-friendship-id="${person.friendshipId}">DECLINE</button>`)),
      ...this.social.outgoing.map((person) => this._socialRow(person, '<em>PENDING</em>')),
    ];
    this.el.querySelector('#requestsList').innerHTML = requests.join('') || '<div class="social-empty">No pending requests.</div>';
    this.el.querySelector('#discordList').innerHTML = this.social.discord.map((person) => this._socialRow(person,
      person.profileId
        ? `<button data-act="friendAdd" data-profile-id="${person.profileId}">ADD</button>`
        : `<button data-act="discordAdd" data-discord-id="${person.id}">INVITE</button>`)).join('')
      || '<div class="social-empty">No importable Discord friends. The Discord application must enable relationships access.</div>';
    this._renderFriendResults();
    this._renderRecentRunners();
    this._setSocialMessage(this.social.message);
  }

  _renderRecentRunners() {
    const list = this.el.querySelector('#recentRunners');
    if (!list) return;
    const kicker = this.el.querySelector('#recentKicker');
    const rule = this.el.querySelector('#recentRule');
    // Real data only: other party members + accepted friends. No fabricated samples.
    const seen = new Set([this.name]);
    const runners = [];
    for (const member of this.members) {
      if (!member || seen.has(member.name)) continue;
      seen.add(member.name);
      runners.push({ name: member.name, meta: member.leader ? 'PARTY LEADER' : 'IN YOUR PARTY' });
    }
    for (const friend of this.social.friends || []) {
      const name = friend.handle || friend.username;
      if (!name || seen.has(name)) continue;
      seen.add(name);
      runners.push({ name, meta: friend.level ? `FRIEND · LV ${friend.level}` : 'FRIEND', avatar: friend.avatar });
    }
    const hasData = runners.length > 0;
    if (kicker) kicker.style.display = hasData ? '' : 'none';
    if (rule) rule.style.display = hasData ? '' : 'none';
    list.style.display = hasData ? '' : 'none';
    if (!hasData) { list.innerHTML = ''; return; }
    list.innerHTML = runners.slice(0, 6).map((runner) => {
      const initial = this._esc((runner.name || '?').slice(0, 1).toUpperCase());
      return `<div class="recent-row">
        ${runner.avatar ? `<img src="${this._esc(runner.avatar)}" alt="" />` : `<i>${initial}</i>`}
        <span><b>${this._esc(runner.name)}</b><small>${this._esc(runner.meta)}</small></span>
      </div>`;
    }).join('');
  }

  _renderFriendResults() {
    const target = this.el.querySelector('#friendResults');
    if (!target) return;
    target.innerHTML = this.social.results.length
      ? `<h3>SEARCH RESULTS</h3>${this.social.results.map((person) => this._socialRow(person,
        `<button data-act="friendAdd" data-profile-id="${person.id}">ADD FRIEND</button>`)).join('')}`
      : '';
  }

  // Full runner colorway sourced from profile (legacy `tint` maps to jacket).
  _lockerColors(stash = Stash.load()) {
    return { jacket: stash.profile.tint, ...(stash.profile.colors || {}) };
  }

  // Keep this.loadout (consumed by _rebuildModels and onDeploy) in lockstep with the profile.
  _syncLoadoutFromProfile(profile) {
    this.loadout = {
      ...profile.equipped,
      _colors: { jacket: profile.tint, ...(profile.colors || {}) },
      _primaryWeapon: profile.primaryWeapon,
    };
  }

  _renderLoadout() {
    const stash = Stash.load();
    const weapons = ASSETS.filter((asset) => asset.category === 'weapon');
    const weaponGrid = this.el.querySelector('#weaponGrid');
    if (weaponGrid) weaponGrid.innerHTML = weapons.map((weapon) => {
      const selected = stash.profile.primaryWeapon === weapon.id;
      const thumb = assetThumbnail(weapon.id, undefined, PALETTE.accentCyan);
      return `<button data-act="selectWeapon" data-weapon-id="${weapon.id}" class="${selected ? 'selected' : ''}">
        ${thumb ? `<u class="kit-thumb"><img src="${thumb}" alt="" /></u>` : ''}
        <b>${this._esc(weapon.displayName)}</b><span>${this._esc(weapon.slot || 'weapon')} · field kit</span>
        <em>${selected ? 'DEPLOY PRIMARY' : 'SET PRIMARY'}</em>
      </button>`;
    }).join('');

    const colors = this._lockerColors(stash);
    const colorFields = this.el.querySelector('#colorFields');
    if (colorFields) colorFields.innerHTML = LOCKER_COLOR_FIELDS.map((field) => {
      const current = (colors[field.key] || '').toLowerCase();
      return `<div class="color-field">
        <small>${field.label}</small>
        <div class="tint-swatches">${field.swatches.map((hex) =>
          `<button data-act="setColor" data-color-key="${field.key}" data-color="${hex}" class="${current === hex.toLowerCase() ? 'on' : ''}" style="--swatch:${hex}" aria-label="${field.label} ${hex}"></button>`
        ).join('')}</div>
      </div>`;
    }).join('');

    const cosmetics = ASSETS.filter((asset) => asset.category === 'cosmetic');
    const grid = this.el.querySelector('#cosmeticGrid');
    if (grid) grid.innerHTML = cosmetics.map((asset) => {
      const unlocked = Stash.isCosmeticUnlocked(asset, stash);
      const equipped = stash.profile.equipped?.[asset.slot] === asset.id;
      const unlock = asset.unlock ? `LV ${asset.unlock.level || 1} + ${asset.unlock.qty || 1} ${asset.unlock.item}` : 'STARTER ISSUE';
      const thumb = assetThumbnail(asset.id, undefined, asset.rarity === 'rare' ? PALETTE.signalViolet : PALETTE.accentCyan);
      return `<button class="cosmetic-item ${equipped ? 'equipped' : ''}" data-act="equipCosmetic" data-asset-id="${asset.id}" ${unlocked ? '' : 'disabled'}>
        ${thumb ? `<i class="cosmetic-thumb"><img src="${thumb}" alt="" /></i>` : '<i></i>'}<span><b>${this._esc(asset.displayName)}</b><small>${this._esc(asset.slot)} · ${this._esc(asset.rarity || 'common')}</small></span>
        <em>${equipped ? 'EQUIPPED' : unlocked ? 'EQUIP' : unlock}</em>
      </button>`;
    }).join('');

    this._initLocker();
    this._rebuildLocker();
  }

  _equipCosmetic(assetId) {
    const asset = ASSETS.find((item) => item.id === assetId && item.category === 'cosmetic');
    const stash = Stash.load();
    if (!asset || !Stash.isCosmeticUnlocked(asset, stash)) return;
    // Toggle: re-equipping the same slot item unequips it for live preview parity with the studio.
    const current = stash.profile.equipped?.[asset.slot];
    const equipped = { ...stash.profile.equipped, [asset.slot]: current === asset.id ? null : asset.id };
    const profile = Stash.saveProfile({ equipped });
    this._syncLoadoutFromProfile(profile);
    this._renderLoadout();
    this._rebuildModels();
  }

  _selectWeapon(weaponId) {
    if (!ASSETS.some((asset) => asset.id === weaponId && asset.category === 'weapon')) return;
    const profile = Stash.saveProfile({ primaryWeapon: weaponId });
    this._syncLoadoutFromProfile(profile);
    this._renderLoadout();
    this._rebuildModels();
  }

  _setColor(key, hex) {
    if (!LOCKER_COLOR_FIELDS.some((field) => field.key === key)) return;
    const stash = Stash.load();
    const nextColors = { ...(stash.profile.colors || {}), [key]: hex };
    // Mirror jacket into legacy `tint` so the lobby lineup and saved profile stay consistent.
    const patch = key === 'jacket' ? { tint: hex, colors: nextColors } : { colors: nextColors };
    const profile = Stash.saveProfile(patch);
    this._syncLoadoutFromProfile(profile);
    this._renderLoadout();
    this._rebuildModels();
  }

  _setTint(tint) {
    const profile = Stash.saveProfile({ tint });
    this.loadout = { ...this.loadout, _colors: { jacket: profile.tint } };
    this._renderLoadout();
    this._rebuildModels();
  }

  _renderCareer() {
    const target = this.el.querySelector('#careerContent');
    if (!target) return;
    const stash = Stash.load();
    const success = stash.runs ? Math.round((stash.extractions / stash.runs) * 100) : 0;
    const achievements = [
      { name: 'First Light', detail: 'Complete a run', done: stash.runs >= 1 },
      { name: 'Clean Exit', detail: 'Extract successfully', done: stash.extractions >= 1 },
      { name: 'Core Thief', detail: 'Recover a reactor core', done: (stash.items?.['Reactor Core'] || 0) >= 1 },
      { name: 'Yard Regular', detail: 'Complete 10 runs', done: stash.runs >= 10 },
    ];
    const resources = ['Scrap', 'Parts', 'Components', 'Core Shard', 'Reactor Core'];
    target.innerHTML = `
      <div class="career-stats">
        <div><span>LEVEL</span><b>${stash.level}</b><small>${stash.xp} / ${stash.level * 500} XP</small></div>
        <div><span>RUNS</span><b>${stash.runs}</b><small>CORE RUN DEPLOYMENTS</small></div>
        <div><span>EXTRACTIONS</span><b>${stash.extractions}</b><small>${success}% SUCCESS RATE</small></div>
        <div><span>CORES</span><b>${stash.items?.['Reactor Core'] || 0}</b><small>SECURED IN VAULT</small></div>
      </div>
      <div class="career-grid">
        <section><h3>COMMENDATIONS</h3>${achievements.map((item) =>
          `<div class="achievement ${item.done ? 'done' : ''}"><i>${item.done ? '✓' : '·'}</i><span><b>${item.name}</b><small>${item.detail}</small></span></div>`
        ).join('')}</section>
        <section><h3>VAULT INVENTORY</h3>${resources.map((item) =>
          `<div class="resource-line"><span>${item}</span><b>${stash.items?.[item] || 0}</b></div>`
        ).join('')}</section>
        <section><h3>OPERATIONS</h3>${Object.entries(Stash.upgradeDefs()).map(([type, def]) =>
          `<div class="resource-line"><span>${def.label}</span><b>LV ${stash.progression?.[def.key] || 1}</b></div>`
        ).join('')}</section>
      </div>`;
  }

  _formatCost(cost) {
    if (!cost) return 'MAXED';
    return Object.entries(cost).map(([item, qty]) => `${item} ${qty}`).join(' / ');
  }

  _progressionBenefit(type) {
    if (type === 'base') return 'adds deploy ammo, raises ammo cap, speeds extraction, and lifts core value';
    if (type === 'weapons') return 'raises damage, fire rate, projectile speed, and run pressure value';
    return 'improves core carry speed and adds bonus shards on extraction';
  }

  _renderProgression(stash = Stash.load()) {
    const block = this.el.querySelector('#progressionBlock');
    if (!block) return;
    const defs = Stash.upgradeDefs();
    const odds = coreTierOdds(stash);
    block.innerHTML = `
      <div class="panel-kicker progression-kicker">BASE OPS</div>
      <div class="core-odds">
        <span style="--c:#4dbdff">BLUE <b>${Math.round(odds.blue * 100)}%</b></span>
        <span style="--c:#ffc947">YELLOW <b>${Math.round(odds.yellow * 100)}%</b></span>
        <span style="--c:#9c76ff">PURPLE <b>${Math.round(odds.purple * 100)}%</b></span>
      </div>
      <div class="upgrade-list">
        ${Object.entries(defs).map(([type, def]) => {
          const level = stash.progression?.[def.key] || 1;
          const cost = Stash.upgradeCost(type, stash);
          const can = Stash.canUpgrade(type, stash);
          const benefit = this._progressionBenefit(type);
          return `
            <div class="upgrade-row ${can ? 'can-upgrade' : ''}" title="${benefit}">
              <div>
                <span>${def.label}<b>LV ${level}</b></span>
                <em>${this._formatCost(cost)}</em>
              </div>
              <button data-upgrade="${type}" aria-label="${def.label}: ${benefit}" ${can ? '' : 'disabled'}>${cost ? 'UPGRADE' : 'MAX'}</button>
            </div>`;
        }).join('')}
      </div>`;
    this.el.querySelector('.lobby-wallet b').textContent = `LV ${stash.level}`;
    this.el.querySelector('.lobby-wallet i').textContent = `${stash.xp} XP`;
    this.el.querySelectorAll('.market-metrics div').forEach((metric) => {
      const label = metric.querySelector('span')?.textContent?.toLowerCase();
      if (label === 'base') metric.querySelector('b').textContent = `LV ${stash.progression?.baseLevel || 1}`;
      if (label === 'weapons') metric.querySelector('b').textContent = `LV ${stash.progression?.weaponLevel || 1}`;
      if (label === 'crafting') metric.querySelector('b').textContent = `LV ${stash.progression?.craftingLevel || 1}`;
    });
    if (this.market.open) this._renderMarket();
  }

  _upgradeProgression(type) {
    const result = Stash.upgrade(type);
    if (!result.ok) {
      const message = result.reason === 'maxed' ? 'UPGRADE MAXED' : 'NEED MORE RUN LOOT';
      this.el.querySelector('#partyStatus').textContent = message;
      this.el.querySelector('.mission-card')?.classList.add('spotlight');
      return;
    }
    this.el.querySelector('#partyStatus').textContent = `${type.toUpperCase()} LV ${result.level}`;
    this.el.querySelector('.mission-card')?.classList.add('spotlight');
    this._renderProgression(result.stash);
  }

  _marketListings() {
    const stash = Stash.load();
    const mods = runUpgradeModifiers(stash);
    const runProxy = { machines: Math.min(8, stash.runs || 0), players: Math.min(3, Math.floor((stash.extractions || 0) / 2)) };
    const cores = CORE_TIER_LIST.map((tier) => {
      const [low, high] = coreTokenRange(tier.id);
      const value = estimateCoreTokenValue(tier.id, runProxy, stash);
      return {
        id: `core-${tier.id}`,
        title: tier.label,
        category: 'cores',
        grade: tier.grade,
        owned: stash.items?.[tier.item] || 0,
        value,
        low,
        high,
        color: tier.color,
        assetId: 'obj_unstable_core',
        assetOptions: { variant: 'carry', tier: { id: tier.id, rarity: (tier.grade || 'regular').toLowerCase() } },
        tags: ['extractable', 'vault', 'open market'],
        detail: `${tier.item} · ${tier.shardYield + mods.shardBonus} shard yield`,
      };
    });
    const weaponDefs = ASSETS.filter((asset) => asset.category === 'weapon');
    const weapons = weaponDefs.map((asset, index) => {
      const value = 46_000 + index * 64_000;
      const equipped = stash.profile.primaryWeapon === asset.id;
      return {
        id: `weapon-${asset.id}`,
        title: asset.displayName,
        category: 'weapons',
        grade: (asset.rarity || 'standard').toUpperCase(),
        owned: equipped ? 1 : 0,
        value,
        low: Math.round(value * 0.7),
        high: Math.round(value * 1.45),
        color: PALETTE.accentCyan,
        assetId: asset.id,
        tags: [asset.slot || 'weapon', 'field kit'],
        detail: `${asset.slot || 'weapon'} · ${equipped ? 'equipped primary' : 'tradeable'}`,
      };
    });
    const cosmetics = ASSETS
      .filter((asset) => asset.category === 'cosmetic')
      .map((asset, index) => {
        const owned = stash.profile.unlockedCosmetics.includes(asset.id) ? 1 : 0;
        const value = 18_000 + index * 9_500 + (asset.rarity === 'rare' ? 120_000 : asset.rarity === 'uncommon' ? 42_000 : 0);
        return {
          id: `cosmetic-${asset.id}`,
          title: asset.displayName,
          category: 'cosmetics',
          grade: (asset.rarity || 'common').toUpperCase(),
          owned,
          value,
          low: Math.round(value * 0.74),
          high: Math.round(value * 1.38),
          color: asset.rarity === 'rare' ? PALETTE.signalViolet : asset.rarity === 'uncommon' ? PALETTE.warningAmber : PALETTE.accentCyan,
          assetId: asset.id,
          tags: [asset.slot || 'universal', asset.rarity || 'common', asset.tier || 'starter'],
          detail: `${asset.slot || 'cosmetic'} · universal fit`,
        };
      });
    // Resource listings derived from the live economy item catalog (no hardcoded mock arrays).
    const resourceCatalog = [
      { id: 'res-gold', title: '$DEAD Gold Token', item: 'Gold', grade: 'CURRENCY', value: 100_000, color: PALETTE.warningAmber, tags: ['currency', 'open market'], detail: 'Premium settlement token' },
      { id: 'res-parts', title: 'Machine Parts Bundle', item: 'Parts', grade: 'MATERIAL', value: 28_000, color: PALETTE.warningAmber, tags: ['weapons', 'crafting'], detail: 'Weapon upgrade feedstock' },
      { id: 'res-components', title: 'Component Crate', item: 'Components', grade: 'MATERIAL', value: 36_000, color: PALETTE.accentCyan, tags: ['base', 'crafting'], detail: 'Base and gear upgrades' },
      { id: 'res-shards', title: 'Core Shard Lot', item: 'Core Shard', grade: 'RARE', value: 95_000, color: PALETTE.toxic, tags: ['reactor', 'crafting'], detail: 'High-end crafting reagent' },
    ];
    const resources = resourceCatalog.map((res) => ({
      id: res.id,
      title: res.title,
      category: 'resources',
      grade: res.grade,
      owned: stash.items?.[res.item] || 0,
      value: res.value,
      low: Math.round(res.value * 0.66),
      high: Math.round(res.value * 1.6),
      color: res.color,
      image: RESOURCE_IMAGES[res.id],
      tags: res.tags,
      detail: res.detail,
    }));
    return [...cores, ...weapons, ...cosmetics, ...resources];
  }

  _listingThumb(listing) {
    // Resource/token listings use real /public artwork.
    if (listing.image) {
      return `<i class="market-thumb"><img src="${this._esc(listing.image)}" alt="" loading="lazy" /></i>`;
    }
    // Procedural cores/weapons/cosmetics render a live Three.js thumbnail.
    if (listing.assetId) {
      const url = assetThumbnail(listing.assetId, listing.assetOptions, listing.color);
      if (url) return `<i class="market-thumb"><img src="${url}" alt="" /></i>`;
    }
    return '<i></i>';
  }

  _renderMarket() {
    const grid = this.el.querySelector('#marketGrid');
    if (!grid) return;
    const min = Number(String(this.market.min).replace(/[^\d]/g, '') || 0);
    const max = Number(String(this.market.max).replace(/[^\d]/g, '') || Infinity);
    let rows = this._marketListings().filter((listing) => {
      if (this.market.type !== 'all' && this.market.type !== 'owned' && listing.category !== this.market.type) return false;
      if (this.market.type === 'owned' && !listing.owned) return false;
      if (this.market.category !== 'all' && listing.category !== this.market.category) return false;
      if (this.market.grade !== 'all' && listing.grade !== this.market.grade) return false;
      if (listing.value < min || listing.value > max) return false;
      if (this.market.query) {
        const haystack = `${listing.title} ${listing.category} ${listing.grade} ${listing.tags.join(' ')}`.toLowerCase();
        if (!haystack.includes(this.market.query)) return false;
      }
      return true;
    });
    rows.sort((a, b) => {
      if (this.market.sort === 'value_asc') return a.value - b.value;
      if (this.market.sort === 'owned') return (b.owned - a.owned) || b.value - a.value;
      if (this.market.sort === 'name') return a.title.localeCompare(b.title);
      return b.value - a.value;
    });
    this.el.querySelector('#marketCount').textContent = `${rows.length} LISTINGS · ${this.market.watch.size} WATCHED`;
    grid.innerHTML = rows.map((listing) => {
      const watched = this.market.watch.has(listing.id);
      const owned = listing.owned ? `<span class="owned">OWNED ${listing.owned}</span>` : '<span>SCOUTING</span>';
      return `
        <article class="market-card" style="--accent:${listing.color}">
          <div class="market-card-top">
            ${this._listingThumb(listing)}
            <div>${owned}<b>${listing.grade}</b></div>
          </div>
          <h3>${listing.title}</h3>
          <p>${listing.detail}</p>
          <div class="market-price"><b>${formatDeadTokens(listing.value)}</b><span>$DEAD EST.</span></div>
          <div class="market-range">${formatDeadTokens(listing.low)} - ${formatDeadTokens(listing.high)} trade band</div>
          <div class="market-tags">${listing.tags.map((tag) => `<em>${tag}</em>`).join('')}</div>
          <button data-market-watch="${listing.id}">${watched ? 'WATCHING' : listing.owned ? 'LIST FROM VAULT' : 'WATCH'}</button>
        </article>`;
    }).join('') || '<div class="market-empty">No listings match those filters.</div>';
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

  _deploy(online, size) {
    if (this.deploying) return;
    this.deploying = true;
    const loadout = { ...this.loadout };
    // Party size drives the mode (1 SOLO / 2 DUO / 3 TRIO / 4 SQUAD). Solo defaults to 1.
    const partySize = online
      ? Math.max(1, Math.min(MAX_PARTY, Number(size) || this._partySize()))
      : 1;
    this.destroy();
    this.onDeploy(loadout, online, this.name, partySize);
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
    labels.innerHTML = Array.from({ length: MAX_PARTY }, (_, index) => {
      const member = this.members[index];
      return member
        ? `<div data-slot="${index}" class="slot-label occupied ${member.ready ? 'ready' : ''}"><b>${this._esc(member.name)}</b><span>${member.ready ? 'READY' : member.leader ? 'LEADER' : 'NOT READY'}</span></div>`
        : `<div data-slot="${index}" class="slot-label empty"><button data-act="copy" title="Copy party invite"><i>+</i><span>INVITE</span></button></div>`;
    }).join('');

    this._renderModeLabel();
    this._renderRecentRunners();
    this._rebuildModels();
    this._renderReady();
  }

  _partySize() {
    if (!this.online) return 1;
    return Math.max(1, Math.min(MAX_PARTY, this.members.length || 1));
  }

  _renderModeLabel() {
    const size = this._partySize();
    const label = PARTY_MODE_LABELS[size] || 'SQUAD';
    const line = this.el.querySelector('#modeLine');
    if (line) line.textContent = `${size} RUNNER${size === 1 ? '' : 'S'} · ${label} · 8 MIN`;
    const kicker = this.el.querySelector('#modeKicker');
    if (kicker) kicker.textContent = `${label} RUN`;
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
    const modeLabel = PARTY_MODE_LABELS[this._partySize()] || 'SQUAD';
    if (this.localReady && leader && allReady) button.textContent = `DEPLOY ${modeLabel}`;
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
    this.scene.fog = new THREE.FogExp2(0x11191e, 0.032);
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    } catch { /* optional lobby reflections */ }
    this.scene.add(makeSky({ top: '#0f2029', horizon: '#746958' }));
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
    this.camera.position.set(0.35, 3.05, 11.8);
    this.camera.lookAt(0, 1.35, -1.2);
    this.backdrop = new DistantBackdrop({
      min: { x: -42, z: -30 },
      max: { x: 42, z: 30 },
    });
    this.backdrop.root.position.y = -2.55;
    this.scene.add(this.backdrop.root);

    this.scene.add(new THREE.HemisphereLight(0xcde8ff, 0x2b241d, 1.72));
    this.scene.add(new THREE.AmbientLight(0xcfd8d0, 0.22));
    const key = new THREE.DirectionalLight(0xffddb0, 3.1); key.position.set(4, 7, 5); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x5ee8ff, 3.4); rim.position.set(-5, 3, -4); this.scene.add(rim);
    const amberBacklight = new THREE.PointLight(0xffb84f, 14, 22, 2);
    amberBacklight.position.set(0, 2.1, -6.4);
    this.scene.add(amberBacklight);
    const cyanBacklight = new THREE.PointLight(0x7ee8ff, 6.5, 18, 2);
    cyanBacklight.position.set(-4.2, 2.4, -5.8);
    this.scene.add(cyanBacklight);

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
      platform.visible = true;
      this.partyRoot.add(platform);
      this.platforms.push(platform);
    }
    this._buildSetDressing();
    this._rebuildModels();

    const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.58, 0.54, 0.82));
    this.composer.addPass(new OutputPass());
    this.running = true;
    this.clock = new THREE.Clock();
    this._loop();
  }

  _placeSet(id, x, y, z, scale = 1, rotationY = 0, options) {
    const asset = buildAsset(id, options);
    asset.position.set(x, y, z);
    asset.rotation.y = rotationY;
    asset.scale.setScalar(scale);
    this.setRoot.add(asset);
    return asset;
  }

  _addPracticalLight(x, y, z, {
    color = 0xffc46a, intensity = 7, distance = 10, vertical = false, phase = 0, rotationY = 0,
  } = {}) {
    const fixture = new THREE.Group();
    fixture.position.set(x, y, z);
    fixture.rotation.y = rotationY;
    const shellMat = mat('#10171b', { metal: 0.72, rough: 0.56 });
    const glowColor = new THREE.Color(color);
    const tubeMat = new THREE.MeshStandardMaterial({
      color: glowColor,
      emissive: glowColor,
      emissiveIntensity: 3.2,
      roughness: 0.24,
    });
    const shell = new THREE.Mesh(
      new THREE.BoxGeometry(vertical ? 0.18 : 0.94, vertical ? 1.12 : 0.18, 0.16),
      shellMat,
    );
    const tube = new THREE.Mesh(
      new THREE.BoxGeometry(vertical ? 0.07 : 0.76, vertical ? 0.9 : 0.07, 0.08),
      tubeMat,
    );
    tube.position.z = 0.055;
    const light = new THREE.PointLight(color, intensity, distance, 2);
    light.position.z = 0.26;
    fixture.add(shell, tube, light);
    fixture.userData.practical = { light, tube, intensity, phase };
    this.practicalLights.push(fixture.userData.practical);
    this.setRoot.add(fixture);
    return fixture;
  }

  _buildSetDressing() {
    this.setRoot = new THREE.Group();
    this.setRoot.name = 'lobby_breaker_yard_set';
    this.scene.add(this.setRoot);

    const yardTexture = groundTexture('#303e38', 9);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(20, 24, 1, 1),
      new THREE.MeshStandardMaterial({
        color: 0x58614f,
        roughness: 0.98,
        metalness: 0.04,
        map: yardTexture,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.1, -5.1);
    floor.receiveShadow = true;
    this.setRoot.add(floor);

    const grid = new THREE.GridHelper(20, 20, 0x60746c, 0x1a2526);
    grid.position.set(0, -0.075, -5.1);
    grid.material.transparent = true;
    grid.material.opacity = 0.24;
    this.setRoot.add(grid);

    const wallMat = mat('#11191d', { metal: 0.68, rough: 0.72 });
    const wallDark = mat('#0b1114', { metal: 0.64, rough: 0.78 });
    const rearWall = new THREE.Mesh(new THREE.BoxGeometry(19, 8.4, 0.36), wallMat);
    rearWall.position.set(0, 3.55, -13.25);
    this.setRoot.add(rearWall);
    for (const x of [-8.6, -5.2, -1.8, 1.8, 5.2, 8.6]) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(0.26, 7.2, 0.5), wallDark);
      rib.position.set(x, 3.12, -13.02);
      this.setRoot.add(rib);
    }
    for (const x of [-9.8, 9.8]) {
      const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.32, 6.6, 17), wallDark);
      sideWall.position.set(x, 2.8, -6.2);
      this.setRoot.add(sideWall);
    }
    const gantryMat = mat('#202a2e', { metal: 0.6, rough: 0.58 });
    for (const y of [3.1, 4.2]) {
      const beam = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.18, 0.24), gantryMat);
      beam.position.set(0, y, -8.8);
      this.setRoot.add(beam);
    }
    for (const x of [-6.6, 6.6]) {
      const upright = new THREE.Mesh(new THREE.BoxGeometry(0.22, 3.1, 0.22), gantryMat);
      upright.position.set(x, 1.45, -8.8);
      this.setRoot.add(upright);
    }

    for (const [x, z, s, lush] of [
      [-5.8, -2.7, 0.92, 0.58],
      [5.6, -2.9, 0.82, 0.52],
      [-3.8, -5.1, 0.86, 0.45],
      [3.9, -5.4, 0.76, 0.44],
      [-1.5, -7.0, 0.62, 0.38],
      [1.8, -7.25, 0.72, 0.48],
    ]) {
      this._placeSet('rough_grass_patch', x, -0.07, z, s, 0, { lushness: lush });
    }

    this._placeSet('reactor_tower', 0, -0.02, -11.2, 1.42, 0.22);
    this._placeSet('obj_unstable_core', 0, 1.03, -8.55, 1.15, 0.38, {
      variant: 'carry',
      tier: { id: 'yellow', rarity: 'regular' },
    });
    this._placeSet('rail_track', 0, -0.02, -5.9, 1.1);
    this._placeSet('generator', -4.95, 0, -6.4, 0.95, 0.2);
    this._placeSet('generator', 4.95, 0, -6.65, 0.9, -0.16);
    this._placeSet('server_rack', -6.4, 0, -9.4, 0.82, Math.PI / 2);
    this._placeSet('server_rack', 6.35, 0, -9.15, 0.82, -Math.PI / 2);
    this._placeSet('vent', -5.85, 0, -4.0, 0.72, 0.24);
    this._placeSet('vent', 5.75, 0, -4.25, 0.72, -0.22);
    this._placeSet('evergreen_tree', -7.35, -0.08, -3.8, 0.72, -0.25, { height: 5.4 });
    this._placeSet('evergreen_tree', 7.15, -0.08, -3.65, 0.62, 0.34, { height: 4.8, dead: true });
    this._placeSet('dead_shrub', -6.0, -0.05, -2.7, 0.95, 0.2);
    this._placeSet('dead_shrub', 6.1, -0.05, -2.85, 0.88, -0.6, { green: true });
    this._placeSet('scrap_wall', -5.5, 0, -3.6, 0.68, 0.1, { length: 3.8, height: 1.15 });
    this._placeSet('barrier', 5.25, 0, -3.9, 0.7, -0.22, { length: 3.2 });
    this._placeSet('prop_loot_crate', -4.25, 0.02, -4.7, 0.64, 0.4);
    this._placeSet('prop_loot_crate', 4.35, 0.02, -4.95, 0.6, -0.35);
    this._placeSet('fuel_tank', -7.1, 0.02, -6.0, 0.5, Math.PI / 2);
    this._placeSet('pipe_run', 7.1, 0.02, -6.3, 0.58, Math.PI / 2, { length: 5.4 });
    this._placeSet('pipe_run', -5.4, 3.55, -8.55, 1.05, Math.PI / 2, { length: 7.6 });
    this._placeSet('pipe_run', 5.4, 4.22, -9.9, 1.15, Math.PI / 2, { length: 7.2 });
    this._placeSet('market_stall', 0, 0.02, -7.1, 0.56, Math.PI, { color: '#8a4b9f' });
    const tower = this._placeSet('light_tower', -7.65, 0, -4.2, 0.75, -0.2);
    this._placeSet('light_tower', 7.4, 0, -4.9, 0.68, 0.16);

    this._addPracticalLight(-5.9, 3.1, -3.5, { color: 0xffc46a, intensity: 8, distance: 11, phase: 0.4, rotationY: 0.2 });
    this._addPracticalLight(5.9, 3.5, -4.2, { color: 0xeafcff, intensity: 7.5, distance: 12, vertical: true, phase: 1.2, rotationY: -0.12 });
    this._addPracticalLight(-3.4, 4.6, -12.72, { color: 0xf7fbf2, intensity: 6.2, distance: 12, phase: 2.4 });
    this._addPracticalLight(3.4, 4.6, -12.72, { color: 0xffb84f, intensity: 7.4, distance: 12, phase: 3.1 });

    const lamp = new THREE.SpotLight(0xbaf4ff, 8.8, 22, 0.42, 0.8, 2);
    lamp.position.set(-5.6, 5.2, -3.9);
    lamp.target.position.set(0, 0.85, -1.9);
    this.setRoot.add(lamp, lamp.target);
    tower.add(new THREE.PointLight(0xffc46a, 1.8, 5, 2));

    const dustGeometry = new THREE.BufferGeometry();
    const dust = new Float32Array(180 * 3);
    for (let i = 0; i < 180; i++) {
      dust[i * 3] = (Math.random() - 0.5) * 15;
      dust[i * 3 + 1] = 0.25 + Math.random() * 5.4;
      dust[i * 3 + 2] = -1.5 - Math.random() * 12.5;
    }
    dustGeometry.setAttribute('position', new THREE.BufferAttribute(dust, 3));
    this.lobbyDust = new THREE.Points(
      dustGeometry,
      new THREE.PointsMaterial({ color: 0xa9c0ba, size: 0.024, transparent: true, opacity: 0.26 }),
    );
    this.setRoot.add(this.lobbyDust);
  }

  _updateResponsiveCamera(w, h) {
    const narrow = w < 700 || w / Math.max(1, h) < 1.05;
    this.camera.position.set(narrow ? 0.05 : 0.35, narrow ? 3.25 : 3.05, narrow ? 12.6 : 11.8);
    this.camera.lookAt(0, narrow ? 1.44 : 1.35, narrow ? -1.75 : -1.2);
    this.partyRoot.position.set(0, narrow ? 0.24 : 0, narrow ? -1.05 : -0.22);
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
      const label = labels.querySelector(`[data-slot="${index}"]`);
      if (!label) return;
      const empty = label.classList.contains('empty');
      this._labelWorld.set(0, empty ? 0.5 : 0.22, 0);
      platform.localToWorld(this._labelWorld);
      this._labelWorld.project(this.camera);
      const x = (this._labelWorld.x * 0.5 + 0.5) * canvasRect.width + canvasRect.left - labelRect.left;
      const y = (-this._labelWorld.y * 0.5 + 0.5) * canvasRect.height + canvasRect.top - labelRect.top + (empty ? -46 : 72) * platform.scale.x;
      label.style.transform = `translate(${x}px, ${y}px) translate(-50%, 0)`;
    });
  }

  _rebuildModels() {
    if (!this.platforms.length) return;
    const tints = ['#2f78b7', '#7c4353', '#3f7658', '#8a6a38'];
    const activeLayouts = [
      { x: 0, z: 0.38, scale: 1.08 },
      { x: -1.95, z: -0.5, scale: 0.92 },
      { x: 1.95, z: -0.5, scale: 0.92 },
      { x: 3.05, z: -1.38, scale: 0.8 },
    ];
    for (let i = 0; i < this.platforms.length; i++) {
      const slot = this.platforms[i].userData.model;
      disposeObjectTree(slot);
      slot.clear();
      const member = this.members[i];
      const layout = activeLayouts[i];
      this.platforms[i].position.set(layout.x, -0.05, layout.z);
      this.platforms[i].scale.setScalar(layout.scale);
      this.platforms[i].userData.baseY = -0.05;
      this.platforms[i].visible = true;
      this.platforms[i].userData.occupied = Boolean(member);
      this.platforms[i].userData.ring.material.emissiveIntensity = member?.ready ? 3.4 : member ? 1.7 : 0.52;
      this.platforms[i].userData.ring.material.opacity = member ? 1 : 0.54;
      this.platforms[i].userData.ring.material.transparent = !member;
      if (!member) continue;
      const localColors = i === 0 ? (this.loadout._colors || {}) : null;
      const runner = buildAsset('char_runner', { pose: 'aim', colors: localColors ? { jacket: tints[i], ...localColors } : { jacket: tints[i] } });
      const hand = runner.getObjectByName(runner.userData.weaponSocketName || 'hand_r') || runner;
      mountWeaponToSocket(buildAsset(i === 0 ? (this.loadout._primaryWeapon || 'weapon_scrap_pistol') : 'weapon_scrap_pistol'), hand);
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

  // --- Live visual locker: isolated viewport mirroring the asset studio ---
  _initLocker() {
    if (this.locker) return;
    const canvas = this.el.querySelector('#lockerCanvas');
    if (!canvas) return;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    const scene = new THREE.Scene();
    try {
      const pmrem = new THREE.PMREMGenerator(renderer);
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    } catch { /* optional reflections */ }
    scene.add(new THREE.HemisphereLight(0xdfeaff, 0x20262b, 1.9));
    const key = new THREE.DirectionalLight(0xfff0d6, 3.0); key.position.set(3, 5, 4); scene.add(key);
    const rim = new THREE.DirectionalLight(0x6ee8ff, 2.6); rim.position.set(-4, 3, -3); scene.add(rim);
    const fill = new THREE.PointLight(0xffc46a, 6, 14, 2); fill.position.set(0, 2, 4); scene.add(fill);
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.62, 0.78, 0.18, 36),
      mat(PALETTE.steelDark, { metal: 0.45, rough: 0.5 }),
    );
    pedestal.position.y = -0.09; scene.add(pedestal);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.66, 0.02, 6, 40),
      mat(PALETTE.coreGlow, { emissive: PALETTE.coreGlow, emissiveIntensity: 2.2 }),
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.0; scene.add(ring);
    const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
    const pivot = new THREE.Group(); scene.add(pivot);

    this.lockerYaw = 0.6;
    this.lockerPitch = 0.05;
    this.lockerSpin = true;
    this.lockerDist = 5;
    this.lockerTargetY = 1;
    this.locker = { renderer, scene, camera, pivot, canvas, running: true };

    // Drag-to-orbit.
    let dragging = false, lastX = 0, lastY = 0;
    const down = (e) => {
      dragging = true; this.lockerSpin = false;
      const spinBtn = this.el.querySelector('#lockerSpinBtn');
      if (spinBtn) spinBtn.textContent = 'SPIN: OFF';
      const p = e.touches ? e.touches[0] : e;
      lastX = p.clientX; lastY = p.clientY;
    };
    const move = (e) => {
      if (!dragging) return;
      const p = e.touches ? e.touches[0] : e;
      this.lockerYaw += (p.clientX - lastX) * 0.01;
      this.lockerPitch = Math.max(-0.6, Math.min(0.9, this.lockerPitch + (p.clientY - lastY) * 0.006));
      lastX = p.clientX; lastY = p.clientY;
      if (e.cancelable) e.preventDefault();
    };
    const up = () => { dragging = false; };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    this._lockerHandlers = { down, move, up };

    this._lockerLoop();
  }

  _rebuildLocker() {
    if (!this.locker) return;
    const pivot = this.locker.pivot;
    disposeObjectTree(pivot);
    pivot.clear();
    const colors = this._lockerColors();
    const runner = buildAsset('char_runner', { pose: 'aim', colors });
    const hand = runner.getObjectByName(runner.userData.weaponSocketName || 'hand_r') || runner;
    mountWeaponToSocket(buildAsset(this.loadout._primaryWeapon || Stash.load().profile.primaryWeapon || 'weapon_scrap_pistol'), hand);
    const equipped = this.loadout || {};
    for (const [socketName, id] of Object.entries(equipped)) {
      if (socketName.startsWith('_') || !id) continue;
      (runner.getObjectByName(socketName) || runner).add(buildAsset(id));
    }
    pivot.add(runner);
    this._frameLocker(runner);
  }

  _frameLocker(model) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const radius = Math.max(size.x, size.y, size.z) * 0.5 || 1;
    this.lockerTargetY = center.y;
    this.lockerDist = radius / Math.tan((38 * Math.PI / 180) / 2) * 1.5;
  }

  _lockerLoop() {
    if (!this.locker?.running) return;
    requestAnimationFrame(() => this._lockerLoop());
    const { renderer, scene, camera, canvas, pivot } = this.locker;
    const w = canvas.clientWidth || 1, h = canvas.clientHeight || 1;
    if (canvas.width !== w || canvas.height !== h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    }
    if (this.lockerSpin) this.lockerYaw += 0.008;
    const dist = this.lockerDist;
    camera.position.set(
      Math.sin(this.lockerYaw) * Math.cos(this.lockerPitch) * dist,
      this.lockerTargetY + Math.sin(this.lockerPitch) * dist,
      Math.cos(this.lockerYaw) * Math.cos(this.lockerPitch) * dist,
    );
    camera.lookAt(0, this.lockerTargetY, 0);
    const time = performance.now() * 0.001;
    pivot.traverse((object) => { if (object.userData?.updateIdle) object.userData.updateIdle(time, 0.9); });
    renderer.render(scene, camera);
  }

  _destroyLocker() {
    if (!this.locker) return;
    this.locker.running = false;
    const h = this._lockerHandlers;
    if (h) {
      this.locker.canvas.removeEventListener('pointerdown', h.down);
      window.removeEventListener('pointermove', h.move);
      window.removeEventListener('pointerup', h.up);
    }
    try { disposeObjectTree(this.locker.scene); } catch { /* noop */ }
    try { this.locker.renderer.dispose(); } catch { /* noop */ }
    this.locker = null;
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
    if (this.lobbyDust) {
      this.lobbyDust.rotation.y = Math.sin(time * 0.08) * 0.04;
      this.lobbyDust.position.y = Math.sin(time * 0.18) * 0.08;
    }
    this.setRoot?.traverse((object) => {
      if (object.userData?.updateIdle) object.userData.updateIdle(time, 0.86);
    });
    this.practicalLights.forEach((fixture, index) => {
      const flutter = Math.sin(time * (6.4 + index * 0.55) + fixture.phase);
      const pulse = flutter > 0.9 ? 0.58 : 1;
      fixture.light.intensity = fixture.intensity * pulse;
      fixture.tube.material.emissiveIntensity = 2.5 + pulse * 1.25;
    });
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
    this._destroyLocker();
    this.party?.disconnect();
    disposeObjectTree(this.scene);
    try { this.composer?.dispose?.(); } catch { /* noop */ }
    try { this.renderer?.dispose(); } catch { /* noop */ }
    this.el.remove();
  }
}
