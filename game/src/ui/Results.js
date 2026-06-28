// Results — end-of-run screen. Shows extracted loot, kills, core status, XP, stash.
import { formatDeadTokens, getCoreTier } from '../data/economy.js';

const GOLD_TOKEN_IMAGE_URL = '/dead%20gold%20token.png';

function itemLabel(item) {
  if (item !== 'Gold') return item;
  return `<span class="gold-token-label"><img src="${GOLD_TOKEN_IMAGE_URL}" alt="" />Gold</span>`;
}

export function showResults(root, results, stash, { onReplay, onMenu }) {
  const lootRows = results.extracted && results.loot.length
    ? results.loot.map((l) => `<div class="r-row"><span>${itemLabel(l.item)}</span><b>+${l.qty}</b></div>`).join('')
    : '<div class="r-empty">Nothing extracted</div>';

  const stashRows = Object.entries(stash.items)
    .map(([k, v]) => `<div class="r-row"><span>${itemLabel(k)}</span><b>${v}</b></div>`).join('')
    || '<div class="r-empty">Stash empty</div>';

  const verdict = results.extracted
    ? (results.coreExtracted ? 'REACTOR CORE SECURED' : 'EXTRACTED')
    : 'WIPED';
  const verdictClass = results.extracted ? (results.coreExtracted ? 'win core' : 'win') : 'loss';
  const coreTier = results.coreTier ? getCoreTier(results.coreTier) : null;
  const coreStatus = results.coreExtracted && coreTier
    ? `${coreTier.grade} · ${formatDeadTokens(results.coreValueTokens)} $DEAD est.`
    : (results.coreLost ? 'Lost' : '—');

  const screen = document.createElement('div');
  screen.className = 'results';
  screen.innerHTML = `
    <div class="results-card">
      <div class="r-verdict ${verdictClass}">${verdict}</div>
      <div class="r-sub">${results.summary || 'Breaker Yard · Core Run'}</div>
      <div class="r-grid">
        <div class="r-stat"><div class="k">Machines destroyed</div><div class="v">${results.machines}</div></div>
        <div class="r-stat"><div class="k">Runners defeated</div><div class="v">${results.players}</div></div>
        <div class="r-stat"><div class="k">Reactor core</div><div class="v">${coreStatus}</div></div>
        <div class="r-stat"><div class="k">Reputation XP</div><div class="v">+${results.xp}</div></div>
      </div>
      <div class="r-cols">
        <div class="r-col"><h3>Extracted loot</h3>${lootRows}</div>
        <div class="r-col"><h3>Stash · Lv ${stash.level}</h3>${stashRows}</div>
      </div>
      <div class="r-actions">
        <button class="r-btn ghost" id="menuBtn">Main Menu</button>
        <button class="r-btn" id="replayBtn">Run it back</button>
      </div>
    </div>`;
  root.appendChild(screen);
  screen.querySelector('#replayBtn').onclick = () => { screen.remove(); onReplay(); };
  screen.querySelector('#menuBtn').onclick = () => { screen.remove(); onMenu?.(); };
}
