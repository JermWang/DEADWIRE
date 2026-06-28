// Deadwire account service — NON-CUSTODIAL wallet auth + gated persistence.
// Players prove wallet ownership by signing a nonce (ed25519). We never hold keys.
// All writes run here under the service role (RLS-bypassing); the browser only ever
// holds the public anon key + a short-lived HMAC session token issued below.
//
// Deployed to Supabase project `dfwzakgibutalkqyuwbj` as function `account`
// (verify_jwt = false — this fn implements its own wallet-signature auth).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import nacl from "https://esm.sh/tweetnacl@1.0.3";
import bs58 from "https://esm.sh/bs58@5.0.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const enc = new TextEncoder();
const dec = new TextDecoder();
const TOKEN_TTL = 7 * 24 * 3600 * 1000;

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64urlStr(s: string) { return b64url(enc.encode(s)); }
function b64urlToBytes(s: string) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  const bin = atob(s); const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
function isPubkey(s: string) { try { return bs58.decode(s).length === 32; } catch { return false; } }
function msgFor(wallet: string, nonce: string) { return `Deadwire sign-in\nwallet: ${wallet}\nnonce: ${nonce}`; }

let _key: CryptoKey | null = null;
async function hmacKey() {
  if (_key) return _key;
  _key = await crypto.subtle.importKey("raw", enc.encode(SERVICE_KEY), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return _key;
}
async function issueToken(wallet: string, pid: string) {
  const payload = b64urlStr(JSON.stringify({ w: wallet, pid, exp: Date.now() + TOKEN_TTL }));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)));
  return payload + "." + b64url(sig);
}
async function verifyToken(token: string) {
  if (!token || token.indexOf(".") < 0) return null;
  try {
    const [payload, sig] = token.split(".");
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(), b64urlToBytes(sig), enc.encode(payload));
    if (!ok) return null;
    const data: any = JSON.parse(dec.decode(b64urlToBytes(payload)));
    if (!data?.exp || data.exp < Date.now()) return null;
    return data as { w: string; pid: string; exp: number };
  } catch { return null; }   // malformed token => unauthorized, never a 500
}

const CUR: Record<string, string> = { Scrap: "SCRAP", Ammo: "AMMO", Components: "COMPONENTS", Parts: "PARTS", Med: "MED", Gold: "GOLD", "Core Shard": "CORE_SHARD", Core: "CORE", "Reactor Core": "CORE" };

async function snapshot(p: any) {
  const { data: rows } = await admin.from("stash_items").select("item,qty").eq("profile_id", p.id);
  const items: Record<string, number> = {};
  for (const r of rows || []) items[r.item] = Number(r.qty);
  return {
    items, xp: p.xp, level: p.level, runs: p.runs, extractions: p.extractions,
    wallet: p.wallet, handle: p.handle,
    profile: { id: p.id, handle: p.handle, avatar: p.avatar_url || "", title: p.title || "YARD ROOKIE" },
  };
}
async function bumpItem(pid: string, item: string, delta: number) {
  const { data } = await admin.from("stash_items").select("qty").eq("profile_id", pid).eq("item", item).maybeSingle();
  const next = Math.max(0, (data ? Number(data.qty) : 0) + Math.floor(Number(delta) || 0));
  await admin.from("stash_items").upsert({ profile_id: pid, item, qty: next, updated_at: new Date().toISOString() });
}

async function handleNonce(body: any) {
  const wallet = String(body.wallet || "");
  if (!isPubkey(wallet)) return json({ error: "bad wallet" }, 400);
  const nonce = b64url(crypto.getRandomValues(new Uint8Array(18)));
  await admin.from("auth_nonces").insert({ nonce, wallet });
  return json({ nonce, message: msgFor(wallet, nonce) });
}
async function handleLogin(body: any) {
  const wallet = String(body.wallet || "");
  const nonce = String(body.nonce || "");
  const signature = String(body.signature || "");
  if (!isPubkey(wallet)) return json({ error: "bad wallet" }, 400);
  const { data: nrow } = await admin.from("auth_nonces").select("*").eq("nonce", nonce).eq("wallet", wallet).eq("used", false).maybeSingle();
  if (!nrow) return json({ error: "invalid or expired nonce" }, 401);
  let ok = false;
  try { ok = nacl.sign.detached.verify(enc.encode(msgFor(wallet, nonce)), bs58.decode(signature), bs58.decode(wallet)); } catch { ok = false; }
  if (!ok) return json({ error: "bad signature" }, 401);
  await admin.from("auth_nonces").update({ used: true }).eq("nonce", nonce);
  let { data: profile } = await admin.from("profiles").select("*").eq("wallet", wallet).maybeSingle();
  if (!profile) {
    const ins = await admin.from("profiles").insert({ wallet, handle: "Runner-" + wallet.slice(0, 4) }).select("*").single();
    profile = ins.data;
  }
  const token = await issueToken(wallet, profile.id);
  return json({ token, stash: await snapshot(profile) });
}

