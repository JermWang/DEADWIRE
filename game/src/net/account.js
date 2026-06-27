// account.js — online identity + cloud persistence, bridged to the local Stash.
// Flow (all non-custodial): connect wallet -> ask edge fn for a nonce -> wallet
// signs it -> edge fn verifies the ed25519 signature and returns a short-lived
// HMAC session token + the player's cloud stash. Writes go back through the edge
// function (service-role gated); the browser never holds elevated DB rights.
import { RUNTIME } from '../config/runtime.js';
import { Wallet } from './wallet.js';
import { Stash } from '../systems/Stash.js';

const FN = `${RUNTIME.supabaseUrl}/functions/v1/account`;
const TOKEN_KEY = 'deadwire.session.v1';

async function call(action, payload = {}) {
  const res = await fetch(FN, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // anon key satisfies the gateway; the real auth is the wallet signature / token.
      apikey: RUNTIME.supabaseAnonKey,
      Authorization: `Bearer ${RUNTIME.supabaseAnonKey}`,
    },
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `account ${action} failed (${res.status})`);
  return data;
}

export const Account = {
  token: null,
  wallet: null,
  online: false,

  isLoggedIn() { return !!this.token; },

  // Connect wallet + sign in. Hydrates the local Stash from the cloud snapshot.
  async signIn() {
    this.wallet = await Wallet.connect();
    const { nonce, message } = await call('nonce', { wallet: this.wallet });
    const signature = await Wallet.signMessage(message);
    const { token, stash } = await call('login', { wallet: this.wallet, nonce, signature });
    this.token = token;
    this.online = true;
    try { localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, wallet: this.wallet })); } catch { /* noop */ }
    if (stash) Stash.save(this._normalize(stash));   // cloud is source of truth on login
    return { wallet: this.wallet, stash };
  },

  signOut() {
    this.token = null; this.online = false; this.wallet = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
    Wallet.disconnect();
  },

  // Persist a finished run to the cloud authoritatively; returns the fresh snapshot.
  async applyRun(results) {
    if (!this.token) return null;
    const run = { extracted: !!results.extracted, loot: results.loot || [], xp: results.xp || 0 };
    const { stash } = await call('applyRun', { token: this.token, run });
    if (stash) Stash.save(this._normalize(stash));
    return stash;
  },

  // Push the full local stash snapshot (fallback / manual sync).
  async pushStash(stash) {
    if (!this.token) return;
    await call('save', { token: this.token, stash });
  },

  // Settle a confirmed on-chain $DEAD payment -> credit in-game Gold. The server
  // re-verifies the tx on mainnet (amount to treasury, idempotent per signature),
  // so a spoofed sig credits nothing. Returns { credited, deadAmount, stash }.
  async buyGold(txSig) {
    if (!this.token) throw new Error('connect wallet first');
    const res = await call('buyGold', { token: this.token, txSig });
    if (res.stash) Stash.save(this._normalize(res.stash));
    return res;
  },

  _normalize(s) {
    return {
      items: s.items || {},
      xp: s.xp || 0,
      level: s.level || 1,
      runs: s.runs || 0,
      extractions: s.extractions || 0,
      profile: s.profile,
    };
  },
};
