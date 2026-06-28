// Deadwire runtime config — the ONE place online endpoints live.
// All values here are public-safe: the Supabase publishable key is RLS-gated and
// no private keys ever live client-side (wallet is non-custodial; service role
// stays inside the Supabase edge function). Safe to commit.
export const RUNTIME = {
  // Supabase project (Deadwire).
  supabaseUrl: 'https://dfwzakgibutalkqyuwbj.supabase.co',
  supabaseAnonKey: 'sb_publishable_FY_NH0_PVDrplkNzMj_7ZA_oxoSRzhw',

  // Deployed match server (Railway). Empty => derive ws://<host>:5181 for local dev.
  // matchWsBase() converts https:// -> wss:// automatically.
  matchServerUrl: 'https://deadwire-match-production.up.railway.app',

  // Solana — MAINNET. Non-custodial: players sign with their own wallet.
  solanaCluster: 'mainnet-beta',
  solanaRpc: 'https://api.mainnet-beta.solana.com',

  // $DEAD — on-chain hard currency (SPL, mainnet). Gold is in-game only and is
  // bought with $DEAD. The CA is PRE-WIRED for display (start-screen CA chip) ahead
  // of launch; the buy/deposit/trade rails stay DISABLED until `treasury` is set
  // (Pay.configured() needs both; the server stays 503 while app_config.treasury is
  // empty). Flip on at launch by setting treasury here + in Supabase app_config.
  deadMint: 'nVE4EY5Q5ByPjsNAFuCr2iMC7Gpu2pgrTStx4MNpump', // $DEAD mint (pump.fun, pre-launch)
  treasury: '',        // treasury wallet pubkey — set at launch to enable purchases
  goldPerDead: 1000,   // in-game Gold credited per 1 $DEAD

  // Public social destination shown on the cinematic entry screen.
  xUrl: 'https://x.com/deadwireSOL',
};

function runtimeOverride(key) {
  try {
    if (typeof location !== 'undefined') {
      const fromQuery = new URLSearchParams(location.search).get(key);
      if (fromQuery) return fromQuery;
    }
    if (typeof localStorage !== 'undefined') return localStorage.getItem(`deadwire.${key}`);
  } catch { /* public runtime config best-effort only */ }
  return '';
}

// Resolve the websocket base for the match server (handles ws/wss + local dev).
export function matchWsBase() {
  const u = (runtimeOverride('matchServerUrl') || runtimeOverride('match') || RUNTIME.matchServerUrl)?.trim();
  if (u) return u.replace(/^http/i, (m) => (m.toLowerCase() === 'http' ? 'ws' : m)).replace(/\/+$/, '');
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname}:5181`;
}
