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
  primaryWeapon: 'weapon_scrap_pistol',
  equipped: {
    face: 'face_dust_mask',
    backpack: 'backpack_runner',
    hip: 'hip_signal_flare',
  },
  unlockedCosmetics: STARTER_COSMETICS,
};

const DEFAULT_PROGRESSION = {
  baseLevel: 1,
  weaponLevel: 1,
  craftingLevel: 1,
};

const UPGRADE_LIMIT = 10;
const UPGRADE_DEFS = {
  base: {
    key: 'baseLevel',
    label: 'Base',
    cost(level) {
      return {
        Scrap: 35 + level * 18,
        Components: 3 + Math.floor(level * 1.25),
      };
    },
  },
  weapons: {
    key: 'weaponLevel',
    label: 'Weapons',
    cost(level) {
      return {
        Parts: 4 + level * 2,
        Scrap: 22 + level * 12,
      };
    },
  },
  crafting: {
    key: 'craftingLevel',
    label: 'Crafting',
    cost(level) {
      return {
        Components: 4 + level * 2,
        'Core Shard': Math.max(1, Math.floor(level / 2)),
      };
    },
  },
};

const EMPTY = {
  items: {},
  xp: 0,
  level: 1,
  runs: 0,
  extractions: 0,
  profile: DEFAULT_PROFILE,
  progression: DEFAULT_PROGRESSION,
};

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
    progression: { ...DEFAULT_PROGRESSION, ...(state.progression || {}) },
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

  upgradeDefs() { return UPGRADE_DEFS; },

  upgradeCost(type, stash = this.load()) {
    const def = UPGRADE_DEFS[type];
    if (!def) return null;
    const level = Math.max(1, Number(stash.progression?.[def.key] || 1));
    if (level >= UPGRADE_LIMIT) return null;
    return def.cost(level);
  },

  canUpgrade(type, stash = this.load()) {
    const cost = this.upgradeCost(type, stash);
    if (!cost) return false;
    return Object.entries(cost).every(([item, qty]) => (stash.items?.[item] || 0) >= qty);
  },

  upgrade(type) {
    const def = UPGRADE_DEFS[type];
    if (!def) return { ok: false, reason: 'unknown' };
    const s = this.load();
    const current = Math.max(1, Number(s.progression?.[def.key] || 1));
    if (current >= UPGRADE_LIMIT) return { ok: false, reason: 'maxed', stash: s };
    const cost = def.cost(current);
    const affordable = Object.entries(cost).every(([item, qty]) => (s.items?.[item] || 0) >= qty);
    if (!affordable) return { ok: false, reason: 'resources', cost, stash: s };
    for (const [item, qty] of Object.entries(cost)) s.items[item] = Math.max(0, (s.items[item] || 0) - qty);
    s.progression[def.key] = current + 1;
    this.save(s);
    return { ok: true, cost, stash: this.load(), level: current + 1 };
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
