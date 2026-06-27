// MainMenu — gamified landing screen. The runner (a live, rotating 3D asset) is
// the visual centerpiece; editing the loadout rebuilds it in real time. Runs its
// own small Three.js scene so it's fully decoupled from the match renderer.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildAsset, byCategory, mountWeaponToSocket, PALETTE } from '../assets.js';
import { makeSky } from '../render/Sky.js';
import { Stash } from '../systems/Stash.js';
import { Account } from '../net/account.js';
import { Wallet } from '../net/wallet.js';

export class MainMenu {
  constructor(root, { onPlay }) {
    this.root = root;
    this.onPlay = onPlay;
    this.loadout = {};            // slot -> cosmetic id
    this.tint = '#3b4a5a';
    this.running = false;
    this.dragging = false;
    this.spin = 0;
    this._build();
  }

  _build() {
    const stash = Stash.load();
    const cosmetics = byCategory('cosmetic');
    const slots = [...new Set(cosmetics.map((c) => c.slot))];

    this.el = document.createElement('div');
    this.el.className = 'menu';
    this.el.innerHTML = `
      <div class="menu-bg"></div>
      <div class="menu-grid">
        <div class="menu-left">
          <div class="brand">DEAD<span>WIRE</span></div>
          <div class="brand-sub">REACTOR-ZONE EXTRACTION</div>
          <div class="menu-actions">
            <button class="m-btn primary" data-act="solo"><span class="k">▶</span> PLAY · CORE RUN</button>
            <button class="m-btn" data-act="online"><span class="k">◈</span> PLAY ONLINE</button>
            <button class="m-btn" data-act="loadout"><span class="k">✦</span> LOADOUT</button>
            <button class="m-btn" data-act="wallet"><span class="k">⬡</span> CONNECT WALLET</button>
          </div>
          <div class="wallet-status" id="walletStatus">Solana · mainnet · not connected</div>
          <div class="menu-stash">
            <div class="ms-row"><span>RANK</span><b id="msLevel">Lv ${stash.level}</b></div>
            <div class="ms-row"><span>RUNS</span><b id="msRuns">${stash.runs}</b></div>
            <div class="ms-row"><span>EXTRACTIONS</span><b id="msExtractions">${stash.extractions}</b></div>
          </div>
          <div class="menu-board">
            <div class="mb-head"><span>TOP RUNNERS</span><span id="warMap" class="mb-war">—</span></div>
            <div id="leaderboardRows" class="mb-rows"><div class="mb-empty">loading…</div></div>
          </div>
          <div class="menu-foot">WASD move · Shift sprint · Space jump · Q roll · RMB aim · LMB fire · E interact · M map debug</div>
        </div>

        <div class="menu-hero">
          <canvas id="heroCanvas"></canvas>
          <div class="hero-tag" id="heroTag">RUNNER</div>
        </div>

        <div class="menu-right" id="loadoutPanel">
          <div class="lo-title">LOADOUT</div>
          <div class="lo-field">
            <label>Callsign</label>
            <input id="callsign" maxlength="14" placeholder="Runner" />
          </div>
          <div id="loSlots"></div>
          <div class="lo-field">
            <label>Jacket tint</label>
            <div class="swatches" id="tints"></div>
          </div>
        </div>
      </div>`;
    this.root.appendChild(this.el);

    // loadout slot selectors
    const loSlots = this.el.querySelector('#loSlots');
    for (const slot of slots) {
      const opts = cosmetics.filter((c) => c.slot === slot);
      const wrap = document.createElement('div');
      wrap.className = 'lo-field';
      wrap.innerHTML = `<label>${slot}</label>`;
      const sel = document.createElement('select');
      sel.innerHTML = `<option value="">None</option>` +
        opts.map((o) => `<option value="${o.id}">${o.displayName} · ${o.rarity || 'common'}</option>`).join('');
      sel.onchange = () => { this.loadout[slot] = sel.value || undefined; this._rebuildHero(); };
      wrap.appendChild(sel);
      loSlots.appendChild(wrap);
    }

    // jacket tint swatches
    const tints = ['#3b4a5a', '#5a3b4a', '#3b5a44', '#5a4f3b', '#46405a', '#222a2f'];
    const tintWrap = this.el.querySelector('#tints');
    tints.forEach((hex, i) => {
      const s = document.createElement('button');
      s.className = 'swatch' + (i === 0 ? ' on' : '');
      s.style.background = hex;
      s.onclick = () => {
        this.tint = hex;
        tintWrap.querySelectorAll('.swatch').forEach((x) => x.classList.remove('on'));
        s.classList.add('on');
        this._rebuildHero();
      };
      tintWrap.appendChild(s);
    });

    // actions
    this.el.querySelectorAll('.m-btn').forEach((b) => {
      b.onclick = () => {
        const act = b.dataset.act;
        if (act === 'loadout') { this.el.classList.toggle('show-loadout'); return; }
        if (act === 'wallet') { this._connectWallet(); return; }
        this._play(act === 'online');
      };
    });

    this._initHero();
    this._loadOnlineBoards();
  }

