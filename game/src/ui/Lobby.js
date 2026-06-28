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
import { DistantBackdrop } from '../world/DistantBackdrop.js';
import { disposeObjectTree } from '../render/dispose.js';
import { Stash } from '../systems/Stash.js';
import { Account } from '../net/account.js';
import { matchWsBase } from '../config/runtime.js';
import { CORE_TIER_LIST, coreTierOdds, coreTokenRange, estimateCoreTokenValue, formatDeadTokens, runUpgradeModifiers } from '../data/economy.js';

const MAX_PARTY = 4;
const MARKET_CATEGORIES = ['all', 'cores', 'cosmetics', 'weapons', 'resources'];

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
        <div class="social-rule"></div>
        <div class="panel-kicker">RECENT RUNNERS</div>
        <div class="recent-empty">Runners from online raids appear here.<br/>Share your party code to squad up.</div>
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

      <section class="lobby-page glass" id="loadoutPanel" aria-label="Loadout">
        <div class="page-head">
          <div><small>RUNNER CONFIGURATION</small><h2>LOADOUT</h2></div>
          <button data-act="lobby">CLOSE</button>
        </div>
        <div class="loadout-page-grid">
          <div>
            <h3>FIELD KIT</h3>
            <div class="weapon-grid" id="weaponGrid"></div>
            <h3>JACKET COLOR</h3>
            <div class="tint-swatches" id="tintSwatches"></div>
          </div>
          <div>
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
      onLaunch: () => this._deploy(true),
    });

    this._initScene();
    this._renderParty();
    this._renderProgression();
    this._renderLoadout();
    this._renderCareer();
    this._renderFriends();
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
      const link = `${location.origin}${location.pathname}?party=${this.partyCode}`;
      await navigator.clipboard?.writeText(link);
      this._setSocialMessage(`PARTY INVITE COPIED FOR ${source.dataset.handle || 'FRIEND'}`);
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
    if (action === 'setTint') {
      this._setTint(source.dataset.tint);
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
    this._setSocialMessage(this.social.message);
  }

  _renderFriendResults() {
    const target = this.el.querySelector('#friendResults');
    if (!target) return;
    target.innerHTML = this.social.results.length
      ? `<h3>SEARCH RESULTS</h3>${this.social.results.map((person) => this._socialRow(person,
        `<button data-act="friendAdd" data-profile-id="${person.id}">ADD FRIEND</button>`)).join('')}`
      : '';
  }

  _renderLoadout() {
    const stash = Stash.load();
    const weapons = [
      { id: 'weapon_scrap_pistol', name: 'SCRAP PISTOL', detail: 'Reliable sidearm · balanced handling' },
      { id: 'weapon_burst_rifle', name: 'BURST RIFLE', detail: 'Three-round pressure · medium range' },
      { id: 'weapon_arc_shotgun', name: 'ARC SHOTGUN', detail: 'Wide discharge · close range' },
    ];
    const weaponGrid = this.el.querySelector('#weaponGrid');
    if (weaponGrid) weaponGrid.innerHTML = weapons.map((weapon) =>
      `<button data-act="selectWeapon" data-weapon-id="${weapon.id}" class="${stash.profile.primaryWeapon === weapon.id ? 'selected' : ''}">
        <b>${weapon.name}</b><span>${weapon.detail}</span><em>${stash.profile.primaryWeapon === weapon.id ? 'DEPLOY PRIMARY' : 'SET PRIMARY'}</em>
      </button>`
    ).join('');
    const swatches = ['#3b4a5a', '#8a4b3f', '#3e6b55', '#b28a3f', '#d9ddda', '#242a2e'];
    const tintTarget = this.el.querySelector('#tintSwatches');
    if (tintTarget) tintTarget.innerHTML = swatches.map((tint) =>
      `<button data-act="setTint" data-tint="${tint}" class="${stash.profile.tint === tint ? 'on' : ''}" style="--swatch:${tint}" aria-label="Use jacket color ${tint}"></button>`
    ).join('');
    const cosmetics = ASSETS.filter((asset) => asset.category === 'cosmetic');
    const grid = this.el.querySelector('#cosmeticGrid');
    if (!grid) return;
    grid.innerHTML = cosmetics.map((asset) => {
      const unlocked = Stash.isCosmeticUnlocked(asset, stash);
      const equipped = stash.profile.equipped?.[asset.slot] === asset.id;
      const unlock = asset.unlock ? `LV ${asset.unlock.level || 1} + ${asset.unlock.qty || 1} ${asset.unlock.item}` : 'STARTER ISSUE';
      return `<button class="cosmetic-item ${equipped ? 'equipped' : ''}" data-act="equipCosmetic" data-asset-id="${asset.id}" ${unlocked ? '' : 'disabled'}>
        <i></i><span><b>${this._esc(asset.displayName)}</b><small>${this._esc(asset.slot)} · ${this._esc(asset.rarity || 'common')}</small></span>
        <em>${equipped ? 'EQUIPPED' : unlocked ? 'EQUIP' : unlock}</em>
      </button>`;
    }).join('');
  }

  _equipCosmetic(assetId) {
    const asset = ASSETS.find((item) => item.id === assetId && item.category === 'cosmetic');
    const stash = Stash.load();
    if (!asset || !Stash.isCosmeticUnlocked(asset, stash)) return;
    const equipped = { ...stash.profile.equipped, [asset.slot]: asset.id };
    const profile = Stash.saveProfile({ equipped });
    this.loadout = { ...profile.equipped, _colors: { jacket: profile.tint } };
    this._renderLoadout();
    this._rebuildModels();
  }

  _selectWeapon(weaponId) {
    if (!['weapon_scrap_pistol', 'weapon_burst_rifle', 'weapon_arc_shotgun'].includes(weaponId)) return;
    const profile = Stash.saveProfile({ primaryWeapon: weaponId });
    this.loadout = { ...this.loadout, _primaryWeapon: profile.primaryWeapon };
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
        tags: ['extractable', 'vault', 'open market'],
        detail: `${tier.item} · ${tier.shardYield + mods.shardBonus} shard yield`,
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
          tags: [asset.slot || 'universal', asset.rarity || 'common', asset.tier || 'starter'],
          detail: `${asset.slot || 'cosmetic'} · universal fit`,
        };
      });
    const resources = [
      { id: 'res-parts', title: 'Machine Parts Bundle', category: 'resources', grade: 'MATERIAL', owned: stash.items?.Parts || 0, value: 28_000, low: 18_000, high: 44_000, color: PALETTE.warningAmber, tags: ['weapons', 'crafting'], detail: 'Upgrade feedstock' },
      { id: 'res-components', title: 'Component Crate', category: 'resources', grade: 'MATERIAL', owned: stash.items?.Components || 0, value: 36_000, low: 22_000, high: 60_000, color: PALETTE.accentCyan, tags: ['base', 'crafting'], detail: 'Base and gear upgrades' },
      { id: 'res-shards', title: 'Core Shard Lot', category: 'resources', grade: 'RARE', owned: stash.items?.['Core Shard'] || 0, value: 95_000, low: 62_000, high: 145_000, color: PALETTE.toxic, tags: ['reactor', 'crafting'], detail: 'Used for high-end crafting' },
    ];
    return [...cores, ...cosmetics, ...resources];
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
            <i></i>
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
    this.renderer.toneMappingExposure = 1.32;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x687872, 20, 96);
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    } catch { /* optional lobby reflections */ }
    this.scene.add(makeSky({ top: '#172733', horizon: '#6f695a' }));
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 300);
    this.camera.position.set(0.35, 3.05, 11.8);
    this.camera.lookAt(0, 1.35, -1.2);
    this.backdrop = new DistantBackdrop({
      min: { x: -42, z: -30 },
      max: { x: 42, z: 30 },
    });
    this.backdrop.root.position.y = -2.1;
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
    this._buildSetDressing();
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

  _placeSet(id, x, y, z, scale = 1, rotationY = 0, options) {
    const asset = buildAsset(id, options);
    asset.position.set(x, y, z);
    asset.rotation.y = rotationY;
    asset.scale.setScalar(scale);
    this.setRoot.add(asset);
    return asset;
  }

  _buildSetDressing() {
    this.setRoot = new THREE.Group();
    this.setRoot.name = 'lobby_breaker_yard_set';
    this.scene.add(this.setRoot);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(8.4, 18),
      mat('#35443c', { rough: 0.95 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, -0.09, -0.25);
    floor.receiveShadow = true;
    this.setRoot.add(floor);

    for (const [x, z, s, lush] of [
      [-3.9, 1.2, 1.1, 0.58],
      [3.8, 0.9, 1.0, 0.52],
      [-2.2, -2.2, 0.78, 0.42],
      [2.6, -2.5, 0.72, 0.44],
      [0, 2.5, 0.9, 0.48],
    ]) {
      this._placeSet('rough_grass_patch', x, -0.07, z, s, 0, { lushness: lush });
    }

    this._placeSet('evergreen_tree', -5.7, -0.08, -2.0, 0.92, -0.25, { height: 5.8 });
    this._placeSet('evergreen_tree', 5.4, -0.08, -1.35, 0.76, 0.34, { height: 5.1, dead: true });
    this._placeSet('dead_shrub', -4.6, -0.05, 1.6, 1.25, 0.2);
    this._placeSet('dead_shrub', 4.5, -0.05, 1.35, 1.0, -0.6, { green: true });
    this._placeSet('scrap_wall', -4.15, 0, -3.3, 0.72, 0.18, { length: 4.2, height: 1.15 });
    this._placeSet('barrier', 4.0, 0, -3.1, 0.78, -0.28, { length: 3.2 });
    this._placeSet('prop_loot_crate', -2.95, 0.02, 1.95, 0.82, 0.4);
    this._placeSet('prop_loot_crate', 3.05, 0.02, 2.15, 0.72, -0.35);
    this._placeSet('fuel_tank', -5.4, 0.02, 2.75, 0.5, Math.PI / 2);
    this._placeSet('pipe_run', 5.2, 0.02, 2.85, 0.58, Math.PI / 2, { length: 5.4 });
    this._placeSet('market_stall', 0, 0.02, 3.55, 0.64, Math.PI, { color: '#8a4b9f' });
    const tower = this._placeSet('light_tower', -6.5, 0, 1.2, 0.8, -0.2);
    const lamp = new THREE.SpotLight(0xbaf4ff, 7.2, 18, 0.45, 0.8, 2);
    lamp.position.set(-5.2, 5.2, 1.2);
    lamp.target.position.set(0, 0.9, -0.4);
    this.setRoot.add(lamp, lamp.target);
    tower.add(new THREE.PointLight(0xffc46a, 1.8, 5, 2));
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
