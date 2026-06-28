// Hints — lightweight, dismissible coachmark / tutorial system for new players.
// Self-contained: injects its own CSS (does NOT touch styles.css), persists
// "seen" + "don't show again" flags to localStorage, and only nags new runners.
//
// Usage:
//   import { Hints } from './ui/Hints.js';
//   Hints.show('menu', root);            // play a named sequence once
//   Hints.show('hud', root);             // controls + extraction loop
//   Hints.show('economy', root);         // Gold vs $DEAD vs gold tokens
// Each sequence only fires once per browser unless Hints.reset() is called.

import { Stash } from '../systems/Stash.js';

const KEY = 'deadwire.hints.v1';
const STYLE_ID = 'deadwire-hints-style';

// On-brand reactor palette (amber / cyan) — kept local so styles.css is untouched.
const CSS = `
.dw-hint-layer{position:fixed;inset:0;z-index:1400;pointer-events:none;
  font-family:inherit;display:flex;align-items:center;justify-content:center;}
.dw-hint-layer.dw-dim::before{content:"";position:absolute;inset:0;
  background:radial-gradient(120% 120% at 50% 42%,rgba(4,9,11,.32),rgba(4,9,11,.72));
  opacity:0;transition:opacity .45s ease;}
.dw-hint-layer.dw-dim.dw-in::before{opacity:1;}
.dw-hint{pointer-events:auto;position:relative;max-width:380px;width:calc(100% - 48px);
  background:linear-gradient(160deg,rgba(14,21,24,.97),rgba(9,14,16,.97));
  border:1px solid rgba(99,210,255,.28);border-radius:14px;
  box-shadow:0 0 0 1px rgba(242,169,59,.16),0 24px 64px -22px rgba(0,0,0,.85),
    0 0 38px -8px rgba(242,169,59,.22);
  padding:20px 22px 18px;color:#dfe7ea;transform:translateY(14px) scale(.98);
  opacity:0;transition:transform .42s cubic-bezier(.2,.9,.25,1),opacity .42s ease;}
.dw-hint.dw-in{transform:translateY(0) scale(1);opacity:1;}
.dw-hint::before{content:"";position:absolute;left:0;top:14px;bottom:14px;width:3px;
  border-radius:3px;background:linear-gradient(#f2a93b,#63d2ff);box-shadow:0 0 12px rgba(242,169,59,.5);}
.dw-hint-tag{display:flex;align-items:center;gap:8px;font-size:10.5px;letter-spacing:.22em;
  text-transform:uppercase;color:#f2a93b;margin-bottom:9px;}
.dw-hint-tag i{width:7px;height:7px;border-radius:50%;background:#63d2ff;
  box-shadow:0 0 9px #63d2ff;animation:dwHintPulse 1.8s ease-in-out infinite;}
@keyframes dwHintPulse{0%,100%{opacity:.55;}50%{opacity:1;}}
.dw-hint-tag .dw-hint-step{margin-left:auto;letter-spacing:.12em;color:#7d8a91;}
.dw-hint-title{font-size:17px;font-weight:700;letter-spacing:.01em;color:#f4f7ef;margin:0 0 7px;}
.dw-hint-body{font-size:13px;line-height:1.5;color:#aeb9bf;margin:0;}
.dw-hint-body b{color:#f2a93b;font-weight:600;}
.dw-hint-body em{color:#63d2ff;font-style:normal;font-weight:600;}
.dw-hint-foot{display:flex;align-items:center;gap:12px;margin-top:16px;}
.dw-hint-dots{display:flex;gap:6px;margin-right:auto;}
.dw-hint-dots span{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.18);
  transition:background .25s,transform .25s;}
.dw-hint-dots span.on{background:#f2a93b;transform:scale(1.25);box-shadow:0 0 8px rgba(242,169,59,.7);}
.dw-hint-skip{background:none;border:none;color:#7d8a91;font:inherit;font-size:11px;
  letter-spacing:.1em;text-transform:uppercase;cursor:pointer;padding:6px 4px;transition:color .2s;}
.dw-hint-skip:hover{color:#cdd6da;}
.dw-hint-next{background:linear-gradient(120deg,#f2a93b,#e0902a);border:none;color:#10171a;
  font:inherit;font-weight:700;font-size:12px;letter-spacing:.12em;text-transform:uppercase;
  cursor:pointer;padding:9px 18px;border-radius:8px;transition:filter .2s,transform .1s;
  box-shadow:0 6px 18px -8px rgba(242,169,59,.8);}
.dw-hint-next:hover{filter:brightness(1.08);}
.dw-hint-next:active{transform:translateY(1px);}
.dw-hint-mute{display:flex;align-items:center;gap:7px;margin-top:13px;
  font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:#69757b;cursor:pointer;
  user-select:none;}
.dw-hint-mute input{accent-color:#63d2ff;width:13px;height:13px;cursor:pointer;}
.dw-hint.dw-anchor{position:absolute;margin:0;}
@media (max-width:520px){.dw-hint{padding:17px 18px 15px;}.dw-hint-title{font-size:15.5px;}}
`;