async function handleDiscordLogin(body: any) {
  const accessToken = String(body.accessToken || "");
  if (!accessToken) return json({ error: "missing Discord session" }, 401);
  const { data: authData, error } = await admin.auth.getUser(accessToken);
  if (error || !authData?.user) return json({ error: "invalid Discord session" }, 401);
  const user = authData.user;
  const provider = user.app_metadata?.provider;
  if (provider !== "discord") return json({ error: "Discord account required" }, 400);
  const identity = user.identities?.find((entry: any) => entry.provider === "discord");
  const metadata = identity?.identity_data || user.user_metadata || {};
  const discordId = String(metadata.provider_id || metadata.sub || user.id);
  const display = String(metadata.full_name || metadata.name || metadata.user_name || "Discord Runner");
  const avatar = String(metadata.avatar_url || "");
  let discordContacts: Array<{ id: string; username: string; avatar: string }> = [];
  const providerToken = String(body.providerToken || "");
  if (providerToken) {
    try {
      const response = await fetch("https://discord.com/api/v10/users/@me/relationships", {
        headers: { Authorization: `Bearer ${providerToken}` },
      });
      if (response.ok) {
        const relationships = await response.json();
        discordContacts = (Array.isArray(relationships) ? relationships : [])
          .filter((entry: any) => entry?.type === 1 && entry?.user?.id)
          .slice(0, 250)
          .map((entry: any) => ({
            id: String(entry.user.id),
            username: String(entry.user.global_name || entry.user.username || "Discord Friend"),
            avatar: entry.user.avatar
              ? `https://cdn.discordapp.com/avatars/${entry.user.id}/${entry.user.avatar}.png?size=128`
              : "",
          }));
      }
    } catch { /* Discord friend import is optional when the scope is unavailable */ }
  }
  let { data: profile } = await admin.from("profiles").select("*").eq("discord_id", discordId).maybeSingle();
  if (!profile) {
    const base = display.replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 16) || "Runner";
    let handle = base;
    for (let attempt = 0; attempt < 5; attempt++) {
      const { data: taken } = await admin.from("profiles").select("id").ilike("handle", handle).maybeSingle();
      if (!taken) break;
      handle = `${base.slice(0, 12)}-${Math.floor(1000 + Math.random() * 9000)}`;
    }
    const ins = await admin.from("profiles").insert({
      discord_id: discordId,
      handle,
      avatar_url: avatar,
      discord_contacts: discordContacts,
    }).select("*").single();
    if (ins.error) return json({ error: ins.error.message }, 400);
    profile = ins.data;
  } else {
    const updated = await admin.from("profiles").update({
      avatar_url: avatar || profile.avatar_url,
      discord_contacts: discordContacts,
      updated_at: new Date().toISOString(),
    }).eq("id", profile.id).select("*").single();
    profile = updated.data || profile;
  }
  const token = await issueToken(`discord:${discordId}`, profile.id);
  return json({
    token,
    stash: await snapshot(profile),
    profile: { id: profile.id, handle: profile.handle, avatar: profile.avatar_url || "" },
    discord: { id: discordId, username: display, avatar },
    discordFriends: discordContacts,
  });
}

function cleanHandle(value: unknown) {
  return String(value || "").trim().replace(/\s+/g, "-");
}

async function authed(body: any) {
  return verifyToken(String(body.token || ""));
}

