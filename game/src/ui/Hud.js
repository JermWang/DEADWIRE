// Hud — DOM overlay: timer, health, weapon/ammo, objective, prompts, damage numbers.
import * as THREE from 'three';
import { Hints } from './Hints.js';

const GOLD_TOKEN_IMAGE_URL = '/dead%20gold%20token.png';

function lootLabel(item) {
  if (item !== 'Gold') return item;
  return `<span class="gold-token-label"><img src="${GOLD_TOKEN_IMAGE_URL}" alt="" />Gold</span>`;
}

export class Hud {
  constructor(root, camera) {
    this.camera = camera;
    this._hintRoot = root;
    this.el = document.createElement('div');
    this.el.className = 'hud';
    this.el.innerHTML = `
      <div class="hud-top">
        <div class="timer" id="hudTimer">8:00</div>
        <div class="objective" id="hudObjective">Survive until the reactor core surfaces</div>
      </div>
      <div class="hud-banner" id="hudBanner"></div>
      <div class="hud-bottom">
        <div class="vitals">
          <div class="bar"><div class="bar-fill" id="hudHpFill"></div><span id="hudHpText">100</span></div>
          <div class="weaponline"><div class="weapon" id="hudWeapon"></div><div class="ammo" id="hudAmmo"></div></div>
        </div>
        <div class="loot" id="hudLoot"></div>
      </div>
      <div class="prompt" id="hudPrompt"></div>
      <div class="movement-tag" id="hudMovement"></div>
      <div class="core-tag" id="hudCore"></div>
      <canvas class="minimap" id="hudMinimap" width="184" height="184"></canvas>
      <div class="markers" id="hudMarkers"></div>
      <div class="siren" id="hudSiren"></div>
      <div class="lowhp" id="hudLowHp"></div>
      <div class="reticle-aim" id="hudReticle"></div>
      <div class="aim-hint" id="hudAimHint">CLICK TO AIM</div>
      <div class="fx-layer" id="hudFx"></div>`;
    root.appendChild(this.el);
    this.$ = (id) => this.el.querySelector('#' + id);
    this._v = new THREE.Vector3();
    this._dmg = [];
    this._markers = new Map();
    this._mini = this.$('hudMinimap').getContext('2d');
    // First-time deploy: controls + extraction-loop coachmarks, then a short
    // economy explainer once those close. No-op for veterans (Hints checks
    // Stash.onboarded read-only) and once dismissed/muted.
    this._hintTimer = setTimeout(() => this.showFirstRunHints(), 1600);
  }

  // Plays the in-run tutorial: HUD/controls sequence, then the economy primer.
  // Chained so the two non-blocking popups never overlap.
  showFirstRunHints() {
    const root = this._hintRoot;
    if (!root || !this.el.isConnected) return; // HUD already torn down
    const hudRun = Hints.show('hud', root);
    if (hudRun) {
      const wasOnClose = hudRun.onClose;
      hudRun.onClose = () => { wasOnClose?.(); setTimeout(() => Hints.show('economy', root), 600); };
    } else {
      // HUD tips already seen/muted — still offer the economy primer if pending.
      Hints.show('economy', root);
    }
  }

