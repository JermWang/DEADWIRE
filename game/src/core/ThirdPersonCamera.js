// ThirdPersonCamera — over-the-shoulder follow cam for the TPS controls.
// Mouse-look drives yaw/pitch; the player faces yaw so the gun points where you look.
// Supplies a camera-relative movement basis and a screen-center aim point.
import * as THREE from 'three';

export class ThirdPersonCamera {
  constructor() {
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 400);
    this.yaw = 0;                // face +Z (into the map from the south spawn)
    this.pitch = 0.12;           // look nearly level (drops legs off the bottom)
    this.minPitch = -0.25;
    this.maxPitch = 1.0;
    this.distance = 2.0;         // close over-the-shoulder
    this.shoulder = 0.9;         // lateral offset so the runner sits to one side
    this.baseDistance = 2.0;
    this.baseShoulder = 0.9;
    this.baseFov = 62;
    this.pivotHeight = 1.5;      // shoulder pivot height on the character
    this.rise = 0.3;             // camera sits a touch above the shoulder
    this.sens = 0.0022;
    this.target = new THREE.Vector3();
    this.up = new THREE.Vector3(0, 1, 0);
    this.forward = new THREE.Vector3();
    this.right = new THREE.Vector3();
    this._lookDir = new THREE.Vector3();
    this.shakeMag = 0; this.shakeT = 0; this.shakeDur = 0.3;
    this._ray = new THREE.Raycaster();
    this._ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this._basis();
  }

  rotate(dx, dy) {
    this.yaw -= dx * this.sens;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + dy * this.sens));
  }

  addShake(m) { this.shakeMag = Math.max(this.shakeMag, m); this.shakeT = this.shakeDur; }

  setAiming(aiming, dt) {
    const k = Math.min(1, dt * 12);
    this.distance += ((aiming ? 1.45 : this.baseDistance) - this.distance) * k;
    this.shoulder += ((aiming ? 0.64 : this.baseShoulder) - this.shoulder) * k;
    this.camera.fov += ((aiming ? 50 : this.baseFov) - this.camera.fov) * k;
    this.camera.updateProjectionMatrix();
  }

  _basis() {
    this.forward.set(Math.sin(this.yaw), 0, Math.cos(this.yaw)).normalize();
    this.right.crossVectors(this.forward, this.up).normalize();
  }

  update(playerPos, dt) {
    this._basis();
    // shoulder pivot near the runner's head/shoulder, offset to one side
    const pivot = new THREE.Vector3(playerPos.x, playerPos.y + this.pivotHeight, playerPos.z)
      .addScaledVector(this.right, this.shoulder);
    this.target.lerp(pivot, Math.min(1, dt * 18));
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    // camera sits close behind + slightly above the shoulder
    this.camera.position.copy(this.target)
      .addScaledVector(this.forward, -this.distance * cp)
      .add(new THREE.Vector3(0, this.rise, 0));
    if (this.shakeT > 0) {
      this.shakeT = Math.max(0, this.shakeT - dt);
      const k = (this.shakeT / this.shakeDur) * this.shakeMag;
      this.camera.position.x += (Math.random() - 0.5) * k;
      this.camera.position.y += (Math.random() - 0.5) * k * 0.6;
      this.camera.position.z += (Math.random() - 0.5) * k;
      if (this.shakeT === 0) this.shakeMag = 0;
    }
    // look FORWARD along the aim direction (down per pitch), not at the character
    this._lookDir.set(this.forward.x * cp, -sp, this.forward.z * cp);
    this.camera.lookAt(this.camera.position.clone().add(this._lookDir));
  }

  snap(playerPos) {
    this.target.set(playerPos.x, playerPos.y + this.pivotHeight, playerPos.z).addScaledVector(this.right, this.shoulder);
    this.update(playerPos, 1);
  }

  resize(w, h) { this.camera.aspect = w / Math.max(1, h); this.camera.updateProjectionMatrix(); }

  // world point under the screen-center crosshair (ground hit, else far along ray)
  aimPoint(out = new THREE.Vector3()) {
    this._ray.setFromCamera({ x: 0, y: 0 }, this.camera);
    if (!this._ray.ray.intersectPlane(this._ground, out)) {
      out.copy(this.camera.position).addScaledVector(this._ray.ray.direction, 80);
    }
    return out;
  }

  // forwardAmt (W/S) + strafeAmt (D/A) -> ground move vector
  moveDir(forwardAmt, strafeAmt, out = new THREE.Vector3()) {
    out.set(0, 0, 0).addScaledVector(this.forward, forwardAmt).addScaledVector(this.right, strafeAmt);
    if (out.lengthSq() > 0) out.normalize();
    return out;
  }
}