async function handleProfileUpdate(body: any) {
  const t = await authed(body);
  if (!t) return json({ error: "unauthorized" }, 401);
  const handle = cleanHandle(body.handle);
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(handle)) return json({ error: "Username must be 3-20 letters, numbers, _ or -" }, 400);
  const { data: taken } = await admin.from("profiles").select("id").ilike("handle", handle).neq("id", t.pid).maybeSingle();
  if (taken) return json({ error: "Username is already in use" }, 409);
  const { data, error } = await admin.from("profiles").update({ handle, updated_at: new Date().toISOString() })
    .eq("id", t.pid).select("id,handle,avatar_url,title").single();
  if (error) return json({ error: error.message }, 400);
  return json({ profile: { id: data.id, handle: data.handle, avatar: data.avatar_url || "", title: data.title || "YARD ROOKIE" } });
}

async function handleProfilesSearch(body: any) {
  const t = await authed(body);
  if (!t) return json({ error: "unauthorized" }, 401);
  const query = cleanHandle(body.query).slice(0, 20);
  if (query.length < 2) return json({ profiles: [] });
  const { data } = await admin.from("profiles").select("id,handle,avatar_url,level")
    .ilike("handle", `%${query}%`).neq("id", t.pid).order("handle").limit(20);
  return json({ profiles: (data || []).map((p: any) => ({ id: p.id, handle: p.handle, avatar: p.avatar_url || "", level: p.level })) });
}

async function friendshipRows(pid: string) {
  const { data } = await admin.from("friendships").select("*").or(`requester_id.eq.${pid},addressee_id.eq.${pid}`).order("created_at", { ascending: false });
  return data || [];
}

async function handleFriendsList(body: any) {
  const t = await authed(body);
  if (!t) return json({ error: "unauthorized" }, 401);
  const rows = await friendshipRows(t.pid);
  const ids = [...new Set(rows.flatMap((r: any) => [r.requester_id, r.addressee_id]).filter((id: string) => id !== t.pid))];
  const { data: profiles } = ids.length
    ? await admin.from("profiles").select("id,handle,avatar_url,level").in("id", ids)
    : { data: [] as any[] };
  const byId = new Map((profiles || []).map((p: any) => [p.id, p]));
  const format = (r: any) => {
    const otherId = r.requester_id === t.pid ? r.addressee_id : r.requester_id;
    const p: any = byId.get(otherId) || {};
    return { friendshipId: r.id, id: otherId, handle: p.handle || "Unknown Runner", avatar: p.avatar_url || "", level: p.level || 1 };
  };
  const { data: me } = await admin.from("profiles").select("discord_contacts").eq("id", t.pid).single();
  const contacts = Array.isArray(me?.discord_contacts) ? me.discord_contacts : [];
  const discordIds = contacts.map((contact: any) => String(contact.id));
  const { data: linked } = discordIds.length
    ? await admin.from("profiles").select("id,handle,avatar_url,discord_id,level").in("discord_id", discordIds)
    : { data: [] as any[] };
  const linkedByDiscord = new Map((linked || []).map((p: any) => [String(p.discord_id), p]));
  return json({
    friends: rows.filter((r: any) => r.status === "accepted").map(format),
    incoming: rows.filter((r: any) => r.status === "pending" && r.addressee_id === t.pid).map(format),
    outgoing: rows.filter((r: any) => r.status === "pending" && r.requester_id === t.pid).map(format),
    discord: contacts.map((contact: any) => {
      const p: any = linkedByDiscord.get(String(contact.id));
      return { ...contact, profileId: p?.id || null, handle: p?.handle || null, level: p?.level || null };
    }),
  });
}

async function handleFriendRequest(body: any) {
  const t = await authed(body);
  if (!t) return json({ error: "unauthorized" }, 401);
  const profileId = String(body.profileId || "");
  if (!profileId || profileId === t.pid) return json({ error: "invalid runner" }, 400);
  const existing = (await friendshipRows(t.pid)).find((r: any) =>
    (r.requester_id === profileId && r.addressee_id === t.pid) ||
    (r.requester_id === t.pid && r.addressee_id === profileId));
  if (existing?.status === "accepted") return json({ ok: true, friendshipId: existing.id });
  if (existing) return json({ ok: true, friendshipId: existing.id, pending: true });
  const { data, error } = await admin.from("friendships").insert({ requester_id: t.pid, addressee_id: profileId }).select("id").single();
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, friendshipId: data.id, pending: true });
}

async function handleFriendRespond(body: any) {
  const t = await authed(body);
  if (!t) return json({ error: "unauthorized" }, 401);
  const id = String(body.friendshipId || "");
  if (body.accept) {
    await admin.from("friendships").update({ status: "accepted", updated_at: new Date().toISOString() }).eq("id", id).eq("addressee_id", t.pid);
  } else {
    await admin.from("friendships").delete().eq("id", id).eq("addressee_id", t.pid);
  }
  return json({ ok: true });
}