// Sequence definitions. Each step: { tag, title, body }.
// Anchor (optional): { x:'right'|'left'|'center', y:'top'|'bottom'|'center' } to
// pin near a HUD region instead of dead-center.
const SEQUENCES = {
  menu: {
    dim: true,
    steps: [
      {
        tag: 'Welcome, Runner',
        title: 'This is Deadwire',
        body: 'A top-down extraction shooter set in a dying reactor yard. You <b>deploy</b>, fight through the Breaker Yard, grab loot, and <em>extract</em> to bank it. Die before you extract and you lose everything you were carrying.',
      },
      {
        tag: 'The Loop',
        title: 'Risk it to bank it',
        body: 'Every run is a gamble: push deeper for richer loot, or play safe and extract early. Banked loot upgrades your base, weapons, and crafting back home. Hit <b>ENTER GAME</b> to set up your loadout.',
      },
    ],
  },
  hud: {
    dim: false,
    anchor: { x: 'center', y: 'bottom' },
    steps: [
      {
        tag: 'Controls',
        title: 'Move, aim, fire',
        body: '<b>WASD</b> to move, <b>mouse</b> to aim, <b>click</b> to fire. <b>Q</b> rolls to dodge, <b>1–3</b> swap weapons. Watch your <em>ammo</em> and <em>health</em> bottom-left.',
      },
      {
        tag: 'The Objective',
        title: 'Loot, then extract',
        body: 'Crack open crates for loot, then reach a glowing <em>extraction zone</em> on the minimap to bank it. Your loot only counts once you extract — <b>death drops everything</b>.',
      },
      {
        tag: 'Hot Zone',
        title: 'The reactor core showdown',
        body: 'When the <em>reactor core</em> surfaces, carrying it makes you a target but pays out the rarest loot in the yard. That is a <b>HOT ZONE</b> — expect a fight, especially against other runners.',
      },
    ],
  },
  economy: {
    dim: true,
    steps: [
      {
        tag: 'The Ecosystem',
        title: 'Two currencies',
        body: '<b>Gold</b> is the in-game soft currency — earn it every run to buy gear and upgrades in the marketplace. <em>$DEAD</em> is the on-chain hard currency that lives in your wallet.',
      },
      {
        tag: 'Real Stakes',
        title: 'Gold tokens = real cash',
        body: 'Rare <b>gold tokens</b> drop from contested <em>HOT ZONE</em> showdowns and convert to real value on-chain. Extract them to keep them — that is the prize worth fighting (and partying up) for.',
      },
      {
        tag: 'Parties',
        title: 'Run with a crew',
        body: 'Form a <em>party</em> to split the risk and cover each other in hot zones. Bigger crews can lock down the core — but everyone has to make it to extraction alive.',
      },
    ],
  },
};

function loadFlags() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); }
  catch { return {}; }
}
function saveFlags(flags) {
  try { localStorage.setItem(KEY, JSON.stringify(flags)); } catch { /* noop */ }
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  document.head.appendChild(style);
}

// Only treat the player as "new" if they haven't onboarded a profile yet.
// Read-only against Stash; never mutates the profile.
function isNewPlayer() {
  try { return !Stash.load().profile.onboarded; }
  catch { return true; }
}

class HintRun {
  constructor(seqId, seq, root, flags, onClose) {
    this.seqId = seqId;
    this.steps = seq.steps;
    this.dim = !!seq.dim;
    this.anchor = seq.anchor || null;
    this.root = root;
    this.flags = flags;
    this.onClose = onClose;
    this.index = 0;
    this.muted = false;
    this._build();
  }