  setTimer(sec) {
    const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    const t = this.$('hudTimer'); t.textContent = `${m}:${String(s).padStart(2, '0')}`;
    t.classList.toggle('warn', sec <= 60);
  }
  setObjective(text) { this.$('hudObjective').textContent = text; }
  setWeapon(names, activeIndex) {
    this.$('hudWeapon').innerHTML = names.map((n, i) =>
      `<span class="wchip ${i === activeIndex ? 'on' : ''}"><b>${i + 1}</b> ${n}<i class="wcd"></i></span>`).join('');
    this._wcd = this.el.querySelector('.wchip.on .wcd');
  }
  // ratio 0 = just fired (empty), 1 = ready to fire (full)
  setWeaponCooldown(ratio) {
    if (this._wcd) this._wcd.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
  }
  setHealth(hp, max) {
    if (this._lastHp != null && hp < this._lastHp) {
      const bar = this.el.querySelector('.bar');
      bar.classList.remove('hit'); void bar.offsetWidth; bar.classList.add('hit');
    }
    this._lastHp = hp;
    this.$('hudHpFill').style.width = `${Math.max(0, (hp / max) * 100)}%`;
    this.$('hudHpText').textContent = Math.ceil(hp);
    this.$('hudLowHp').classList.toggle('on', hp > 0 && hp / max < 0.3);
  }
  setLoot(items) {
    const entries = Object.entries(items);
    this.$('hudLoot').innerHTML = entries.length
      ? entries.map(([k, v]) => `<span class="loot-chip">${lootLabel(k)} <b>${v}</b></span>`).join('')
      : '<span class="loot-empty">No loot yet</span>';
  }
  setCore(state) {
    const el = this.$('hudCore');
    if (state === 'carrying') { el.textContent = '◈ REACTOR CORE — you are exposed'; el.className = 'core-tag on'; }
    else if (state === 'dropped') { el.textContent = '◈ Reactor core dropped'; el.className = 'core-tag drop'; }
    else el.className = 'core-tag';
  }
  setMovement(state, rollCooldown = 0) {
    const el = this.$('hudMovement');
    if (!el) return;
    const roll = rollCooldown > 0 ? `ROLL ${rollCooldown.toFixed(1)}s` : 'Q · ROLL READY';
    el.textContent = state ? `${state}  ·  ${roll}` : roll;
    el.classList.toggle('active', !!state);
  }
  prompt(text) { const p = this.$('hudPrompt'); p.textContent = text || ''; p.style.opacity = text ? '1' : '0'; }
  banner(text, ms = 2200) {
    const b = this.$('hudBanner'); b.textContent = text; b.classList.add('show');
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('show'), ms);
  }
  flashHurt() {
    const f = this.$('hudFx'); f.classList.remove('hurt'); void f.offsetWidth; f.classList.add('hurt');
  }
  siren() {
    const s = this.$('hudSiren'); s.classList.remove('on'); void s.offsetWidth; s.classList.add('on');
  }

  // top-right tactical minimap (whole-arena, fixed orientation)
  drawMinimap(state) {
    const ctx = this._mini, S = 184;
    const [minX, minZ, maxX, maxZ] = state.bounds;
    const sc = S / (maxX - minX);
    const tx = (x) => (x - minX) * sc, tz = (z) => (z - minZ) * sc;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(10,14,16,0.82)'; ctx.fillRect(0, 0, S, S);
    // extraction zones
    for (const e of state.extracts) {
      ctx.beginPath(); ctx.arc(tx(e.x), tz(e.z), e.r * sc, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(155,255,90,0.18)'; ctx.fill();
      ctx.strokeStyle = '#9bff5a'; ctx.lineWidth = 1.5; ctx.stroke();
    }
    // crates
    for (const c of state.crates) {
      ctx.fillStyle = c.opened ? 'rgba(99,210,255,0.25)' : '#63d2ff';
      ctx.fillRect(tx(c.x) - 1.5, tz(c.z) - 1.5, 3, 3);
    }
    // enemies
    for (const e of state.enemies) {
      if (!e.alive) continue;
      ctx.fillStyle = '#ff5436';
      const r = e.kind === 'tank' ? 3.5 : 2.2;
      ctx.beginPath(); ctx.arc(tx(e.x), tz(e.z), r, 0, Math.PI * 2); ctx.fill();
    }
    // core
    if (state.core && state.core.spawned && !state.core.carried) {
      ctx.fillStyle = '#54f7c8';
      ctx.beginPath(); ctx.arc(tx(state.core.x), tz(state.core.z), 3.5 + state.pulse * 2, 0, Math.PI * 2); ctx.fill();
    }
    // player triangle
    const px = tx(state.player.x), py = tz(state.player.z), a = state.player.facing;
    ctx.save(); ctx.translate(px, py); ctx.rotate(-a);
    ctx.fillStyle = state.carrying ? '#54f7c8' : '#f4f7ef';
    ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 4); ctx.lineTo(-3.5, 4); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#2b343a'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, S - 2, S - 2);
  }

  // world-space objective markers; clamps to screen edge with an arrow when off-screen
  setMarkers(list, renderer) {
    const rect = renderer.domElement.getBoundingClientRect();
    const keep = new Set();
    for (const m of list) {
      keep.add(m.key);
      let el = this._markers.get(m.key);
      if (!el) {
        el = document.createElement('div'); el.className = 'marker';
        this.$('hudMarkers').appendChild(el); this._markers.set(m.key, el);
      }
      this._v.copy(m.pos); this._v.project(this.camera);
      const behind = this._v.z > 1;
      let x = (this._v.x * 0.5 + 0.5) * rect.width;
      let y = (-this._v.y * 0.5 + 0.5) * rect.height;
      const pad = 38;
      const onScreen = !behind && x > pad && x < rect.width - pad && y > pad && y < rect.height - pad;
      if (!onScreen) {
        // clamp toward edge from center
        let dx = x - rect.width / 2, dy = y - rect.height / 2;
        if (behind) { dx = -dx; dy = -dy; }
        const ang = Math.atan2(dy, dx);
        const rx = rect.width / 2 - pad, ry = rect.height / 2 - pad;
        x = rect.width / 2 + Math.cos(ang) * rx;
        y = rect.height / 2 + Math.sin(ang) * ry;
        el.classList.add('edge');
        el.style.setProperty('--rot', `${ang + Math.PI / 2}rad`);
      } else {
        el.classList.remove('edge');
      }
      el.style.setProperty('--c', m.color);
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.dataset.label = m.label;
      el.style.opacity = onScreen && m.edgeOnly ? '0' : '1';
    }
    for (const [key, el] of this._markers) {
      if (!keep.has(key)) { el.remove(); this._markers.delete(key); }
    }
  }

  setReticle(screenX, screenY) {
    const r = this.$('hudReticle');
    r.style.transform = `translate(${screenX}px, ${screenY}px)`;
  }
  setAimHint(show) {
    const h = this.$('hudAimHint');
    if (h) h.style.opacity = show ? '1' : '0';
  }
  setAmmo(n) {
    const el = this.$('hudAmmo');
    if (!el) return;
    el.innerHTML = `<b>${n}</b> AMMO`;
    el.classList.toggle('low', n <= 20);
    el.classList.toggle('empty', n <= 0);
  }

  // floating damage number at a world position
  popDamage(worldPos, amount, kind = 'enemy') {
    const d = document.createElement('div');
    d.className = `dmg ${kind}`; d.textContent = Math.round(amount);
    this.el.appendChild(d);
    this._dmg.push({ el: d, pos: worldPos.clone(), t: 0 });
  }

  update(dt, renderer) {
    const rect = renderer.domElement.getBoundingClientRect();
    for (let i = this._dmg.length - 1; i >= 0; i--) {
      const d = this._dmg[i]; d.t += dt;
      this._v.copy(d.pos); this._v.y += 1 + d.t * 1.5;
      this._v.project(this.camera);
      const x = (this._v.x * 0.5 + 0.5) * rect.width;
      const y = (-this._v.y * 0.5 + 0.5) * rect.height;
      d.el.style.transform = `translate(${x}px, ${y}px)`;
      d.el.style.opacity = String(1 - d.t / 0.7);
      if (d.t > 0.7) { d.el.remove(); this._dmg.splice(i, 1); }
    }
  }
}
