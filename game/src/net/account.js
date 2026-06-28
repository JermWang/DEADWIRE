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
let authClientPromise = null;

async function authClient() {
  if (!authClientPromise) {
    authClientPromise = import('https://esm.sh/@supabase/supabase-js@2.45.0').then(({ createClient }) =>
      createClient(RUNTIME.supabaseUrl, RUNTIME.supabaseAnonKey, {
        auth: { persistSession: true, detectSessionInUrl: true, flowType: 'pkce' },
      })
    );
  }
  return authClientPromise;
}

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
  discord: null,
  profile: null,
  online: false,

  isLoggedIn() { return !!this.token; },
  provider() { return this.discord ? 'discord' : this.wallet ? 'solana' : null; },

  async restore() {
    if (this.token) return this.profile;
    try {
      const saved = JSON.parse(localStorage.getItem(TOKEN_KEY) || 'null');
      if (saved?.token) {
        this.token = saved.token;
        this.wallet = saved.wallet || null;
        this.discord = saved.discord || null;
        this.profile = saved.profile || null;
        this.online = true;
      }
    } catch { /* local identity is optional */ }

    try {
      const sb = await authClient();
      const { data } = await sb.auth.getSession();
      const session = data?.session;
      if (session?.access_token && session.user?.app_metadata?.provider === 'discord') {
        const discordIdentity = session.user.identities?.find((identity) => identity.provider === 'discord');
        const discordMeta = discordIdentity?.identity_data || session.user.user_metadata || {};
        const result = await call('discordLogin', {
          accessToken: session.access_token,
          providerToken: session.provider_token || '',
        });
        this._applyIdentity(result, {
          discord: {
            id: discordMeta.provider_id || discordMeta.sub || session.user.id,
            username: discordMeta.full_name || discordMeta.name || discordMeta.user_name || 'Discord Runner',
            avatar: discordMeta.avatar_url || '',
          },
        });
      }
    } catch { /* keep a restored game token when OAuth is unavailable */ }
    return this.profile;
  },

  // Connect wallet + sign in. Hydrates the local Stash from the cloud snapshot.
  async signIn() {
    this.wallet = await Wallet.connect();
    const { nonce, message } = await call('nonce', { wallet: this.wallet });
    const signature = await Wallet.signMessage(message);
    const { token, stash } = await call('login', { wallet: this.wallet, nonce, signature });
    this._applyIdentity({ token, stash, profile: stash }, { wallet: this.wallet });
    if (stash) Stash.save(this._normalize(stash));   // cloud is source of truth on login
    return { wallet: this.wallet, stash };
  },

  async signInDiscord() {
    const sb = await authClient();
    const redirectTo = `${location.origin}${location.pathname}`;
    const { data, error } = await sb.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo,
        scopes: 'identify relationships.read',
        queryParams: { prompt: 'consent' },
      },
    });
    if (error) throw error;
    return data;
  },

  async signOut() {
    this.token = null; this.online = false; this.wallet = null;
    this.discord = null; this.profile = null;
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* noop */ }
    Wallet.disconnect();
    try { (await authClient()).auth.signOut(); } catch { /* noop */ }
  },

  async updateProfile(handle) {
    const result = await call('profileUpdate', { token: this.token, handle });
    this.profile = result.profile || this.profile;
    if (this.profile?.handle) Stash.saveProfile({ onboarded: true, callsign: this.profile.handle });
    this._persistIdentity();
    return this.profile;
  },

  async listFriends() {
    if (!this.token) return { friends: [], incoming: [], outgoing: [], discord: [] };
    return call('friendsList', { token: this.token });
  },

  async searchProfiles(query) {
    if (!this.token || !query?.trim()) return [];
    const { profiles = [] } = await call('profilesSearch', { token: this.token, query: query.trim() });
    return profiles;
  },

  async friendRequest(profileId) {
    return call('friendRequest', { token: this.token, profileId });
  },

  async friendRespond(friendshipId, accept) {
    return call('friendRespond', { token: this.token, friendshipId, accept: !!accept });
  },

  async friendRemove(friendshipId) {
    return call('friendRemove', { token: this.token, friendshipId });
  },

  async importDiscordFriend(discordId) {
    return call('discordFriendImport', { token: this.token, discordId });
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

  _applyIdentity(result, identity = {}) {
    this.token = result.token;
    this.wallet = identity.wallet || null;
    this.discord = identity.discord || result.discord || null;
    this.profile = result.profile || result.stash || null;
    this.online = true;
    if (result.stash) Stash.save(this._normalize(result.stash));
    const handle = this.profile?.handle;
    if (handle) Stash.saveProfile({ onboarded: true, callsign: handle });
    this._persistIdentity();
  },

  _persistIdentity() {
    try {
      localStorage.setItem(TOKEN_KEY, JSON.stringify({
        token: this.token,
        wallet: this.wallet,
        discord: this.discord,
        profile: this.profile,
      }));
    } catch { /* noop */ }
  },

  _normalize(s) {
    const current = Stash.load();
    return {
      items: s.items || {},
      xp: s.xp || 0,
      level: s.level || 1,
      runs: s.runs || 0,
      extractions: s.extractions || 0,
      profile: {
        ...current.profile,
        ...(s.profile || {}),
        onboarded: Boolean(s.handle || s.profile?.onboarded || current.profile.onboarded),
        callsign: s.handle || s.profile?.callsign || current.profile.callsign,
      },
      progression: s.progression || current.progression,
    };
  },
};
