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
};

// Resolve the websocket base for the match server (handles ws/wss + local dev).
export function matchWsBase() {
  const u = RUNTIME.matchServerUrl?.trim();
  if (u) return u.replace(/^http/i, (m) => (m.toLowerCase() === 'http' ? 'ws' : m)).replace(/\/+$/, '');
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.hostname}:5181`;
}
