// Stash — local persistence for the MVP (localStorage JSON).
// No wallet required in the first playable slice. This is the seam where, later,
// a server/wallet-backed inventory would replace localStorage transparently.
const KEY = 'deadwire.stash.v1';

const EMPTY = { items: {}, xp: 0, level: 1, runs: 0, extractions: 0 };

export const Stash = {
  load() {
    try { return { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; }
    catch { return { ...EMPTY }; }
  },
  save(state) { localStorage.setItem(KEY, JSON.stringify(state)); },

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
    this.save(s);
    return s;
  },

  reset() { localStorage.removeItem(KEY); },
};
