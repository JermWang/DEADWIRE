// Minimal dependency-free WebSocket server (RFC 6455, text frames).
// Keeps the project zero-install like the rest of the tooling. Handles the
// handshake, masked client frames, fragmentation across TCP chunks, and close.
// Good enough for small JSON match messages; not a hardened production server.
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function attachWS(server, onConnection) {
  server.on('upgrade', (req, socket) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) { socket.destroy(); return; }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
    );
    socket.setNoDelay(true);
    onConnection(new Conn(socket), req);
  });
}

class Conn {
  constructor(socket) {
    this.socket = socket;
    this.handlers = {};
    this.buf = Buffer.alloc(0);
    this.closed = false;
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => this._emitClose());
    socket.on('error', () => this._emitClose());
  }

  on(ev, fn) { (this.handlers[ev] ||= []).push(fn); return this; }
  _emit(ev, ...a) { (this.handlers[ev] || []).forEach((f) => f(...a)); }
  _emitClose() { if (this.closed) return; this.closed = true; this._emit('close'); }

  _onData(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    let frame;
    while ((frame = this._readFrame())) {
      if (frame.opcode === 0x8) { this.close(); break; }           // close
      if (frame.opcode === 0x9) { this._pong(frame.payload); continue; } // ping -> pong
      if (frame.opcode === 0x1 || frame.opcode === 0x2) {
        this._emit('message', frame.payload.toString('utf8'));
      }
    }
  }

  _readFrame() {
    const b = this.buf;
    if (b.length < 2) return null;
    const opcode = b[0] & 0x0f;
    const masked = (b[1] & 0x80) !== 0;
    let len = b[1] & 0x7f;
    let offset = 2;
    if (len === 126) { if (b.length < 4) return null; len = b.readUInt16BE(2); offset = 4; }
    else if (len === 127) { if (b.length < 10) return null; len = Number(b.readBigUInt64BE(2)); offset = 10; }
    const maskLen = masked ? 4 : 0;
    if (b.length < offset + maskLen + len) return null;
    let payload;
    if (masked) {
      const mask = b.subarray(offset, offset + 4);
      const start = offset + 4;
      payload = Buffer.alloc(len);
      for (let i = 0; i < len; i++) payload[i] = b[start + i] ^ mask[i & 3];
    } else {
      payload = b.subarray(offset, offset + len);
    }
    this.buf = b.subarray(offset + maskLen + len);
    return { opcode, payload };
  }

  _frame(opcode, payload) {
    const len = payload.length;
    let header;
    if (len < 126) header = Buffer.from([0x80 | opcode, len]);
    else if (len < 65536) { header = Buffer.alloc(4); header[0] = 0x80 | opcode; header[1] = 126; header.writeUInt16BE(len, 2); }
    else { header = Buffer.alloc(10); header[0] = 0x80 | opcode; header[1] = 127; header.writeBigUInt64BE(BigInt(len), 2); }
    return Buffer.concat([header, payload]);
  }

  _pong(payload) { try { this.socket.write(this._frame(0xA, payload)); } catch { /* noop */ } }

  send(str) {
    if (this.closed) return;
    try { this.socket.write(this._frame(0x1, Buffer.from(str, 'utf8'))); } catch { this._emitClose(); }
  }

  close() {
    if (this.closed) return;
    try { this.socket.write(Buffer.from([0x88, 0])); this.socket.end(); } catch { /* noop */ }
    this._emitClose();
  }
}
