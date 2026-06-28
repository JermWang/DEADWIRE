// Deadwire match server — lightweight authority for a single Core Run room.
// Owns: player roster, match clock + core-spawn timing, core-carrier authority,
// crate-open authority. Relays: position/health state, fire visuals, PvP hits.
// PvE enemies stay client-local for this slice (each client simulates its own).
//   node server/match-server.mjs   ->  ws://127.0.0.1:5181
import http from 'node:http';
import { attachWS } from './ws.mjs';
import { CONFIG } from '../game/src/data/config.js';
import { chooseCoreTier } from '../game/src/data/economy.js';

// Railway (and most PaaS) inject PORT; fall back to MATCH_PORT then the dev default.
const PORT = Number(process.env.PORT || process.env.MATCH_PORT || 5181);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_LOBBY = 4;
const clients = new Map(); // id -> Client
const lobbies = new Map(); // partyCode -> Map<id, LobbyClient>
let nextId = 1;

// Party size auto-selects the mode (1=SOLO..4=SQUAD). Server stays the single
// source of truth for per-size timing; clients apply CONFIG.modes[size] for HUD.
function modeFor(size) {
  const n = Math.max(1, Math.min(MAX_LOBBY, Number(size) || 1));
  return CONFIG.modes?.[n] || { label: 'SOLO', durationSec: CONFIG.match.durationSec, coreSpawnSec: CONFIG.match.coreSpawnSec };
}

// One persistent room. The first match socket opens the insertion window; the
// match clock itself starts at GO so the pod countdown does not burn run time.
const room = {
  startMs: 0,
  size: 1,                 // current party size → mode timing
  coreSpawned: false,
  core: { carrierId: null, x: CONFIG.map?.coreSpawn?.[0] ?? 0, z: 0, tier: chooseCoreTier().id },
  cratesOpened: new Set(),
  players: new Map(), // id -> {id,name,x,z,facing,hp,weapon,carrying}
};

function now() { return Date.now(); }
function insertionMs() { return Math.max(0, Number(CONFIG.match?.insertionCountdownSec || 0) * 1000); }
function elapsed() { return room.startMs ? Math.max(0, (now() - room.startMs) / 1000) : 0; }
function insertionRemaining() { return room.startMs ? Math.max(0, (room.startMs - now()) / 1000) : 0; }
function broadcast(obj, exceptId) {
  const s = JSON.stringify(obj);
  for (const [id, c] of clients) if (id !== exceptId) c.conn.send(s);
}

function cleanPartyCode(value = '') {
  return String(value).toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 12) || 'DW-PUBLIC';
}

function broadcastLobby(code) {
  const lobby = lobbies.get(code);
  if (!lobby) return;
  const members = [...lobby.values()].map((client, index) => ({
    id: client.id,
    name: client.name,
    ready: client.ready,
    leader: index === 0,
  }));
  const message = JSON.stringify({ t: 'lobby_roster', partyCode: code, members });
  for (const client of lobby.values()) client.conn.send(message);
}

