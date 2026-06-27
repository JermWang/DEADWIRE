// NetClient — networking seam for future WebSocket multiplayer.
// The game talks ONLY to this interface, never to a socket directly. Today it's a
// local no-op; swapping in a real server means implementing the same methods.
//
// Authoritative match shape we intend to sync (day-one networking target):
//   player position, player health, shots/projectiles, loot pickup ownership,
//   core carrier state, extraction events.

export class NetClient {
  constructor() { this.handlers = {}; this.connected = false; }
  on(type, fn) { (this.handlers[type] ||= []).push(fn); return this; }
  emit(type, payload) { (this.handlers[type] || []).forEach((fn) => fn(payload)); }
  // overridden by transports
  connect() { return Promise.resolve(); }
  send() {}
  get isLocal() { return true; }
}

// Local single-client implementation. Echoes nothing; the game runs authoritative
// locally. Replace with WebSocketNet (same surface) for real PvPvE.
export class LocalNet extends NetClient {
  constructor() { super(); this.connected = true; this.id = 'local-runner'; }
  connect() { this.emit('open', { id: this.id }); return Promise.resolve(); }
  // Game calls these; locally we drop them. A real transport would serialize + send.
  sendState() {}
  sendEvent() {}
}

/*
 * FUTURE: class WebSocketNet extends NetClient
 *   - connect(url): open ws, on message -> emit(type, payload)
 *   - sendState(snapshot): throttled position/health/core updates
 *   - sendEvent(evt): fire/pickup/extract as discrete authoritative events
 *   - server reconciles + broadcasts; Game already consumes via on('state'|'event').
 */
