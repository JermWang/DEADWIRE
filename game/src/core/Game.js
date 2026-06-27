// Game — the Core Run match orchestrator. Owns the scene, entities, systems,
// the match timer, and the local match loop. Talks to the network only through
// NetClient so multiplayer can drop in later without touching gameplay code.
import * as THREE from 'three';
import { CONFIG } from '../data/config.js';
import { Input } from './Input.js';
import { ThirdPersonCamera } from './ThirdPersonCamera.js';
import { BreakerYard } from '../world/BreakerYard.js';
import { Player } from '../entities/Player.js';
import { Enemy } from '../entities/Enemy.js';
import { Projectile } from '../entities/Projectile.js';
import { LootCrate } from '../entities/LootCrate.js';
import { UnstableCore } from '../entities/UnstableCore.js';
import { ExtractionZone } from '../entities/ExtractionZone.js';
import { Hud } from '../ui/Hud.js';
import { showResults } from '../ui/Results.js';
import { Stash } from '../systems/Stash.js';
import { LocalNet } from '../net/NetClient.js';
import { WebSocketNet } from '../net/WebSocketNet.js';
import { matchWsBase } from '../config/runtime.js';
import { Account } from '../net/account.js';
import { RemotePlayer } from '../entities/RemotePlayer.js';
import { PostFX } from '../render/PostFX.js';
import { ObjectiveIndicator } from '../render/ObjectiveIndicator.js';
import { makeSky } from '../render/Sky.js';
import { disposeObjectTree } from '../render/dispose.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { mat, PALETTE } from '../assets.js';

export class Game {
  constructor(canvas, uiRoot) {
    this.canvas = canvas;
    this.uiRoot = uiRoot;
    this.net = new LocalNet();

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x7d7159, 110, 245);  // expanded district fades into a dusty painted horizon

    // graded skydome (replaces flat background); follows the camera so it never clips
    this.sky = makeSky({ top: '#2b3a47', horizon: '#7d7159' });
    this.scene.add(this.sky);

    // neutral environment so metals/roughness read with real reflections
    try {
      const pmrem = new THREE.PMREMGenerator(this.renderer);
      this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    } catch { /* env map optional */ }

    this.rig = new ThirdPersonCamera();
    this.input = new Input(canvas);

    this._setupLights();
    this.fx = new PostFX(this.renderer, this.scene, this.rig.camera, 1280, 720);
    this.clock = new THREE.Clock();
    this._aim = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this.t = 0;

