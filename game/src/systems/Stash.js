// Stash — local persistence for the MVP (localStorage JSON).
// No wallet required in the first playable slice. This is the seam where, later,
// a server/wallet-backed inventory would replace localStorage transparently.
const KEY = 'deadwire.stash.v1';

export const STARTER_COSMETICS = [
  'helmet_breaker',
  'backpack_runner',
  'face_dust_mask',
  'hip_signal_flare',
];

const DEFAULT_PROFILE = {
  onboarded: false,
  callsign: 'Runner',
  tint: '#3b4a5a',
  title: 'YARD ROOKIE',
  equipped: {
    face: 'face_dust_mask',
    backpack: 'backpack_runner',
    hip: 'hip_signal_flare',
  },
  unlockedCosmetics: STARTER_COSMETICS,
};

const EMPTY = { items: {}, xp: 0, level: 1, runs: 0, extractions: 0, profile: DEFAULT_PROFILE };

function normalizeProfile(profile = {}) {
  return {
    ...DEFAULT_PROFILE,
    ...profile,
    equipped: { ...DEFAULT_PROFILE.equipped, ...(profile.equipped || {}) },
    unlockedCosmetics: [...new Set([...(profile.unlockedCosmetics || []), ...STARTER_COSMETICS])],
  };
}

function normalize(state = {}) {
  const items = { ...(state.items || {}) };
  if (items.Core) {
    items['Reactor Core'] = (items['Reactor Core'] || 0) + items.Core;
    delete items.Core;
  }
  return {
    ...EMPTY,
    ...state,
    items,
    profile: normalizeProfile(state.profile),
  };
}

export const Stash = {
  load() {
    try { return normalize(JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch { return normalize(); }
  },
  save(state) { localStorage.setItem(KEY, JSON.stringify(normalize(state))); },

  saveProfile(profile) {
    const s = this.load();
    s.profile = normalizeProfile({ ...s.profile, ...profile });
    this.save(s);
    return s.profile;
  },

  isCosmeticUnlocked(cosmetic, stash = this.load()) {
    if (!cosmetic) return false;
    if (stash.profile.unlockedCosmetics.includes(cosmetic.id)) return true;
    const unlock = cosmetic.unlock;
    if (!unlock) return false;
    const levelOk = !unlock.level || stash.level >= unlock.level;
    const itemOk = !unlock.item || (stash.items?.[unlock.item] || 0) >= (unlock.qty || 1);
    return levelOk && itemOk;
  },

  // apply a finished run's results -> returns the updated stash
  applyRun(results) {
    const s = this.load();
    s.runs += 1;
    if (results.extracted) {
      s.extractions += 1;
      for (const { item, qty } of results.loot) s.items[item] = (s.items[item] || 0) + qty;
    }
    s.xp += results.xp;
    while (s.xp >= s.level * 500) { s.xp -= s.level * 500; s.level += 1; }
    s.profile.unlockedCosmetics = [...new Set([
      ...s.profile.unlockedCosmetics,
      ...STARTER_COSMETICS,
    ])];
    this.save(s);
    return s;
  },

  reset() { localStorage.removeItem(KEY); },
};
