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
  const [payload, sig] = token.split(".");
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), b64urlToBytes(sig), enc.encode(payload));
  if (!ok) return null;
  let data: any; try { data = JSON.parse(dec.decode(b64urlToBytes(payload))); } catch { return null; }
  if (!data?.exp || data.exp < Date.now()) return null;
  return data as { w: string; pid: string; exp: number };
}

const CUR: Record<string, string> = { Scrap: "SCRAP", Ammo: "AMMO", Components: "COMPONENTS", Parts: "PARTS", Med: "MED", Gold: "GOLD", "Core Shard": "CORE_SHARD", Core: "CORE" };

async function snapshot(p: any) {
  const { data: rows } = await admin.from("stash_items").select("item,qty").eq("profile_id", p.id);
  const items: Record<string, number> = {};
  for (const r of rows || []) items[r.item] = Number(r.qty);
  return { items, xp: p.xp, level: p.level, runs: p.runs, extractions: p.extractions, wallet: p.wallet, handle: p.handle };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body: any; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  try {
    switch (body.action) {
      case "nonce": return await handleNonce(body);
      case "login": return await handleLogin(body);
      case "save": return await handleSave(body);
      case "applyRun": return await handleApplyRun(body);
      default: return json({ error: "unknown action" }, 400);
    }
  } catch (e) { return json({ error: String((e as Error)?.message || e) }, 500); }
});
