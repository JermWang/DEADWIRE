// WebSocketNet — real transport implementing the NetClient interface.
// Drop-in replacement for LocalNet. The game only ever calls on()/send()/connect().
import { NetClient } from './NetClient.js';

export class WebSocketNet extends NetClient {
  constructor(url) { super(); this.url = url; this.id = null; }
  get isLocal() { return false; }

  connect() {
    return new Promise((resolve, reject) => {
      let ws;
      try { ws = new WebSocket(this.url); } catch (e) { reject(e); return; }
      this.ws = ws;
      ws.onopen = () => { this.connected = true; };
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; }
        if (m.t === 'welcome') { this.id = m.id; resolve(m); }
        this.emit(m.t, m);
      };
      ws.onerror = (e) => { this.emit('error', e); if (!this.connected) reject(new Error('ws connect failed')); };
      ws.onclose = () => { this.connected = false; this.emit('close'); };
    });
  }

  send(obj) { if (this.ws && this.connected) this.ws.send(JSON.stringify(obj)); }
  disconnect() { this.connected = false; try { this.ws?.close(); } catch { /* noop */ } }
}
