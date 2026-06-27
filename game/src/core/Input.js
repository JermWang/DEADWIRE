// Input — third-person shooter controls.
// Click the view to lock the pointer (mouse-look engaged); move the mouse to aim,
// WASD to move, hold left to fire, Esc to release the pointer. Keys are polled.
import * as THREE from 'three';

export class Input {
  constructor(domElement) {
    this.dom = domElement;
    this.keys = new Set();
    this.firing = false;
    this.aiming = false;
    this.locked = false;
    this.lookDX = 0;
    this.lookDY = 0;
    this.mouse = new THREE.Vector2();   // absolute NDC (used by menus, not gameplay)
    this._frameJust = new Set();
    this.justPressed = new Set();

    addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      if (!this.keys.has(k)) this._frameJust.add(k);
      this.keys.add(k);
    });
    addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));

    domElement.addEventListener('mousemove', (e) => {
      if (this.locked) { this.lookDX += e.movementX; this.lookDY += e.movementY; }
      const r = domElement.getBoundingClientRect();
      this.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
      this.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    });

    // first click locks the pointer; left fires and right holds ADS.
    domElement.addEventListener('mousedown', (e) => {
      if (e.button !== 0 && e.button !== 2) return;
      if (!this.locked) return this.requestLock();
      if (e.button === 0) this.firing = true;
      if (e.button === 2) this.aiming = true;
    });
    addEventListener('mouseup', (e) => {
      if (e.button === 0) this.firing = false;
      if (e.button === 2) this.aiming = false;
    });

    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === domElement;
      if (!this.locked) { this.firing = false; this.aiming = false; }
    });
    domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  requestLock() { this.dom.requestPointerLock?.(); }
  releaseLock() { if (this.locked) document.exitPointerLock?.(); }

  // returns accumulated mouse-look delta since last call, then resets
  consumeLook() { const d = { dx: this.lookDX, dy: this.lookDY }; this.lookDX = 0; this.lookDY = 0; return d; }

  beginFrame() { this.justPressed = new Set(this._frameJust); this._frameJust.clear(); }
  pressed(k) { return this.justPressed.has(k); }
  down(k) { return this.keys.has(k); }
}