async function handleFriendRemove(body: any) {
  const t = await authed(body);
  if (!t) return json({ error: "unauthorized" }, 401);
  const id = String(body.friendshipId || "");
  await admin.from("friendships").delete().eq("id", id).or(`requester_id.eq.${t.pid},addressee_id.eq.${t.pid}`);
  return json({ ok: true });
}

async function handleDiscordFriendImport(body: any) {
  const t = await authed(body);
  if (!t) return json({ error: "unauthorized" }, 401);
  const discordId = String(body.discordId || "");
  const { data: me } = await admin.from("profiles").select("discord_contacts").eq("id", t.pid).single();
  const allowed = (me?.discord_contacts || []).some((contact: any) => String(contact.id) === discordId);
  if (!allowed) return json({ error: "Discord friend was not found" }, 403);
  const { data: target } = await admin.from("profiles").select("id").eq("discord_id", discordId).maybeSingle();
  if (!target) return json({ error: "This Discord friend has not created a Deadwire profile yet" }, 404);
  return handleFriendRequest({ ...body, token: body.token, profileId: target.id });
}
async function handleSave(body: any) {
  const t = await verifyToken(String(body.token || ""));
  if (!t) return json({ error: "unauthorized" }, 401);
  const s = body.stash || {};
  await admin.from("profiles").update({ level: s.level ?? 1, xp: s.xp ?? 0, runs: s.runs ?? 0, extractions: s.extractions ?? 0, updated_at: new Date().toISOString() }).eq("id", t.pid);
  const items = s.items || {};
  const ups = Object.entries(items).map(([item, qty]) => ({ profile_id: t.pid, item, qty: Math.max(0, Math.floor(Number(qty) || 0)), updated_at: new Date().toISOString() }));
  if (ups.length) await admin.from("stash_items").upsert(ups);
  return json({ ok: true });
}
async function handleApplyRun(body: any) {
  const t = await verifyToken(String(body.token || ""));
  if (!t) return json({ error: "unauthorized" }, 401);
  const run = body.run || {};
  const { data: profile } = await admin.from("profiles").select("*").eq("id", t.pid).single();
  if (!profile) return json({ error: "no profile" }, 404);
  await admin.from("runs").insert({ profile_id: t.pid, extracted: !!run.extracted, loot: run.loot || [], xp: run.xp || 0 });
  let { level, xp, runs, extractions } = profile;
  runs += 1;
  if (run.extracted) {
    extractions += 1;
    for (const { item, qty } of (run.loot || [])) {
      await bumpItem(t.pid, item, qty);
      if (CUR[item]) await admin.from("economy_ledger").insert({ profile_id: t.pid, currency: CUR[item], delta: qty, reason: "extract" });
    }
  }
  xp += run.xp || 0;
  while (xp >= level * 500) { xp -= level * 500; level += 1; }
  await admin.from("profiles").update({ level, xp, runs, extractions, updated_at: new Date().toISOString() }).eq("id", t.pid);
  const { data: fresh } = await admin.from("profiles").select("*").eq("id", t.pid).single();
  return json({ stash: await snapshot(fresh) });
}

