// Deadwire match server — shared PvPvE match instances.
// A "party" (lobby squad) deploys together into a shared INSTANCE that also holds
// other squads, up to a cap — so teams actually meet and fight over the core.
// Owns per-instance: roster, match clock + core-spawn timing, core-carrier + crate
// authority. Relays: position/health state, fire visuals, PvP hits (clamped +
// range-checked; friendly fire between squadmates is dropped server-side).
//   node server/match-server.mjs   ->  ws://127.0.0.1:5181
import http from 'node:http';
import { attachWS } from './ws.mjs';
import { CONFIG } from '../game/src/data/config.js';
import { chooseCoreTier } from '../game/src/data/economy.js';

const PORT = Number(process.env.PORT || process.env.MATCH_PORT || 5181);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_LOBBY = 4;               // max squad size
const INSTANCE_CAP = 12;           // players per shared match instance
const JOIN_WINDOW_MS = 120 * 1000; // an instance stops taking new squads after this
// Server-authoritative PvP: the server sets hit damage from CONFIG and gates each hit
// on a recent shot + the firing weapon's range, so a modified client can't forge damage,
// pick arbitrary targets, or land impossible cross-map hits.
const MAX_HIT_DMG = 100;          // hard cap, belt-and-suspenders
const FIRE_WINDOW_MS = 1500;      // a hit must follow a real shot from that runner within this
const WEAPONS = (CONFIG.loadout || []).map((id) => {
  const w = (CONFIG.weapons && CONFIG.weapons[id]) || {};
  return { dmg: Number(w.damage) || 12, range: (Number(w.projectileSpeed) || 22) * (Number(w.projectileLife) || 1) };
});

const lobbies = new Map();       // partyCode -> Map<id, LobbyClient>
const instances = new Map();     // instanceId -> instance
const partyInstance = new Map(); // partyCode -> instanceId (keeps a squad together)
let nextId = 1;
let nextInstance = 1;

function now() { return Date.now(); }
function insertionMs() { return Math.max(0, Number(CONFIG.match?.insertionCountdownSec || 0) * 1000); }
function modeFor(size) {
  const n = Math.max(1, Math.min(MAX_LOBBY, Number(size) || 1));
  return CONFIG.modes?.[n] || { label: 'SOLO' };
}
function cleanCode(value = '') {
  return String(value).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) || 'DW-PUBLIC';
}

// ---------- instances ----------
function newInstance() {
  const inst = {
    id: 'm' + (nextInstance++),
    createdMs: now(),
    startMs: now() + insertionMs(),  // match clock starts after the insertion window
    coreSpawned: false,
    core: { carrierId: null, x: CONFIG.map?.coreSpawn?.[0] ?? 0, z: 0, tier: chooseCoreTier().id },
    cratesOpened: new Set(),
    clients: new Map(), // id -> Client
    players: new Map(), // id -> player state
    parties: new Set(), // party codes routed here
  };
  instances.set(inst.id, inst);
  return inst;
}
function instElapsed(inst) { return inst.startMs ? Math.max(0, (now() - inst.startMs) / 1000) : 0; }
function instInsertionRemaining(inst) { return inst.startMs ? Math.max(0, (inst.startMs - now()) / 1000) : 0; }
function instOpen(inst) {
  return inst.players.size < INSTANCE_CAP && (now() - inst.createdMs) < JOIN_WINDOW_MS && !inst.coreSpawned;
}
// Route a squad to an instance: reuse the squad's instance if a teammate already
// joined; else fill the fullest OPEN instance that fits the whole squad; else new.
function assignInstance(partyCode, size) {
  const existing = partyInstance.get(partyCode);
  if (existing && instances.has(existing)) return instances.get(existing);
  let best = null;
  for (const inst of instances.values()) {
    if (!instOpen(inst) || inst.players.size + size > INSTANCE_CAP) continue;
    if (!best || inst.players.size > best.players.size) best = inst;
  }
  const inst = best || newInstance();
  inst.parties.add(partyCode);
  partyInstance.set(partyCode, inst.id);
  return inst;
}
function dropInstance(inst) {
  for (const code of inst.parties) if (partyInstance.get(code) === inst.id) partyInstance.delete(code);
  instances.delete(inst.id);
}
function broadcast(inst, obj, exceptId) {
  const s = JSON.stringify(obj);
  for (const [id, c] of inst.clients) if (id !== exceptId) c.conn.send(s);
}
function totalOnline() { let n = 0; for (const inst of instances.values()) n += inst.clients.size; return n; }