    addEventListener('resize', () => this._resize());
  }

  _setupLights() {
    this.scene.add(new THREE.HemisphereLight(0xbcd2e6, 0x55483a, 2.6)); // bright sky + warm bounce
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.45));              // lift the shadows
    const sun = new THREE.DirectionalLight(0xfff2da, 2.9);
    sun.position.set(20, 30, 12);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0004;
    const cam = sun.shadow.camera;
    cam.left = -115; cam.right = 115; cam.top = 115; cam.bottom = -115; cam.far = 260;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0x9fc0e0, 1.0);
    fill.position.set(-15, 12, -10);
    this.scene.add(fill);
  }

  start(cosmetics = {}, online = false, name = 'Runner') {
    this._reset();
    this.input.keys.clear();        // drop any keys held from the deploy/results screen
    this.cosmetics = cosmetics;
    this.online = online;
    this.playerName = name;
    this.remotes = new Map();
    this.stateTimer = 0;
    this.corePickupSent = false;
    this.net = online ? new WebSocketNet(matchWsBase()) : new LocalNet();

    // world
    this.map = new BreakerYard();
    this.scene.add(this.map.root);

    // player
    this.player = new Player(cosmetics);
    const sp = this.map.def.spawnPoints[5]; // south road start
    this.player.mesh.position.set(sp[0], 0, sp[1]);
    this.scene.add(this.player.mesh);
    this.rig.snap(this.player.position);

    // carry indicator (glowing orb shown over the player while carrying core)
    this.carryOrb = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.18, 1),
      mat(PALETTE.coreGlow, { emissive: PALETTE.coreGlow, emissiveIntensity: 2.4 })
    );
    this.carryOrb.visible = false;
    const back = this.player.mesh.getObjectByName('backpack');
    (back || this.player.mesh).add(this.carryOrb);

    // entities
    this.enemies = [];
    for (const nest of this.map.def.enemyNests) {
      for (let i = 0; i < nest.count; i++) {
        const angle = (i / nest.count) * Math.PI * 2;
        const pos = new THREE.Vector3(nest.pos[0] + Math.cos(angle) * 2, 0, nest.pos[1] + Math.sin(angle) * 2);
        const e = new Enemy(nest.type, pos);
        this.enemies.push(e); this.scene.add(e.mesh);
      }
    }
    this.crates = this.map.def.lootCrates.map((c) => {
      const crate = new LootCrate(new THREE.Vector3(c[0], c[2] ?? 0, c[1]));
      this.scene.add(crate.mesh); return crate;
    });
    this.core = new UnstableCore(new THREE.Vector3(this.map.def.coreSpawn[0], 0, this.map.def.coreSpawn[1]));
    this.scene.add(this.core.mesh);
    this.extracts = this.map.def.extractionZones.map((z) => {
      const ez = new ExtractionZone(new THREE.Vector3(z.pos[0], 0, z.pos[1]), z.radius);
      this.scene.add(ez.group); return ez;
    });

    // Constant-screen-size, camera-facing objective beacons shared by all teams.
    this.objectiveIndicators = [];
    this.coreIndicator = new ObjectiveIndicator({
      label: 'UNSTABLE CORE', icon: '◆', color: PALETTE.coreGlow, height: 3.1,
    });
    this.coreIndicator.setVisible(false);
    this.scene.add(this.coreIndicator.root);
    this.objectiveIndicators.push(this.coreIndicator);
    this.extractIndicators = this.extracts.map((ez, index) => {
      const marker = new ObjectiveIndicator({
        label: `EXTRACT ${String.fromCharCode(65 + index)}`,
        icon: '⇧',
        color: PALETTE.toxic,
        height: 3.6,
      });
      this.scene.add(marker.root);
      this.objectiveIndicators.push(marker);
      return marker;
    });

    // core ping ring fx
    this.pingRing = new THREE.Mesh(
      new THREE.RingGeometry(0.5, 0.7, 24),
      mat(PALETTE.warningRed, { emissive: PALETTE.warningRed, emissiveIntensity: 1.5, transparent: true, opacity: 0.9 })
    );
    this.pingRing.rotation.x = -Math.PI / 2; this.pingRing.visible = false;
    this.scene.add(this.pingRing);

    this.projectiles = [];

    // hud
    this.hud = new Hud(this.uiRoot, this.rig.camera);
    this.hud.setHealth(this.player.health, CONFIG.player.maxHealth);
    this.hud.setLoot(this.run.loot);
    this.hud.setWeapon(this.player.loadout.map((w) => w.name), this.player.weaponIndex);
    this.hud.setAmmo(this.player.ammo);
    this.hud.banner('DEPLOYED · Breaker Yard');

    // reusable muzzle flash quad
    this.flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.6, 0.6),
      mat(PALETTE.coreHot, { emissive: PALETTE.coreHot, emissiveIntensity: 3, transparent: true, opacity: 0, flat: false })
    );
    this.flash.rotation.x = -Math.PI / 2;
    this.flashLife = 0;
    this.scene.add(this.flash);

    this.state = 'playing';
    this._resize();
    if (this.online) this._wireNet();
    this.net.connect()
      .then((welcome) => { if (this.online && welcome) this._onWelcome(welcome); })
      .catch(() => { this.hud.banner('⚠ Server offline — playing solo', 2600); this.online = false; });
    if (!this._raf) this._loop();
  }

  // ---- networking ----
  _wireNet() {
    this.net.on('welcome', (m) => this._onWelcome(m));
    this.net.on('join', (m) => this._addRemote(m.player));
    this.net.on('leave', (m) => this._removeRemote(m.id));
    this.net.on('state', (m) => { const r = this.remotes.get(m.id); if (r) { if (m.name) r.name = m.name; r.setState(m); } else this._addRemote(m); });
    this.net.on('fire', (m) => this._remoteTracer(m));
    this.net.on('hurt', (m) => this._hurtPlayer(m.dmg));
    this.net.on('crate_open', (m) => this._reflectCrateOpen(m.index));
    this.net.on('core_spawn', (m) => { if (!this.coreSpawned) this._spawnCore(); });
    this.net.on('core_state', (m) => this._onCoreState(m));
    this.net.on('core_denied', () => this.hud.banner('Core already taken', 1600));
  }

  _onWelcome(m) {
    this.localId = m.id;
    if (m.match) this.timeLeft = m.match.durationSec - m.match.elapsed;
    for (const p of m.players || []) this._addRemote(p);
    if (m.core?.spawned && !this.coreSpawned) this._spawnCore();
    if (m.core?.carrierId) this._onCoreState({ carrierId: m.core.carrierId });
    for (const idx of m.crates || []) this._reflectCrateOpen(idx);
    this.hud.banner(`ONLINE · ${this.remotes.size + 1} runners`, 2200);
  }

  _addRemote(p) {
    if (!p || p.id === this.localId || this.remotes.has(p.id)) return;
    const r = new RemotePlayer(p.id, p.name || 'Runner');
    r.target.set(p.x || 0, 0, p.z || 0); r.mesh.position.copy(r.target);
    if (p.hp != null) r.hp = p.hp; if (p.carrying != null) r.carrying = p.carrying;
    this.remotes.set(p.id, r); this.scene.add(r.mesh);
  }

  _removeRemote(id) { const r = this.remotes.get(id); if (r) { r.dispose(this.scene); this.remotes.delete(id); } }

  _remoteTracer(m) {
    const origin = new THREE.Vector3(m.ox, 0.9, m.oz);
    const dir = new THREE.Vector3(m.dx, 0, m.dz);
    const p = new Projectile(origin, dir, { speed: 24, life: 1.0, damage: 0, fromPlayer: false, ghost: true });
    this.projectiles.push(p); this.scene.add(p.mesh);
  }

  _reflectCrateOpen(index) {
    const c = this.crates[index];
    if (c && !c.opened) { c.open(); } // mark opened + visual; no loot for the observer
  }

  _spawnCore() { this.coreSpawned = true; this.core.spawn(); this.hud.siren(); this.rig.addShake(0.6); this.hud.banner('⚠ UNSTABLE CORE ONLINE', 2600); this.hud.setObjective('Secure the core and extract'); }

  _onCoreState(m) {
    // authoritative core ownership from the server
    if (m.carrierId === this.localId) {
      // granted to me
      this.core.pickUp(this.player); this.carryOrb.visible = true;
      this.hud.setCore('carrying'); this.hud.banner('CORE SECURED — extract it', 2400);
      this.hud.setObjective('Extract with the core (south road)');
    } else if (m.carrierId) {
      // a remote holds it
      if (this.player.carryingCore) { this.player.carryingCore = false; this.carryOrb.visible = false; this.hud.setCore(''); }
      this.core.carrier = { remote: true }; this.core.mesh.visible = false;
      const r = this.remotes.get(m.carrierId); if (r) r.carrying = true;
    } else {
      // dropped / extracted / carrier left
      if (this.player.carryingCore) { this.player.carryingCore = false; this.carryOrb.visible = false; this.hud.setCore('dropped'); }
      for (const r of this.remotes.values()) r.carrying = false;
      this.core.carrier = null;
      if (!m.extractedBy) { this.core.mesh.position.set(m.x ?? this.core.spawnPos.x, 0, m.z ?? this.core.spawnPos.z); this.core.mesh.visible = true; }
      else { this.core.mesh.visible = false; }
    }
  }

  _sendState(dt) {
    this.stateTimer -= dt;
    if (this.stateTimer > 0) return;
    this.stateTimer = 0.066; // ~15 Hz
    this.net.send({
      t: 'state', name: this.playerName,
      x: +this.player.position.x.toFixed(2), z: +this.player.position.z.toFixed(2),
      facing: +this.player.facing.toFixed(2), hp: Math.ceil(this.player.health),
      weapon: this.player.weaponIndex, carrying: this.player.carryingCore,
    });
  }

  _reset() {
    // close any prior match connection + remove remote avatars
    this.net?.disconnect?.();
    if (this.remotes) { for (const r of this.remotes.values()) r.dispose(this.scene); this.remotes.clear(); }
    // clear previous run objects from scene
    if (this.map) {
      this.scene.remove(this.map.root);
      this.map.dispose?.();
    }
    if (this.hud) this.hud.el.remove();
    for (const arr of ['enemies', 'crates', 'extracts']) {
      (this[arr] || []).forEach((o) => {
        const root = o.mesh || o.group;
        this.scene.remove(root);
        disposeObjectTree(root);
      });
    }
    (this.projectiles || []).forEach((p) => { this.scene.remove(p.mesh); disposeObjectTree(p.mesh); });
    (this.particles || []).forEach((p) => { this.scene.remove(p.mesh); disposeObjectTree(p.mesh); });
    this.particles = [];
    if (this.player) { this.scene.remove(this.player.mesh); disposeObjectTree(this.player.mesh); }
    if (this.core) { this.scene.remove(this.core.mesh); disposeObjectTree(this.core.mesh); }
    if (this.pingRing) { this.scene.remove(this.pingRing); disposeObjectTree(this.pingRing); }
    if (this.flash) { this.scene.remove(this.flash); disposeObjectTree(this.flash); }
    if (this.objectiveIndicators) {
      for (const marker of this.objectiveIndicators) {
        this.scene.remove(marker.root);
        marker.dispose();
      }
    }
    this.objectiveIndicators = [];

    this.timeLeft = CONFIG.match.durationSec;
    this.run = { loot: {}, machines: 0, players: 0, coreExtracted: false, coreLost: false };
    this.defeatedRemoteIds = new Set();
    this.coreSpawned = false;
    this.pingTimer = CONFIG.player.pingIntervalSec;
    this.extractHold = 0;
    this.pingFx = 0;
  }

  // ---- main loop ----
  _loop() {
    this._raf = requestAnimationFrame(() => this._loop());
    const dt = Math.min(0.05, this.clock.getDelta());
    this.t += dt;
    if (this.state === 'playing') this._update(dt);
    this.map?.update(dt, this.t);
    this.core?.update(dt);
    this.extracts?.forEach((e) => e.update(dt));
    this.hud?.update(dt, this.renderer);
    if (this.sky) this.sky.position.copy(this.rig.camera.position);
    this.fx.render(dt);
    this.input.beginFrame();
  }

  _update(dt) {
    // ---- match timer ----
    this.timeLeft -= dt;
    this.hud.setTimer(this.timeLeft);
    if (this.timeLeft <= 0) return this._endRun(false, 'Timed out in the yard');

    // ---- core spawn (solo: timer-driven; online: server 'core_spawn' event) ----
    if (!this.online && !this.coreSpawned && CONFIG.match.durationSec - this.timeLeft >= CONFIG.match.coreSpawnSec) {
      this._spawnCore();
    }

    // ---- camera mouse-look ----
    const look = this.input.consumeLook();
    this.rig.rotate(look.dx, look.dy);
    this.hud.setAimHint(!this.input.locked);

    // ---- movement (camera-relative) ----
    const fwd = (this.input.down('w') ? 1 : 0) - (this.input.down('s') ? 1 : 0);
    const strafe = (this.input.down('d') ? 1 : 0) - (this.input.down('a') ? 1 : 0);
    const mv = this.rig.moveDir(fwd, strafe, this._tmp);
    this.player.updateActions(dt);
    const moving = mv.lengthSq() > 0;
    const running = moving && this.input.down('shift') && !this.input.aiming;
    const aiming = this.input.aiming && !this.player.rolling;

    if (this.input.pressed(' ')) this.player.jump();
    if ((this.input.pressed('q') || this.input.pressed('control')) && this.player.alive) {
      const rollDir = moving ? mv : this.rig.forward;
      if (this.player.startRoll(rollDir)) {
        this.player.facing = Math.atan2(this.player.rollDir.x, this.player.rollDir.z);
        this.hud.banner('ROLL', 450);
      }
    }

    let speed = running ? CONFIG.player.runSpeed : CONFIG.player.moveSpeed;
    if (aiming) speed *= 0.72;
    if (this.player.carryingCore) speed *= CONFIG.player.coreSlowFactor;
    if (this.player.alive) {
      if (this.player.rolling) this.player.position.addScaledVector(this.player.rollDir, CONFIG.player.rollSpeed * dt);
      else this.player.position.addScaledVector(mv, speed * dt);
      this.map.collide(this.player.position, this.player.radius);
    }

    // ---- semantic floor / connector height + grounded jump physics ----
    const groundY = this.map.groundHeightAt(
      this.player.position,
      this.player.grounded ? 1.35 : 8,
    );
    if (!this.player.grounded) {
      this.player.verticalVelocity -= CONFIG.player.gravity * dt;
      this.player.position.y += this.player.verticalVelocity * dt;
      if (this.player.position.y <= groundY) {
        this.player.position.y = groundY;
        this.player.verticalVelocity = 0;
        this.player.grounded = true;
      }
    } else {
      this.player.position.y = groundY;
    }

    if (this.input.pressed('m')) {
      const debugEnabled = this.map.toggleDebug();
      this.hud.banner(`MAP DEBUG ${debugEnabled ? 'ON' : 'OFF'}`, 1000);
    }

    // ---- aim + face (player faces where the camera looks) ----
    this.rig.aimPoint(this._aim);
    if (this.player.alive && !this.player.rolling) this.player.facing = this.rig.yaw;
    if (this.player.alive) this.player.mesh.rotation.y = this.player.facing;
    this.rig.setAiming(aiming, dt);
    this.rig.update(this.player.position, dt);

    // ---- full-body action rig ----
    this.player.anim.update(dt, {
      alive: this.player.alive,
      moving: this.player.alive && moving && !this.player.rolling,
      running,
      speedRatio: speed / CONFIG.player.moveSpeed,
      grounded: this.player.grounded,
      verticalVelocity: this.player.verticalVelocity,
      rolling: this.player.rolling,
      rollProgress: 1 - this.player.rollTimer / CONFIG.player.rollDuration,
      aiming,
    });
    this.hud.setMovement(
      this.player.rolling ? 'ROLLING' : !this.player.grounded ? 'AIRBORNE' : aiming ? 'ADS' : running ? 'SPRINT' : '',
      this.player.rollCooldown,
    );

    // ---- weapon swap ----
    for (let i = 0; i < this.player.weapons.length; i++) {
      if (this.input.pressed(String(i + 1)) && this.player.swapTo(i)) {
        this.hud.setWeapon(this.player.loadout.map((w) => w.name), this.player.weaponIndex);
        this.hud.setAmmo(this.player.ammo);
        this.hud.banner(this.player.weaponDef.name, 900);
        this.player.anim.swap();
      }
    }

    // ---- fire (with burst handling) ----
    this.player.fireCooldown -= dt;
    this.player.burstTimer -= dt;
    const def = this.player.weaponDef;
    if (this.input.firing && this.player.alive && !this.player.rolling && this.player.fireCooldown <= 0 && this.player.burstQueue <= 0) {
      this.player.fireCooldown = 1 / def.fireRate;
      this.player.burstQueue = def.burst;
      this.player.burstTimer = 0;
    }
    if (this.player.burstQueue > 0 && this.player.burstTimer <= 0 && this.player.alive && !this.player.rolling) {
      if (this.player.ammo >= (def.ammoCost || 1)) {
        this._fireVolley(def);
        this.player.ammo -= (def.ammoCost || 1);
        this.hud.setAmmo(this.player.ammo);
        this.player.burstQueue -= 1;
        this.player.burstTimer = def.burstDelay;
      } else {
        this.player.burstQueue = 0;          // out of ammo — stop firing
        this.hud.banner('OUT OF AMMO — find more or extract', 1200);
      }
    }

    // ---- muzzle flash decay ----
    if (this.flashLife > 0) {
      this.flashLife -= dt;
      this.flash.material.opacity = Math.max(0, this.flashLife / 0.06);
    }

    // ---- weapon recharge tell ----
    this.hud.setWeaponCooldown(1 - Math.max(0, Math.min(1, this.player.fireCooldown * def.fireRate)));

    // ---- projectiles ----
    this._updateProjectiles(dt);

    // ---- enemies ----
    for (const e of this.enemies) {
      if (!e.alive) { e.update(dt, this.player.position, false); continue; }
      const los = e.kind === 'ranged' ? this._hasLOS(e.position, this.player.position) : true;
      e.update(dt, this.player.position, los);
      if (e.pendingShot) this._enemyFire(e.pendingShot);
      const dmg = e.tryAttack(this.player.position);
      if (dmg && this.player.alive) this._hurtPlayer(dmg);
      if (!this.player.alive) return;
    }

    // ---- interactions (crates / core / extract) ----
    this._updateInteractions(dt);

    // ---- core carry effects ----
    this._updateCoreCarry(dt);
    this._updateObjectiveIndicators(dt);

    // ---- debris + tactical UI (reticle, minimap, markers) ----
    this._updateParticles(dt);
    this._updateTacticalUI();

    // ---- networking ----
    if (this.online) {
      for (const r of this.remotes.values()) r.update(dt);
      this._sendState(dt);
    }
  }

  _toScreen(world) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._tmp2 = this._tmp2 || new THREE.Vector3();
    this._tmp2.copy(world).project(this.rig.camera);
    return { x: (this._tmp2.x * 0.5 + 0.5) * rect.width, y: (-this._tmp2.y * 0.5 + 0.5) * rect.height };
  }

  _updateTacticalUI() {
    // crosshair stays at screen center (TPS); parked off-screen when dead
    if (this.player.alive) { const r = this.renderer.domElement.getBoundingClientRect(); this.hud.setReticle(r.width / 2, r.height / 2); }
    else this.hud.setReticle(-100, -100);

    // minimap
    const [minX, minZ] = this.map.def.bounds.min, [maxX, maxZ] = this.map.def.bounds.max;
    this.hud.drawMinimap({
      bounds: [minX, minZ, maxX, maxZ],
      player: { x: this.player.position.x, z: this.player.position.z, facing: this.player.facing },
      enemies: this.enemies.map((e) => ({ x: e.position.x, z: e.position.z, alive: e.alive, kind: e.kind })),
      crates: this.crates.map((c) => ({ x: c.position.x, z: c.position.z, opened: c.opened })),
      extracts: this.extracts.map((e) => ({ x: e.position.x, z: e.position.z, r: e.radius })),
      core: { x: this.core.position.x, z: this.core.position.z, spawned: this.core.spawned, carried: !!this.core.carrier },
      pulse: (Math.sin(this.t * 5) + 1) / 2,
      carrying: this.player.carryingCore,
    });

    // off-screen objective markers
    const markers = [];
    if (this.player.carryingCore) {
      let best = null, bd = Infinity;
      for (const e of this.extracts) { const d = this.player.position.distanceTo(e.position); if (d < bd) { bd = d; best = e; } }
      if (best) markers.push({ key: 'extract', pos: new THREE.Vector3(best.position.x, 1, best.position.z), label: 'EXTRACT', color: '#9bff5a', edgeOnly: true });
    } else if (this.core.spawned && !this.core.carrier) {
      markers.push({ key: 'core', pos: new THREE.Vector3(this.core.position.x, 1.2, this.core.position.z), label: 'CORE', color: '#54f7c8', edgeOnly: true });
    }
    this.hud.setMarkers(markers, this.renderer);
  }

  _spawnDebris(pos, color, count = 8) {
    if (!this._debrisGeo) {
      this._debrisGeo = new THREE.BoxGeometry(0.16, 0.16, 0.16);
      this._debrisGeo.userData.deadwireShared = true;
    }
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this._debrisGeo, mat(color, { flat: true }));
      m.position.copy(pos); m.position.y = 0.4 + Math.random() * 0.4;
      const ang = Math.random() * Math.PI * 2, sp = 2 + Math.random() * 3;
      this.particles.push({
        mesh: m, life: 0.7 + Math.random() * 0.3,
        vel: new THREE.Vector3(Math.cos(ang) * sp, 3 + Math.random() * 3, Math.sin(ang) * sp),
        spin: (Math.random() - 0.5) * 12,
      });
      this.scene.add(m);
    }
  }

  _updateParticles(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vel.y -= 14 * dt; // gravity
      p.mesh.position.addScaledVector(p.vel, dt);
      if (p.mesh.position.y < 0.08) { p.mesh.position.y = 0.08; p.vel.y *= -0.4; p.vel.x *= 0.6; p.vel.z *= 0.6; }
      p.mesh.rotation.x += p.spin * dt; p.mesh.rotation.y += p.spin * dt;
      p.life -= dt;
      p.mesh.scale.setScalar(Math.max(0.01, p.life / 0.5));
      if (p.life <= 0) { this.scene.remove(p.mesh); this.particles.splice(i, 1); }
    }
  }

  _fireVolley(def) {
    const origin = this.player.muzzleWorld().clone(); origin.y = 0.9;
    const base = this._aim.clone().sub(this.player.position).setY(0);
    if (base.lengthSq() < 1e-4) base.set(Math.sin(this.player.facing), 0, Math.cos(this.player.facing));
    const baseAngle = Math.atan2(base.x, base.z);
    const stanceSpread = this.input.aiming ? 0.55 : 2.1;
    const spread = Math.max(this.input.aiming ? 0 : 0.025, def.spread * stanceSpread);
    for (let i = 0; i < def.pellets; i++) {
      const jitter = (def.pellets > 1 ? (i / (def.pellets - 1) - 0.5) * 2 : (Math.random() - 0.5)) * spread;
      const a = baseAngle + jitter;
      const dir = new THREE.Vector3(Math.sin(a), 0, Math.cos(a));
      const p = new Projectile(origin, dir, {
        speed: def.projectileSpeed, life: def.projectileLife, damage: def.damage, fromPlayer: true,
      });
      this.projectiles.push(p); this.scene.add(p.mesh);
    }
    // muzzle flash + recoil shake (shotgun kicks harder)
    this.flash.position.copy(origin); this.flash.position.y = 0.9;
    this.flashLife = 0.06; this.flash.material.opacity = 1;
    this.rig.addShake(def.pellets > 1 ? 0.32 : 0.12);
    this.player.anim.recoil(def.pellets > 1 ? 1.3 : 0.8);
    if (this.online) this.net.send({
      t: 'fire', ox: +origin.x.toFixed(2), oz: +origin.z.toFixed(2),
      dx: +Math.sin(baseAngle).toFixed(3), dz: +Math.cos(baseAngle).toFixed(3), weapon: this.player.weaponIndex,
    });
  }

  _enemyFire(shot) {
    const p = new Projectile(shot.origin, shot.dir, {
      speed: shot.speed || 16, life: shot.life || 1.6, damage: shot.damage || 8, fromPlayer: false,
    });
    this.projectiles.push(p); this.scene.add(p.mesh);
  }

  _hurtPlayer(dmg) {
    if (!this.player.alive) return;
    if (!this.player.takeDamage(dmg)) return;
    this.hud.setHealth(this.player.health, CONFIG.player.maxHealth);
    this.hud.flashHurt();
    this.hud.popDamage(this.player.position, dmg, 'player');
    this.rig.addShake(0.45);
    if (!this.player.alive) this._onPlayerDeath();
  }

  // sample the segment against blockers; false if anything opaque is between
  _hasLOS(from, to) {
    const steps = 14;
    for (let i = 1; i < steps; i++) {
      const tx = from.x + (to.x - from.x) * (i / steps);
      const tz = from.z + (to.z - from.z) * (i / steps);
      for (const b of this.map.blockers) {
        if (b.radius != null) {
          const dx = tx - b.x, dz = tz - b.z;
          if (dx * dx + dz * dz < b.radius * b.radius) return false;
        } else if (Math.abs(tx - b.x) < b.hx && Math.abs(tz - b.z) < b.hz) {
          return false;
        }
      }
    }
    return true;
  }

  _updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.update(dt);
      let hit = false;
      if (p.ghost) {
        // remote tracer: visual only
      } else if (p.fromPlayer) {
        for (const e of this.enemies) {
          if (!e.alive) continue;
          const dx = p.mesh.position.x - e.position.x, dz = p.mesh.position.z - e.position.z;
          const hitR = e.radius + p.radius;
          if (dx * dx + dz * dz < hitR * hitR) {
            const dead = e.takeDamage(p.damage);
            this.hud.popDamage(e.position, p.damage, 'enemy');
            if (dead) this._onEnemyKilled(e);
            hit = true; break;
          }
        }
        // PvP: hit a remote runner -> report to server (authoritative target applies)
        if (!hit && this.online) {
          for (const r of this.remotes.values()) {
            const dx = p.mesh.position.x - r.position.x, dz = p.mesh.position.z - r.position.z;
            const hitR = r.radius + p.radius;
            if (dx * dx + dz * dz < hitR * hitR) {
              this.hud.popDamage(r.position, p.damage, 'enemy');
              if (r.hp > 0 && r.hp - p.damage <= 0 && !this.defeatedRemoteIds.has(r.id)) {
                this.defeatedRemoteIds.add(r.id);
                this.run.players += 1;
                this.hud.banner(`Runner defeated (${this.run.players})`, 1200);
              }
              this.net.send({ t: 'hit', target: r.id, dmg: p.damage });
              hit = true; break;
            }
          }
        }
      } else if (this.player.alive) {
        const dx = p.mesh.position.x - this.player.position.x, dz = p.mesh.position.z - this.player.position.z;
        const hitR = this.player.radius + p.radius + 0.2;
        if (dx * dx + dz * dz < hitR * hitR) { this._hurtPlayer(p.damage); hit = true; }
      }
      if (hit || p.dead) { this.scene.remove(p.mesh); this.projectiles.splice(i, 1); }
    }
  }

  _onEnemyKilled(e) {
    this.run.machines += 1;
    if (e.mesh.userData.eye) e.mesh.userData.eye.material.emissiveIntensity = 0;
    this._spawnDebris(e.position, PALETTE.machineHull, e.kind === 'tank' ? 16 : 8);
    this.rig.addShake(e.kind === 'tank' ? 0.4 : 0.18);
    this.hud.banner(`Machine destroyed (${this.run.machines})`, 1200);
  }

  _updateInteractions(dt) {
    if (!this.player.alive || this.player.rolling) { this.hud.prompt(''); return; }
    const pos = this.player.position;
    let prompt = '';

    // nearest unopened crate
    let nearCrate = null, nd = Infinity;
    for (const c of this.crates) {
      if (c.opened) continue;
      const d = pos.distanceTo(c.position);
      if (d < c.interactRange && d < nd) { nd = d; nearCrate = c; }
    }
    if (nearCrate) {
      prompt = '[E] Open crate';
      if (this.input.pressed('e')) {
        const drops = nearCrate.open();
        for (const d of drops) {
          this.run.loot[d.item] = (this.run.loot[d.item] || 0) + d.qty;
          if (d.item === 'Ammo') {   // looted ammo refills your run pool
            this.player.ammo = Math.min(CONFIG.player.ammoMax, this.player.ammo + d.qty);
            this.hud.setAmmo(this.player.ammo);
          }
        }
        this.hud.setLoot(this.run.loot);
        this.hud.banner('Looted: ' + drops.map((d) => `${d.item} x${d.qty}`).join(', '), 1600);
        if (this.online) this.net.send({ t: 'crate_open', index: this.crates.indexOf(nearCrate) });
      }
    }

    // core pickup (online: request from server; carry is granted via 'core_state')
    if (this.core.spawned && !this.core.carrier && !this.player.carryingCore) {
      const d = pos.distanceTo(this.core.position);
      if (d < this.core.interactRange) {
        prompt = '[E] Take unstable core';
        if (this.input.pressed('e')) {
          if (this.online) {
            this.net.send({ t: 'core_pickup' });
            this.hud.banner('Reaching for the core…', 1200);
          } else {
            this.core.pickUp(this.player);
            this.carryOrb.visible = true;
            this.hud.setCore('carrying');
            this.hud.banner('CORE SECURED — extract before they find you', 2600);
            this.hud.setObjective('Extract with the core (south road)');
          }
        }
      }
    }

    // extraction
    let inZone = false;
    for (const ez of this.extracts) {
      if (ez.contains(pos)) { inZone = true; break; }
    }
    if (inZone) {
      this.extractHold += dt;
      const remain = Math.max(0, CONFIG.player.extractHoldSec - this.extractHold);
      prompt = `Extracting… ${remain.toFixed(1)}s  (stay in zone)`;
      if (this.extractHold >= CONFIG.player.extractHoldSec) return this._extract();
    } else {
      this.extractHold = 0;
    }

    this.hud.prompt(prompt);
  }

  _updateCoreCarry(dt) {
    if (!this.player.carryingCore) { this.pingRing.visible = false; return; }
    // pulse the carry orb
    this.carryOrb.material.emissiveIntensity = 2.0 + Math.sin(this.t * 6) * 0.8;

    // periodic position reveal ping
    this.pingTimer -= dt;
    if (this.pingTimer <= 0) {
      this.pingTimer = CONFIG.player.pingIntervalSec;
      this.pingFx = 1.0;
      this.pingRing.position.copy(this.player.position); this.pingRing.position.y = 0.05;
      this.pingRing.visible = true;
      this.hud.banner('◈ Your position was pinged', 1400);
    }
    if (this.pingFx > 0) {
      this.pingFx -= dt;
      const s = 1 + (1 - this.pingFx) * 8;
      this.pingRing.scale.setScalar(s);
      this.pingRing.material.opacity = Math.max(0, this.pingFx);
      if (this.pingFx <= 0) this.pingRing.visible = false;
    }
  }

  _updateObjectiveIndicators(dt) {
    if (!this.player || !this.coreIndicator) return;
    const coreAvailable = this.core.spawned && !this.core.carrier && this.core.mesh.visible;
    this.coreIndicator.setVisible(coreAvailable);
    if (coreAvailable) {
      this.coreIndicator.update(dt, this.core.position, this.player.position, 'SECURE OBJECTIVE');
    }

    for (let i = 0; i < this.extracts.length; i++) {
      const marker = this.extractIndicators[i];
      const zone = this.extracts[i];
      marker.setVisible(true);
      marker.update(
        dt,
        zone.position,
        this.player.position,
        this.player.carryingCore ? 'DELIVER CORE' : 'EVAC ZONE',
      );
    }
  }

  _onPlayerDeath() {
    this.hud.banner('YOU WENT DOWN', 2400);
    if (this.player.carryingCore) {
      this.run.coreLost = true;
      this.core.drop(this.player.position);
      this.carryOrb.visible = false;
      this.hud.setCore('dropped');
      if (this.online) this.net.send({ t: 'core_drop', x: this.player.position.x, z: this.player.position.z });
    }
    setTimeout(() => { if (this.state === 'playing') this._endRun(false, 'Down in the yard'); }, 1400);
  }

  _extract() {
    const carried = this.player.carryingCore;
    if (carried) {
      this.run.coreExtracted = true; this.player.carryingCore = false; this.carryOrb.visible = false;
      if (this.online) this.net.send({ t: 'core_extracted' });
    }
    this._endRun(true, carried ? 'Extracted with the core' : 'Extracted clean');
  }

  _endRun(extracted, summary) {
    if (this.state !== 'playing') return;
    this.state = 'results';
    this.input.releaseLock?.();

    let xp = 0;
    const loot = [];
    if (extracted) {
      xp += CONFIG.rewards.extractXP;
      for (const [item, qty] of Object.entries(this.run.loot)) loot.push({ item, qty });
      if (this.run.coreExtracted) { xp += CONFIG.rewards.coreBonusXP; loot.push({ item: 'Core', qty: 1 }); }
    }
    xp += this.run.machines * CONFIG.rewards.perMachineXP;

    const results = {
      extracted, summary,
      loot,
      machines: this.run.machines,
      players: this.run.players,
      coreExtracted: this.run.coreExtracted,
      coreLost: this.run.coreLost,
      xp,
    };
    const stash = Stash.applyRun(results);
    // Mirror the run to the cloud when signed in (authoritative server-side apply).
    // Fire-and-forget: local stash already updated; failures must not block results.
    if (Account.isLoggedIn()) Account.applyRun(results).catch((e) => console.warn('[cloud] applyRun failed', e));
    if (this.online) this.net.disconnect?.();
    showResults(this.uiRoot, results, stash, {
      onReplay: () => this.start(this.cosmetics, this.online, this.playerName),
      onMenu: this.onExitToMenu,
    });
  }

  _resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setSize(w, h, false);
    this.rig.resize(w, h);
    this.fx?.setSize(w, h);
  }
}
