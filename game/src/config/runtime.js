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
  // bought with $DEAD. Fill these in AFTER creating the mint (see TOKEN.md); keep
  // them in sync with the server's app_config row. Until set, the $DEAD store path
  // stays disabled (the game still runs; Gold just can't be purchased yet).
  deadMint: '',        // $DEAD SPL mint address
  treasury: '',        // treasury wallet pubkey that receives $DEAD payments
  goldPerDead: 1000,   // in-game Gold credited per 1 $DEAD
};

// Resolve the websocket base for the match server (handles ws/wss + local dev).
export function matchWsBase() {
  const u = RUNTIME.matchServerUrl?.trim();
  if (u) return u.replace(/^http/i, (m) => (m.toLowerCase() === 'http' ? 'ws' : m)).replace(/\/+$/, '');
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname}:5181`;
}