  _build() {
    this.layer = document.createElement('div');
    this.layer.className = 'dw-hint-layer' + (this.dim ? ' dw-dim' : '');
    this.card = document.createElement('div');
    this.card.className = 'dw-hint';
    if (this.anchor) this._applyAnchor();
    this.layer.appendChild(this.card);
    this.root.appendChild(this.layer);
    this._render();
    requestAnimationFrame(() => {
      this.layer.classList.add('dw-in');
      this.card.classList.add('dw-in');
    });
    this._onKey = (e) => {
      if (e.key === 'Escape') this._finish();
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._next(); }
    };
    addEventListener('keydown', this._onKey);
  }

  _applyAnchor() {
    this.card.classList.add('dw-anchor');
    const s = this.card.style;
    const { x = 'center', y = 'center' } = this.anchor;
    if (x === 'left') s.left = '24px';
    else if (x === 'right') s.right = '24px';
    else { s.left = '50%'; s.transform = 'translateX(-50%)'; }
    if (y === 'top') s.top = '90px';
    else if (y === 'bottom') s.bottom = '150px';
    else s.top = '50%';
  }

  _render() {
    const step = this.steps[this.index];
    const last = this.index === this.steps.length - 1;
    const dots = this.steps.map((_, i) =>
      `<span class="${i === this.index ? 'on' : ''}"></span>`).join('');
    this.card.innerHTML = `
      <div class="dw-hint-tag"><i></i>${esc(step.tag)}
        <span class="dw-hint-step">${this.index + 1}/${this.steps.length}</span></div>
      <h3 class="dw-hint-title">${esc(step.title)}</h3>
      <p class="dw-hint-body">${step.body}</p>
      <div class="dw-hint-foot">
        <div class="dw-hint-dots">${dots}</div>
        <button class="dw-hint-skip" type="button">Skip</button>
        <button class="dw-hint-next" type="button">${last ? 'Got it' : 'Next'}</button>
      </div>
      <label class="dw-hint-mute"><input type="checkbox" ${this.muted ? 'checked' : ''}/>Don't show tips again</label>`;
    this.card.querySelector('.dw-hint-next').onclick = () => this._next();
    this.card.querySelector('.dw-hint-skip').onclick = () => this._finish();
    this.card.querySelector('.dw-hint-mute input').onchange = (e) => { this.muted = e.target.checked; };
  }

  _next() {
    if (this.index < this.steps.length - 1) {
      this.index += 1;
      this.card.classList.remove('dw-in');
      setTimeout(() => {
        this._render();
        requestAnimationFrame(() => this.card.classList.add('dw-in'));
      }, 150);
    } else {
      this._finish();
    }
  }

  _finish() {
    if (this._closed) return;
    this._closed = true;
    removeEventListener('keydown', this._onKey);
    this.flags[this.seqId] = true;
    if (this.muted) this.flags.muted = true;
    saveFlags(this.flags);
    this.layer.classList.remove('dw-in');
    this.card.classList.remove('dw-in');
    setTimeout(() => { this.layer.remove(); this.onClose?.(); }, 420);
  }
}

function esc(value) {
  return String(value).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
}

export const Hints = {
  // Play a named sequence the first time only. Returns the HintRun or null if skipped.
  show(seqId, root, { force = false } = {}) {
    const seq = SEQUENCES[seqId];
    if (!seq || !root) return null;
    const flags = loadFlags();
    if (!force) {
      if (flags.muted || flags[seqId]) return null;     // already seen or muted
      if (!isNewPlayer()) return null;                  // veterans skip the tutorial
    }
    ensureStyle();
    return new HintRun(seqId, seq, root, flags, null);
  },

  // True if a sequence would currently display (useful for sequencing triggers).
  pending(seqId) {
    const flags = loadFlags();
    return !!SEQUENCES[seqId] && !flags.muted && !flags[seqId] && isNewPlayer();
  },

  // Clear all hint flags so tutorials replay (debug / settings hook).
  reset() {
    try { localStorage.removeItem(KEY); } catch { /* noop */ }
  },
};

if (typeof window !== 'undefined') window.__deadwireHints = Hints;