// ---------- lobby (party assembly) ----------
function broadcastLobby(code) {
  const lobby = lobbies.get(code);
  if (!lobby) return;
  const members = [...lobby.values()].map((client, index) => ({
    id: client.id, name: client.name, ready: client.ready, leader: index === 0,
  }));
  const message = JSON.stringify({ t: 'lobby_roster', partyCode: code, members });
  for (const client of lobby.values()) client.conn.send(message);
}

class LobbyClient {
  constructor(conn, request) {
    this.conn = conn;
    this.id = 'l' + (nextId++);
    const url = new URL(request.url || '/lobby', `http://${request.headers.host || '127.0.0.1'}`);
    this.partyCode = cleanCode(url.searchParams.get('party'));
    this.name = String(url.searchParams.get('name') || 'Runner').slice(0, 14);
    this.ready = false;
    const lobby = lobbies.get(this.partyCode) || new Map();
    if (lobby.size >= MAX_LOBBY) {
      conn.send(JSON.stringify({ t: 'lobby_error', message: 'PARTY FULL' }));
      conn.close();
      return;
    }
    lobby.set(this.id, this);
    lobbies.set(this.partyCode, lobby);
    conn.on('message', (raw) => this._onMessage(raw));
    conn.on('close', () => this._onClose());
    broadcastLobby(this.partyCode);
    console.log(`[lobby] ${this.name} joined ${this.partyCode} (${lobby.size}/${MAX_LOBBY})`);
  }

  _onMessage(raw) {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    if (msg.t === 'lobby_update') {
      if (msg.name) this.name = String(msg.name).slice(0, 14);
      if (typeof msg.ready === 'boolean') this.ready = msg.ready;
      broadcastLobby(this.partyCode);
      return;
    }
    if (msg.t === 'lobby_launch') {
      const lobby = lobbies.get(this.partyCode);
      const leader = lobby?.values().next().value;
      if (!lobby || leader !== this || ![...lobby.values()].every((member) => member.ready)) return;
      const size = Math.max(1, Math.min(MAX_LOBBY, lobby.size));
      const mode = modeFor(size);
      // The squad deploys together; each member connects to the match with this code.
      const launch = JSON.stringify({ t: 'lobby_launch', partyCode: this.partyCode, size, mode: mode.label });
      for (const member of lobby.values()) member.conn.send(launch);
    }
  }

  _onClose() {
    const lobby = lobbies.get(this.partyCode);
    if (!lobby) return;
    lobby.delete(this.id);
    if (!lobby.size) lobbies.delete(this.partyCode);
    else broadcastLobby(this.partyCode);
  }
}

// ---------- match ----------
class Client {
  constructor(conn, request) {
    this.conn = conn;
    this.id = 'p' + (nextId++);
    const url = new URL(request.url || '/', `http://${request.headers.host || '127.0.0.1'}`);
    // Team = the player's squad (party code). Unpartied clients get a unique code.
    this.team = cleanCode(url.searchParams.get('party') || ('SOLO-' + this.id));
    this.squadSize = Math.max(1, Math.min(MAX_LOBBY, Number(url.searchParams.get('size')) || 1));
    const inst = assignInstance(this.team, this.squadSize);
    this.inst = inst;
    inst.clients.set(this.id, this);
    const p = { id: this.id, name: 'Runner', team: this.team, x: 0, z: 0, facing: 0, hp: CONFIG.player.maxHealth, weapon: 0, carrying: false };
    inst.players.set(this.id, p);

    conn.on('message', (m) => this._onMessage(m));
    conn.on('close', () => this._onClose());

    const squad = modeFor(this.squadSize);
    this._send({
      t: 'welcome', id: this.id, team: this.team,
      match: {
        instance: inst.id,
        size: this.squadSize, mode: squad.label,   // YOUR squad label (HUD flavor)
        durationSec: CONFIG.match.durationSec,       // instance-level fixed clock
        coreSpawnSec: CONFIG.match.coreSpawnSec,
        elapsed: instElapsed(inst),
        insertionCountdownSec: CONFIG.match.insertionCountdownSec || 0,
        insertionRemaining: instInsertionRemaining(inst),
        cap: INSTANCE_CAP,
        online: inst.clients.size,
      },
      players: [...inst.players.values()].filter((q) => q.id !== this.id),
      core: { carrierId: inst.core.carrierId, x: inst.core.x, z: inst.core.z, spawned: inst.coreSpawned, tier: inst.core.tier },
      crates: [...inst.cratesOpened],
    });
    broadcast(inst, { t: 'join', player: p }, this.id);
    console.log(`[match] ${this.id} (${this.team}) -> ${inst.id} (${inst.clients.size}/${INSTANCE_CAP}) · ${totalOnline()} online`);
  }