async function getConfig() {
  const { data } = await admin.from("app_config").select("key,value");
  const c: Record<string, string> = {};
  for (const r of data || []) c[r.key] = r.value ?? "";
  return c;
}
// $DEAD credited to the treasury in this tx = treasury's post balance - pre balance.
function deadToTreasury(tx: any, mint: string, treasury: string) {
  const pre = tx?.meta?.preTokenBalances || [];
  const post = tx?.meta?.postTokenBalances || [];
  const f = (arr: any[]) => arr.find((b: any) => b.mint === mint && b.owner === treasury);
  const before = Number(f(pre)?.uiTokenAmount?.uiAmount || 0);
  const after = Number(f(post)?.uiTokenAmount?.uiAmount || 0);
  return Math.max(0, after - before);
}
async function handleBuyGold(body: any) {
  const t = await verifyToken(String(body.token || ""));
  if (!t) return json({ error: "unauthorized" }, 401);
  const txSig = String(body.txSig || "");
  if (!txSig) return json({ error: "missing txSig" }, 400);
  const cfg = await getConfig();
  if (!cfg.dead_mint || !cfg.treasury) return json({ error: "store not configured" }, 503);
  // idempotency: never credit the same on-chain tx twice
  const { data: dup } = await admin.from("settlements").select("id").eq("tx_sig", txSig).maybeSingle();
  if (dup) return json({ error: "already settled" }, 409);
  const rpc = cfg.solana_rpc || "https://api.mainnet-beta.solana.com";
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [txSig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }] }),
  });
  const j = await r.json().catch(() => ({}));
  const tx = j?.result;
  if (!tx || tx.meta?.err) return json({ error: "tx not found or failed" }, 400);
  const dead = deadToTreasury(tx, cfg.dead_mint, cfg.treasury);
  if (dead <= 0) return json({ error: "no $DEAD transfer to treasury in tx" }, 400);
  const gold = Math.floor(dead * Number(cfg.gold_per_dead || "0"));
  await admin.from("settlements").insert({ tx_sig: txSig, profile_id: t.pid, wallet: t.w, kind: "buy_gold", dead_amount: dead, gold_amount: gold });
  await bumpItem(t.pid, "Gold", gold);
  await admin.from("economy_ledger").insert({ profile_id: t.pid, currency: "GOLD", delta: gold, reason: "buy_gold:$DEAD", tx_sig: txSig });
  const { data: fresh } = await admin.from("profiles").select("*").eq("id", t.pid).single();
  return json({ credited: gold, deadAmount: dead, stash: await snapshot(fresh) });
}

// Shared on-chain verifier for money-significant actions. Fetches the tx on the
// configured Solana RPC, confirms it succeeded, and returns the $DEAD amount that
// actually landed in the treasury. Returns { error, status } on any problem.
async function verifyDeadDeposit(cfg: Record<string, string>, txSig: string) {
  const rpc = cfg.solana_rpc || "https://api.mainnet-beta.solana.com";
  const r = await fetch(rpc, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTransaction", params: [txSig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0, commitment: "confirmed" }] }),
  });
  const j = await r.json().catch(() => ({}));
  const tx = j?.result;
  if (!tx || tx.meta?.err) return { error: "tx not found or failed", status: 400 };
  const dead = deadToTreasury(tx, cfg.dead_mint, cfg.treasury);
  if (dead <= 0) return { error: "no $DEAD transfer to treasury in tx", status: 400 };
  return { dead };
}

// deposit — player sent $DEAD to the treasury; record the on-chain deposit.
// Double-verified: settlements row (tx_sig unique) + economy_ledger row. We do
// NOT mint Gold here (Gold is bought via buyGold); this just books the $DEAD in.
async function handleDeposit(body: any) {
  const t = await verifyToken(String(body.token || ""));
  if (!t) return json({ error: "unauthorized" }, 401);
  const txSig = String(body.txSig || "");
  if (!txSig) return json({ error: "missing txSig" }, 400);
  const cfg = await getConfig();
  if (!cfg.dead_mint || !cfg.treasury) return json({ error: "store not configured" }, 503);
  const { data: dup } = await admin.from("settlements").select("id").eq("tx_sig", txSig).maybeSingle();
  if (dup) return json({ error: "already settled" }, 409);
  const v = await verifyDeadDeposit(cfg, txSig);
  if (v.error) return json({ error: v.error }, v.status);
  const dead = v.dead!;
  await admin.from("settlements").insert({ tx_sig: txSig, profile_id: t.pid, wallet: t.w, kind: "deposit", dead_amount: dead });
  await admin.from("economy_ledger").insert({ profile_id: t.pid, currency: "DEAD", delta: Math.floor(dead), reason: "deposit:$DEAD", tx_sig: txSig });
  return json({ ok: true, deadAmount: dead });
}

