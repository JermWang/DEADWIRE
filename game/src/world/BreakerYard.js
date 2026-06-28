// Live-game adapter for the semantic district map. It preserves the Game-facing
// contract (root, collision, spawns, update) while POIs, floors, loot, cover,
// and traversal are authored independently in DistrictMap01.
import * as THREE from 'three';
import { MapRenderer } from '../map/runtime/MapRenderer.js';
import { DistrictMap01 } from '../map/runtime/maps/DistrictMap01.js';
import { expandMapLayout } from '../map/runtime/MapTransforms.js';
import { BREAKER_YARD as GAMEPLAY } from './mapDef.js';
import { createDeadwirePOIAssets } from './DeadwireMapAssetFactory.js';
import { DistantBackdrop } from './DistantBackdrop.js';
import { VegetationField } from './VegetationField.js';
import { disposeObjectTree } from '../render/dispose.js';

const MAP_LINEAR_SCALE = Math.sqrt(5);

export class BreakerYard {
  constructor() {
    this.layoutScale = MAP_LINEAR_SCALE;
    this.mapDefinition = expandMapLayout(DistrictMap01, this.layoutScale);
    this.def = this._createGameplayDefinition();
    this.root = new THREE.Group();
    this.root.name = 'breaker_yard';
    this.blockers = [];
    this.animated = [];
    this._build();
  }

  _createGameplayDefinition() {
    const { min, max } = this.mapDefinition.bounds;
    const lootCrates = [];
    const goldTokenCandidates = [];
    const scalePoint = ([x, z]) => [x * this.layoutScale, z * this.layoutScale];

    for (const poi of this.mapDefinition.pois) {
      for (const zone of poi.lootZones) {
        const highValueZone = ['rare', 'epic', 'legendary'].includes(zone.lootTier) ||
          (zone.isHidden && poi.dangerLevel >= 4);
        if (highValueZone && !zone.isLocked) {
          goldTokenCandidates.push({
            x: zone.position.x,
            y: zone.position.y,
            z: zone.position.z,
            poi: poi.id,
            zone: zone.id,
          });
        }
        // Locked semantic loot remains visible but does not become a free
        // interactable crate until the key system is wired into gameplay.
        if (zone.isLocked) continue;
        const columns = Math.min(3, zone.containerCount);
        for (let i = 0; i < zone.containerCount; i++) {
          const col = i % columns;
          const row = Math.floor(i / columns);
          const x = zone.position.x +
            (col - (columns - 1) / 2) * Math.min(0.9, zone.size.x / columns);
          const z = zone.position.z +
            row * Math.min(0.9, zone.size.z / Math.max(1, Math.ceil(zone.containerCount / columns)));
          lootCrates.push([x, z, zone.position.y]);
        }
      }
    }

    // Gold is intentionally much closer to a one-per-run objective than normal
    // crate loot: rare, high-risk, and physically visible when it appears.
    const goldTokenSpawns = [];
    if (goldTokenCandidates.length && Math.random() < 0.12) {
      const pick = goldTokenCandidates[Math.floor(Math.random() * goldTokenCandidates.length)];
      goldTokenSpawns.push({
        pos: [pick.x, pick.y, pick.z],
        qty: 1,
        poi: pick.poi,
        zone: pick.zone,
      });
    }

    return {
      ...GAMEPLAY,
      id: this.mapDefinition.id,
      name: this.mapDefinition.name,
      bounds: { min: [min.x, min.z], max: [max.x, max.z] },
      spawnPoints: GAMEPLAY.spawnPoints.map(scalePoint),
      coreSpawn: scalePoint(GAMEPLAY.coreSpawn),
      extractionZones: GAMEPLAY.extractionZones.map((zone) => ({
        ...zone,
        pos: scalePoint(zone.pos),
      })),
      enemyNests: GAMEPLAY.enemyNests.map((nest) => ({
        ...nest,
        pos: scalePoint(nest.pos),
      })),
      lootCrates,
      goldTokenSpawns,
    };
  }

  _build() {
    const [minX, minZ] = this.def.bounds.min;
    const [maxX, maxZ] = this.def.bounds.max;
    const debug = typeof location !== 'undefined' &&
      new URLSearchParams(location.search).get('mapDebug') === '1';

    this.mapRenderer = new MapRenderer({
      debug,
      assetFactory: createDeadwirePOIAssets,
      renderCoverPlaceholders: false,
      renderLootPlaceholders: false,
    });
    this.semanticRoot = this.mapRenderer.render(this.mapDefinition);
    this.backdrop = new DistantBackdrop(this.mapDefinition.bounds);
    this.vegetation = new VegetationField(this.mapDefinition);
    this.root.add(this.backdrop.root);
    this.root.add(this.semanticRoot);
    this.root.add(this.vegetation.root);
    this.blockers.push(...this.vegetation.blockers);
    this.semanticRoot.traverse((object) => {
      if (object.userData.fan || object.userData.glow) this.animated.push(object);
    });
    this._perimeter(minX, minZ, maxX, maxZ);

    // Ground-level semantic cover participates in the existing lightweight
    // collision system. Upper-level cover is intentionally left to a future
    // height-aware physics adapter while still rendering at its authored floor.
    for (const poi of this.mapDefinition.pois) {
      for (const cover of poi.coverZones) {
        if (Math.abs(cover.position.y) > 0.25) continue;
        this.blockers.push({
          x: cover.position.x,
          z: cover.position.z,
          hx: cover.size.x / 2,
          hz: cover.size.z / 2,
        });
      }
    }
  }