  _esc(s) { return String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c])); }

  // Public reads from Supabase (anon, RLS-allowed): leaderboard + sector control.
  async _loadOnlineBoards() {
    const rows = this.el?.querySelector('#leaderboardRows');
    const war = this.el?.querySelector('#warMap');
    try {
      const { leaderboard, warMap } = await import('../net/supabase.js');
      const [board, sectors] = await Promise.all([leaderboard(5), warMap().catch(() => [])]);
      if (rows) {
        rows.innerHTML = board.length
          ? board.map((r, i) => {
              const name = this._esc(r.handle || (r.wallet ? `${r.wallet.slice(0, 4)}…` : 'Runner'));
              return `<div class="mb-row"><span class="mb-rank">${i + 1}</span><span class="mb-name">${name}</span><span class="mb-lv">Lv ${r.level}</span><span class="mb-ex">${r.extractions} ext</span></div>`;
            }).join('')
          : '<div class="mb-empty">No runners yet — be the first to extract.</div>';
      }
      if (war) {
        const held = sectors.filter((s) => s.owner_profile_id).length;
        war.textContent = sectors.length ? `${held}/${sectors.length} districts held` : '';
      }
    } catch {
      if (rows) rows.innerHTML = '<div class="mb-empty">leaderboard offline</div>';
    }
  }

  _short(addr) { return `${addr.slice(0, 4)}…${addr.slice(-4)}`; }

  async _connectWallet() {
    const status = this.el.querySelector('#walletStatus');
    if (Account.isLoggedIn()) {
      status.textContent = `Solana · ${Wallet.cluster()} · ${this._short(Account.wallet)} ✓`;
      return;
    }
    try {
      status.textContent = 'Connecting wallet…';
      const { wallet } = await Account.signIn();
      status.textContent = `Solana · ${Wallet.cluster()} · ${this._short(wallet)} ✓`;
      this._refreshStash();   // cloud stash hydrated the local cache on login
    } catch (e) {
      status.textContent = e?.message || 'Wallet connect failed';
    }
  }

  _refreshStash() {
    const s = Stash.load();
    const set = (id, v) => { const el = this.el.querySelector(id); if (el) el.textContent = v; };
    set('#msLevel', `Lv ${s.level}`);
    set('#msRuns', s.runs);
    set('#msExtractions', s.extractions);
  }

  _play(online) {
    const name = (this.el.querySelector('#callsign').value || 'Runner').slice(0, 14);
    this.destroy();
    this.onPlay({ ...this.loadout }, online, name);
  }

  // ---- 3D hero render ----
  _initHero() {
    const canvas = this.el.querySelector('#heroCanvas');
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(34, 1, 0.1, 800);
    this.camera.position.set(0, 1.5, 5.2);
    this.camera.lookAt(0, 1.05, 0);

    // graded sky backdrop so the hero stands in an environment (and bloom can run opaque)
    this.scene.add(makeSky({ top: '#2b3a47', horizon: '#7d7159' }));

    this.scene.add(new THREE.HemisphereLight(0xcfe2f5, 0x4a3a2c, 2.4));
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.5));
    const key = new THREE.DirectionalLight(0xfff1da, 3.0); key.position.set(3, 5, 4); this.scene.add(key);
    const rim = new THREE.DirectionalLight(0x8fdcff, 2.0); rim.position.set(-4, 3, -3); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xf2c98a, 0.8); fill.position.set(2, 1, -4); this.scene.add(fill);

    // pedestal
    const pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(1.1, 1.3, 0.25, 8),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.steelDark), roughness: 0.7, metalness: 0.3, flatShading: true }),
    );
    pedestal.position.y = -0.12; this.scene.add(pedestal);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.18, 0.03, 6, 32),
      new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.coreGlow), emissive: new THREE.Color(PALETTE.coreGlow), emissiveIntensity: 1.5 }),
    );
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.02; this.scene.add(ring);

    this.heroGroup = new THREE.Group();
    this.scene.add(this.heroGroup);
    this._rebuildHero();

    // drag to rotate
    canvas.addEventListener('mousedown', (e) => { this.dragging = true; this._lastX = e.clientX; });
    addEventListener('mouseup', () => { this.dragging = false; });
    addEventListener('mousemove', (e) => { if (this.dragging) { this.spin += (e.clientX - this._lastX) * 0.01; this._lastX = e.clientX; } });

    // bloom composer (makes the visor / core ring / glows pop like a real engine)
    const w = canvas.clientWidth || 1280, h = canvas.clientHeight || 720;
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.65, 0.6, 0.8));
    this.composer.addPass(new OutputPass());

    this.running = true;
    this._loop();
  }

  _rebuildHero() {
    if (!this.heroGroup) return;
    this.heroGroup.clear();
    const hero = buildAsset('char_runner', { pose: 'aim', colors: { jacket: this.tint } });
    hero.updateWorldMatrix(true, true);
    // Keep the weapon locked to the corrected shooting-hand socket.
    const weapon = buildAsset('weapon_scrap_pistol');
    const hand = hero.getObjectByName(hero.userData.weaponSocketName || 'hand_r') || hero;
    mountWeaponToSocket(weapon, hand);
    // cosmetics
    for (const [slot, id] of Object.entries(this.loadout)) {
      if (!id) continue;
      const cos = buildAsset(id);
      (hero.getObjectByName(slot) || hero).add(cos);
    }
    this.heroGroup.add(hero);
  }

  _loop() {
    if (!this.running) return;
    requestAnimationFrame(() => this._loop());
    const canvas = this.renderer.domElement;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) {
      this.renderer.setSize(w, h, false); this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix();
      this.composer?.setSize(w, h);
    }
    if (!this.dragging) this.spin += 0.004;
    this.heroGroup.rotation.y = this.spin;
    this.composer.render();
  }

  destroy() {
    this.running = false;
    try { this.composer?.dispose?.(); } catch { /* noop */ }
    try { this.renderer?.dispose(); } catch { /* noop */ }
    this.el.remove();
  }
}