class LobbyClient {
  constructor(conn, request) {
    this.conn = conn;
    this.id = 'l' + (nextId++);
    const url = new URL(request.url || '/lobby', `http://${request.headers.host || '127.0.0.1'}`);
    this.partyCode = cleanPartyCode(url.searchParams.get('party'));
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
      // Party size determines the mode for every member of this party.
      const size = Math.max(1, Math.min(MAX_LOBBY, lobby.size));
      const mode = modeFor(size);
      // Group the upcoming match by party: this roster's size becomes the room mode.
      room.size = size;
      const launch = JSON.stringify({
        t: 'lobby_launch', partyCode: this.partyCode, size, mode: mode.label,
      });
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

class Client {
  constructor(conn) {
    this.conn = conn;
    this.id = 'p' + (nextId++);
    if (clients.size === 0) {
      room.startMs = now() + insertionMs();
      room.coreSpawned = false;
      room.core.carrierId = null;
      room.core.tier = chooseCoreTier().id;
      room.cratesOpened.clear();
    }
    clients.set(this.id, this);
    const p = { id: this.id, name: 'Runner', x: 0, z: 0, facing: 0, hp: CONFIG.player.maxHealth, weapon: 0, carrying: false };
    room.players.set(this.id, p);

    conn.on('message', (m) => this._onMessage(m));
    conn.on('close', () => this._onClose());

    const mode = modeFor(room.size);
    this._send({
      t: 'welcome', id: this.id,
      match: {
        size: room.size,
        mode: mode.label,
        durationSec: mode.durationSec,
        coreSpawnSec: mode.coreSpawnSec,
        elapsed: elapsed(),
        insertionCountdownSec: CONFIG.match.insertionCountdownSec || 0,
        insertionRemaining: insertionRemaining(),
      },
      players: [...room.players.values()].filter((q) => q.id !== this.id),
      core: { carrierId: room.core.carrierId, x: room.core.x, z: room.core.z, spawned: room.coreSpawned, tier: room.core.tier },
      crates: [...room.cratesOpened],
    });
    broadcast({ t: 'join', player: p }, this.id);
    console.log(`[match] ${this.id} joined (${clients.size} online)`);
  }

  _send(obj) { this.conn.send(JSON.stringify(obj)); }

  _onMessage(raw) {
    let msg; try { msg = JSON.parse(raw); } catch { return; }
    const p = room.players.get(this.id);
    if (!p) return;
    switch (msg.t) {
      case 'state':
        p.x = msg.x; p.z = msg.z; p.facing = msg.facing; p.hp = msg.hp; p.weapon = msg.weapon; p.carrying = msg.carrying;
        if (msg.name) p.name = msg.name;
        broadcast({ t: 'state', id: this.id, x: p.x, z: p.z, facing: p.facing, hp: p.hp, weapon: p.weapon, carrying: p.carrying, name: p.name }, this.id);
        break;
      case 'fire':
        broadcast({ t: 'fire', id: this.id, ox: msg.ox, oz: msg.oz, dx: msg.dx, dz: msg.dz, weapon: msg.weapon }, this.id);
        break;
      case 'hit': // client-authoritative PvP: I claim to have hit target for dmg
        if (clients.has(msg.target)) clients.get(msg.target)._send({ t: 'hurt', by: this.id, dmg: msg.dmg });
        break;
      case 'crate_open':
        if (!room.cratesOpened.has(msg.index)) { room.cratesOpened.add(msg.index); broadcast({ t: 'crate_open', index: msg.index, by: this.id }, this.id); }
        break;
      case 'core_pickup':
        if (room.coreSpawned && !room.core.carrierId) { room.core.carrierId = this.id; broadcast({ t: 'core_state', carrierId: this.id }); }
        else this._send({ t: 'core_denied' });
        break;
      case 'core_drop':
        if (room.core.carrierId === this.id) { room.core.carrierId = null; room.core.x = msg.x; room.core.z = msg.z; broadcast({ t: 'core_state', carrierId: null, x: msg.x, z: msg.z }); }
        break;
      case 'core_extracted':
        if (room.core.carrierId === this.id) { room.core.carrierId = null; broadcast({ t: 'core_state', carrierId: null, extractedBy: this.id }); }
        break;
    }
  }

  _onClose() {
    room.players.delete(this.id);
    clients.delete(this.id);
    if (room.core.carrierId === this.id) { room.core.carrierId = null; broadcast({ t: 'core_state', carrierId: null }); }
    broadcast({ t: 'leave', id: this.id });
    console.log(`[match] ${this.id} left (${clients.size} online)`);
    if (clients.size === 0) room.startMs = 0;
  }
}

// server-driven core spawn so all clients agree on timing
setInterval(() => {
  if (!room.startMs || room.coreSpawned) return;
  if (elapsed() >= modeFor(room.size).coreSpawnSec) {
    room.coreSpawned = true;
    broadcast({ t: 'core_spawn', x: room.core.x, z: room.core.z, tier: room.core.tier });
    console.log('[match] core online');
  }
}, 500);

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end(`Deadwire match server · ${clients.size} online`);
});
attachWS(server, (conn, req) => {
  if ((req.url || '').startsWith('/lobby')) return new LobbyClient(conn, req);
  return new Client(conn);
});
server.listen(PORT, HOST, () => console.log(`Deadwire match server: listening on ${HOST}:${PORT}`));