  _perimeter(minX, minZ, maxX, maxZ) {
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x283238,
      roughness: 0.8,
      metalness: 0.25,
    });
    const h = 2.4;
    const t = 0.6;
    const segments = [
      [(minX + maxX) / 2, minZ, maxX - minX, t],
      [(minX + maxX) / 2, maxZ, maxX - minX, t],
      [minX, (minZ + maxZ) / 2, t, maxZ - minZ],
      [maxX, (minZ + maxZ) / 2, t, maxZ - minZ],
    ];
    for (const [x, z, sx, sz] of segments) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(sx, h, sz), wallMat);
      wall.position.set(x, h / 2, z);
      wall.castShadow = true;
      wall.receiveShadow = true;
      this.root.add(wall);
      this.blockers.push({ x, z, hx: sx / 2, hz: sz / 2 });
    }
  }

  /**
   * Resolve the semantic walkable surface under a player. Floors, stairs,
   * ramps, rooftop bridges, alleys, and tunnel slopes all feed this query.
   * Ladders and elevators remain explicit interaction markers.
   */
  groundHeightAt(pos, maxDelta = 1.35) {
    const currentY = Number.isFinite(pos.y) ? pos.y : 0;
    const airborne = maxDelta > 1.35;
    let connectorHeight = null;
    let connectorDistance = Infinity;

    const testConnector = (connector, width = connector.width || 1.6) => {
      const dx = connector.end.x - connector.start.x;
      const dz = connector.end.z - connector.start.z;
      const lengthSq = dx * dx + dz * dz;
      if (lengthSq < 0.01) return;
      const t = Math.max(0, Math.min(
        1,
        ((pos.x - connector.start.x) * dx + (pos.z - connector.start.z) * dz) / lengthSq,
      ));
      const x = connector.start.x + dx * t;
      const z = connector.start.z + dz * t;
      const distance = Math.hypot(pos.x - x, pos.z - z);
      const y = connector.start.y + (connector.end.y - connector.start.y) * t;
      if (distance <= width / 2 + 0.35 &&
          Math.abs(y - currentY) <= maxDelta &&
          (!airborne || y <= currentY + 0.3) &&
          distance < connectorDistance) {
        connectorHeight = y;
        connectorDistance = distance;
      }
    };

    for (const poi of this.mapDefinition.pois) {
      for (const connector of [...poi.stairs, ...poi.ramps]) testConnector(connector);
    }
    for (const link of this.mapDefinition.traversalLinks) {
      const width = link.type === 'underground_tunnel'
        ? 3
        : link.type === 'rooftop_bridge'
          ? 2.2
          : 2.4;
      testConnector(link, width);
    }
    if (connectorHeight != null) return connectorHeight;

    const floorHeights = [0];
    for (const poi of this.mapDefinition.pois) {
      for (const floor of poi.floors) {
        if (!floor.walkable) continue;
        const inside = Math.abs(pos.x - poi.position.x) <= floor.size.x / 2 &&
          Math.abs(pos.z - poi.position.z) <= floor.size.z / 2;
        if (inside &&
            Math.abs(floor.y - currentY) <= maxDelta &&
            (!airborne || floor.y <= currentY + 0.3)) {
          floorHeights.push(floor.y);
        }
      }
    }
    return floorHeights.reduce(
      (best, y) => Math.abs(y - currentY) < Math.abs(best - currentY) ? y : best,
      floorHeights[0],
    );
  }

  // Resolve a desired position against ground-level blockers.
  collide(pos, radius) {
    for (const blocker of this.blockers) {
      if (blocker.radius != null) {
        const dx = pos.x - blocker.x;
        const dz = pos.z - blocker.z;
        const minimum = blocker.radius + radius;
        const distanceSq = dx * dx + dz * dz;
        if (distanceSq < minimum * minimum && distanceSq > 1e-6) {
          const distance = Math.sqrt(distanceSq);
          pos.x = blocker.x + (dx / distance) * minimum;
          pos.z = blocker.z + (dz / distance) * minimum;
        }
      } else {
        const extentX = blocker.hx + radius;
        const extentZ = blocker.hz + radius;
        const dx = pos.x - blocker.x;
        const dz = pos.z - blocker.z;
        if (Math.abs(dx) < extentX && Math.abs(dz) < extentZ) {
          const overlapX = extentX - Math.abs(dx);
          const overlapZ = extentZ - Math.abs(dz);
          if (overlapX < overlapZ) pos.x = blocker.x + Math.sign(dx || 1) * extentX;
          else pos.z = blocker.z + Math.sign(dz || 1) * extentZ;
        }
      }
    }

    const [minX, minZ] = this.def.bounds.min;
    const [maxX, maxZ] = this.def.bounds.max;
    pos.x = Math.max(minX + 1 + radius, Math.min(maxX - 1 - radius, pos.x));
    pos.z = Math.max(minZ + 1 + radius, Math.min(maxZ - 1 - radius, pos.z));
    return pos;
  }

  toggleDebug() {
    const enabled = !this.semanticRoot.userData.debugEnabled;
    this.mapRenderer.setDebug(this.semanticRoot, this.mapDefinition, enabled);
    return enabled;
  }

  update(dt, time) {
    this.backdrop?.update(time);
    for (const object of this.animated) {
      if (object.userData.fan) object.userData.fan.rotation.y += dt * 6;
      if (object.userData.glow) {
        object.userData.glow.material.emissiveIntensity =
          1 + (Math.sin(time * 3 + object.position.x) > 0 ? 1.2 : 0);
      }
    }
  }

  dispose() {
    disposeObjectTree(this.root);
  }
}