  _send(obj) { this.conn.send(JSON.stringify(obj)); }

  _onMessage(raw) {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const inst = this.inst;
    const p = inst.players.get(this.id);
    if (!p) return;
    switch (msg.t) {
      case 'state':
        p.x = msg.x; p.z = msg.z; p.facing = msg.facing; p.hp = msg.hp; p.weapon = msg.weapon; p.carrying = msg.carrying;
        if (msg.name) p.name = msg.name;
        broadcast(inst, { t: 'state', id: this.id, team: p.team, x: p.x, z: p.z, facing: p.facing, hp: p.hp, weapon: p.weapon, carrying: p.carrying, name: p.name }, this.id);
        break;
      case 'fire':
        // Remember the shot so a following hit claim can be validated server-side.
        this._lastFire = { at: now(), weapon: Math.max(0, Math.min(WEAPONS.length - 1, Number(msg.weapon) || 0)) };
        broadcast(inst, { t: 'fire', id: this.id, ox: msg.ox, oz: msg.oz, dx: msg.dx, dz: msg.dz, weapon: msg.weapon }, this.id);
        break;
      case 'hit': { // server-authoritative: damage from CONFIG, gated by a recent shot + range + team
        const target = inst.clients.get(msg.target);
        const a = inst.players.get(this.id), b = inst.players.get(msg.target);
        const lf = this._lastFire;
        if (!target || !a || !b || msg.target === this.id || a.team === b.team) break;
        if (!lf || now() - lf.at > FIRE_WINDOW_MS) break;          // must follow a real shot
        const w = WEAPONS[lf.weapon] || WEAPONS[0] || { dmg: 18, range: 30 };
        const dx = a.x - b.x, dz = a.z - b.z;
        const reach = w.range + 8;                                 // margin for projectile travel + latency
        if (dx * dx + dz * dz > reach * reach) break;              // out of the weapon's plausible range
        const dmg = Math.min(MAX_HIT_DMG, Math.max(1, w.dmg));     // server sets the damage, not the client
        target._send({ t: 'hurt', by: this.id, dmg });
        break;
      }
      case 'crate_open':
        if (!inst.cratesOpened.has(msg.index)) { inst.cratesOpened.add(msg.index); broadcast(inst, { t: 'crate_open', index: msg.index, by: this.id }, this.id); }
        break;
      case 'core_pickup':
        if (inst.coreSpawned && !inst.core.carrierId) { inst.core.carrierId = this.id; broadcast(inst, { t: 'core_state', carrierId: this.id }); }
        else this._send({ t: 'core_denied' });
        break;
      case 'core_drop':
        if (inst.core.carrierId === this.id) { inst.core.carrierId = null; inst.core.x = msg.x; inst.core.z = msg.z; broadcast(inst, { t: 'core_state', carrierId: null, x: msg.x, z: msg.z }); }
        break;
      case 'core_extracted':
        if (inst.core.carrierId === this.id) { inst.core.carrierId = null; broadcast(inst, { t: 'core_state', carrierId: null, extractedBy: this.id }); }
        break;
    }
  }

  _onClose() {
    const inst = this.inst;
    inst.players.delete(this.id);
    inst.clients.delete(this.id);
    if (inst.core.carrierId === this.id) { inst.core.carrierId = null; broadcast(inst, { t: 'core_state', carrierId: null }); }
    broadcast(inst, { t: 'leave', id: this.id });
    console.log(`[match] ${this.id} left ${inst.id} (${inst.clients.size} left)`);
    if (inst.clients.size === 0) dropInstance(inst);
  }
}

// server-driven core spawn per instance so squads in the same match agree on timing
setInterval(() => {
  for (const inst of instances.values()) {
    if (!inst.startMs || inst.coreSpawned) continue;
    if (instElapsed(inst) >= CONFIG.match.coreSpawnSec) {
      inst.coreSpawned = true;
      broadcast(inst, { t: 'core_spawn', x: inst.core.x, z: inst.core.z, tier: inst.core.tier });
      console.log(`[match] core online in ${inst.id}`);
    }
  }
}, 500);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Deadwire match server · ${totalOnline()} online · ${instances.size} instances`);
});
attachWS(server, (conn, req) => {
  if ((req.url || '').startsWith('/lobby')) return new LobbyClient(conn, req);
  return new Client(conn, req);
});
server.listen(PORT, HOST, () => console.log(`Deadwire match server: listening on ${HOST}:${PORT}`));