// withdraw — REQUEST ONLY. We never auto-sign payouts (no hot wallet client- or
// server-side here). Record an intent row flagged for manual review.
async function handleWithdraw(body: any) {
  const t = await verifyToken(String(body.token || ""));
  if (!t) return json({ error: "unauthorized" }, 401);
  const cfg = await getConfig();
  if (!cfg.dead_mint || !cfg.treasury) return json({ error: "store not configured" }, 503);
  const dead = Math.max(0, Number(body.deadAmount || 0));
  if (!(dead > 0)) return json({ error: "bad amount" }, 400);
  const dest = String(body.wallet || t.w || "");
  if (!isPubkey(dest)) return json({ error: "bad destination wallet" }, 400);
  const { data, error } = await admin.from("withdrawals").insert({
    profile_id: t.pid, wallet: dest, dead_amount: dead, status: "requested",
    note: "auto-payout disabled; manual review required",
  }).select("id").single();
  if (error) return json({ error: error.message }, 400);
  // Book the intent in the ledger too (negative request); no funds move yet.
  await admin.from("economy_ledger").insert({ profile_id: t.pid, currency: "DEAD", delta: -Math.floor(dead), reason: "withdraw_request:$DEAD" });
  return json({ ok: true, requestId: data.id, status: "requested", deadAmount: dead, manualReview: true });
}

// tradeSale — a marketplace sale settled in $DEAD between two players. Verify the
// on-chain transfer to the treasury, double-record it, then transfer item
// ownership in the DB (off-chain stash) from seller to buyer.
async function handleTradeSale(body: any) {
  const t = await verifyToken(String(body.token || ""));
  if (!t) return json({ error: "unauthorized" }, 401);   // t = buyer (the payer)
  const txSig = String(body.txSig || "");
  const listingId = String(body.listingId || "");
  if (!txSig) return json({ error: "missing txSig" }, 400);
  if (!listingId) return json({ error: "missing listingId" }, 400);
  const cfg = await getConfig();
  if (!cfg.dead_mint || !cfg.treasury) return json({ error: "store not configured" }, 503);
  const { data: dup } = await admin.from("settlements").select("id").eq("tx_sig", txSig).maybeSingle();
  if (dup) return json({ error: "already settled" }, 409);
  const { data: listing } = await admin.from("marketplace_listings").select("*").eq("id", listingId).maybeSingle();
  if (!listing) return json({ error: "listing not found" }, 404);
  if (listing.status !== "active") return json({ error: "listing not active" }, 409);
  if (listing.seller_id === t.pid) return json({ error: "cannot buy your own listing" }, 400);
  const v = await verifyDeadDeposit(cfg, txSig);
  if (v.error) return json({ error: v.error }, v.status);
  const dead = v.dead!;
  if (dead + 1e-9 < Number(listing.price_dead)) return json({ error: "underpaid for listing" }, 400);
  // Double-verify on-chain action: settlements (idempotent) + economy_ledger.
  await admin.from("settlements").insert({ tx_sig: txSig, profile_id: t.pid, wallet: t.w, kind: "trade_sale", dead_amount: dead, sku: listingId });
  await admin.from("economy_ledger").insert({ profile_id: t.pid, currency: "DEAD", delta: Math.floor(dead), reason: "trade_sale:$DEAD", tx_sig: txSig });
  // Transfer item ownership off-chain: debit seller, credit buyer.
  const qty = Math.max(1, Math.floor(Number(listing.qty) || 1));
  await bumpItem(listing.seller_id, listing.item, -qty);
  await bumpItem(t.pid, listing.item, qty);
  await admin.from("marketplace_listings").update({ status: "sold", buyer_id: t.pid, tx_sig: txSig, updated_at: new Date().toISOString() }).eq("id", listingId);
  const { data: fresh } = await admin.from("profiles").select("*").eq("id", t.pid).single();
  return json({ ok: true, deadAmount: dead, item: listing.item, qty, stash: await snapshot(fresh) });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: any; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  try {
    switch (body.action) {
      case "nonce": return await handleNonce(body);
      case "login": return await handleLogin(body);
      case "discordLogin": return await handleDiscordLogin(body);
      case "profileUpdate": return await handleProfileUpdate(body);
      case "profilesSearch": return await handleProfilesSearch(body);
      case "friendsList": return await handleFriendsList(body);
      case "friendRequest": return await handleFriendRequest(body);
      case "friendRespond": return await handleFriendRespond(body);
      case "friendRemove": return await handleFriendRemove(body);
      case "discordFriendImport": return await handleDiscordFriendImport(body);
      case "save": return await handleSave(body);
      case "applyRun": return await handleApplyRun(body);
      case "buyGold": return await handleBuyGold(body);
      case "deposit": return await handleDeposit(body);
      case "withdraw": return await handleWithdraw(body);
      case "tradeSale": return await handleTradeSale(body);
      default: return json({ error: "unknown action" }, 400);
    }
  } catch (e) { return json({ error: String((e as Error)?.message || e) }, 500); }
});
