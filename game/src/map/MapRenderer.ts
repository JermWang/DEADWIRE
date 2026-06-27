import * as THREE from 'three';
import { DebugMapOverlay } from './DebugMapOverlay.js';
import { validateMapDefinition } from './MapSchema.js';
import type {
  CoverZoneDefinition,
  DistrictMapDefinition,
  LootZoneDefinition,
  POIDefinition,
  TraversalLinkDefinition,
  Vec3,
  VerticalConnectorDefinition,
} from './MapSchema.js';

export type MapRendererOptions = {
  debug?: boolean;
  floorThickness?: number;
  receiveShadow?: boolean;
  castShadow?: boolean;
  renderCoverPlaceholders?: boolean;
  renderLootPlaceholders?: boolean;
  /**
   * Optional GLTF/catalog adapter. Return an Object3D to replace the building
   * shell while semantic floors, connectors, loot, and cover remain intact.
   */
  assetFactory?: (poi: POIDefinition) => THREE.Object3D | null;
};

const COLORS = {
  apartment_block: 0x8fa0ad,
  warehouse: 0x7a8790,
  market: 0xd88446,
  parking_garage: 0x6f7f86,
  rooftop_perch: 0x4c5965,
  underground_tunnel: 0x253049,
  loot_shack: 0x9a7f55,
  locked_loot_room: 0x5a344f,
  alley: 0x3e4950,
  plaza: 0x79826f,
};

export class MapRenderer {
  private options: {
    debug: boolean;
    floorThickness: number;
    receiveShadow: boolean;
    castShadow: boolean;
    renderCoverPlaceholders: boolean;
    renderLootPlaceholders: boolean;
    assetFactory?: MapRendererOptions['assetFactory'];
  };
  private materials = new Map<string, THREE.Material>();

  constructor(options: MapRendererOptions = {}) {
    this.options = {
      debug: false,
      floorThickness: 0.18,
      receiveShadow: true,
      castShadow: true,
      renderCoverPlaceholders: true,
      renderLootPlaceholders: true,
      ...options,
    };
  }

  render(map: DistrictMapDefinition): THREE.Group {
    const errors = validateMapDefinition(map);
    if (errors.length) throw new Error(`Invalid map "${map.id}":\n${errors.join('\n')}`);

    const root = new THREE.Group();
    root.name = map.id;
    root.userData.mapDefinition = map;

    root.add(this.createGround(map));

    for (const poi of map.pois) {
      root.add(this.createPOI(poi));
    }

    for (const link of map.traversalLinks) {
      root.add(this.createTraversalLink(link));
    }

    this.setDebug(root, map, this.options.debug);

    return root;
  }

  setDebug(root: THREE.Group, map: DistrictMapDefinition, enabled: boolean): void {
    const existing = root.getObjectByName(`${map.id}_debug_overlay`);
    if (existing) root.remove(existing);
    if (enabled) root.add(new DebugMapOverlay().render(map));
    root.userData.debugEnabled = enabled;
  }

  private createGround(map: DistrictMapDefinition): THREE.Mesh {
    const width = map.bounds.max.x - map.bounds.min.x;
    const depth = map.bounds.max.z - map.bounds.min.z;
    const ground = new THREE.Mesh(
      new THREE.BoxGeometry(width, 0.08, depth),
      this.material('ground', 0x303936),
    );
    ground.position.set(
      (map.bounds.min.x + map.bounds.max.x) / 2,
      -0.06,
      (map.bounds.min.z + map.bounds.max.z) / 2,
    );
    ground.receiveShadow = true;
    return ground;
  }

  private createPOI(poi: POIDefinition): THREE.Group {
    const group = new THREE.Group();
    group.name = poi.id;
    group.position.copy(new THREE.Vector3(poi.position.x, poi.position.y, poi.position.z));
    group.userData.poi = poi;

    const authoredAsset = this.options.assetFactory?.(poi);
    if (authoredAsset) group.add(authoredAsset);
    else if (!['alley', 'plaza', 'underground_tunnel'].includes(poi.category)) {
      group.add(this.createBuildingMass(poi));
    }

    for (const floor of poi.floors) {
      const platform = new THREE.Mesh(
        new THREE.BoxGeometry(floor.size.x, this.options.floorThickness, floor.size.z),
        this.material(floor.y < 0 ? 'floor_underground' : 'floor', floor.y < 0 ? 0x1b2331 : 0x465150),
      );
      platform.name = `${poi.id}_${floor.id}_floor`;
      platform.position.set(0, floor.y - poi.position.y, 0);
      platform.receiveShadow = this.options.receiveShadow;
      group.add(platform);
    }

    for (const entrance of poi.entrances) {
      const marker = new THREE.Mesh(
        new THREE.BoxGeometry(entrance.width, 0.16, 0.32),
        this.material(entrance.isLocked ? 'locked_entrance' : 'entrance', entrance.isLocked ? 0xe044b6 : 0x60ff9a),
      );
      marker.name = entrance.id;
      marker.position.set(
        entrance.position.x - poi.position.x,
        entrance.position.y - poi.position.y + 0.12,
        entrance.position.z - poi.position.z,
      );
      group.add(marker);
    }

    for (const connector of [...poi.stairs, ...poi.ramps, ...poi.ladders, ...poi.elevators]) {
      group.add(this.createVerticalConnector(connector, poi.position));
    }

    if (this.options.renderLootPlaceholders) {
      for (const loot of poi.lootZones) {
        group.add(this.createLootZone(loot, poi.position));
      }
    }

    if (this.options.renderCoverPlaceholders) {
      for (const cover of poi.coverZones) {
        group.add(this.createCoverZone(cover, poi.position));
      }
    }

    return group;
  }

  private createBuildingMass(poi: POIDefinition): THREE.Mesh {
    const color = COLORS[poi.category] ?? 0x89949b;
    const mass = new THREE.Mesh(
      new THREE.BoxGeometry(poi.size.x, poi.size.y, poi.size.z),
      this.material(`${poi.category}_mass`, color, 0.32),
    );
    mass.name = `${poi.id}_placeholder_mass`;
    mass.position.y = poi.size.y / 2;
    mass.castShadow = this.options.castShadow;
    mass.receiveShadow = this.options.receiveShadow;
    return mass;
  }

  private createVerticalConnector(connector: VerticalConnectorDefinition, origin: Vec3): THREE.Object3D {
    if (connector.type === 'stairs') return this.createStairs(connector, origin);
    if (connector.type === 'ramp') return this.createRamp(connector, origin);
    if (connector.type === 'ladder') return this.createLadder(connector, origin);
    return this.createElevator(connector, origin);
  }

  private createStairs(connector: VerticalConnectorDefinition, origin: Vec3): THREE.Group {
    const group = new THREE.Group();
    group.name = connector.id;
    const rise = connector.end.y - connector.start.y;
    const dx = connector.end.x - connector.start.x;
    const dz = connector.end.z - connector.start.z;
    const run = Math.max(0.1, Math.hypot(dx, dz));
    const steps = Math.max(5, Math.ceil(Math.abs(rise) / 0.5));
    const stepDepth = run / steps + 0.06;
    const yaw = Math.atan2(dx, dz);
    for (let i = 0; i < steps; i++) {
      const t = (i + 0.5) / steps;
      const pos = this.lerp(connector.start, connector.end, t);
      const stepHeight = Math.max(0.12, Math.abs(rise) * ((i + 1) / steps));
      const step = new THREE.Mesh(
        new THREE.BoxGeometry(connector.width ?? 1.4, stepHeight, stepDepth),
        this.material('stairs', 0xb7aa8d),
      );
      step.position.set(
        pos.x - origin.x,
        connector.start.y - origin.y + Math.sign(rise || 1) * stepHeight / 2,
        pos.z - origin.z,
      );
      step.rotation.y = yaw;
      step.castShadow = this.options.castShadow;
      step.receiveShadow = this.options.receiveShadow;
      group.add(step);
    }
    group.userData.traversal = connector;
    return group;
  }

  private createRamp(connector: VerticalConnectorDefinition, origin: Vec3): THREE.Mesh {
    const mid = this.lerp(connector.start, connector.end, 0.5);
    const dx = connector.end.x - connector.start.x;
    const dz = connector.end.z - connector.start.z;
    const length = Math.hypot(dx, dz);
    const ramp = new THREE.Mesh(
      new THREE.BoxGeometry(connector.width ?? 2, 0.18, length || 1),
      this.material('ramp', 0x9ba68f),
    );
    ramp.name = connector.id;
    ramp.position.set(mid.x - origin.x, mid.y - origin.y, mid.z - origin.z);
    ramp.rotation.x = -Math.atan2(connector.end.y - connector.start.y, length || 1);
    ramp.rotation.y = Math.atan2(dx, dz);
    ramp.castShadow = this.options.castShadow;
    ramp.receiveShadow = this.options.receiveShadow;
    ramp.userData.traversal = connector;
    return ramp;
  }

  private createLadder(connector: VerticalConnectorDefinition, origin: Vec3): THREE.Group {
    const group = new THREE.Group();
    group.name = connector.id;
    const height = Math.abs(connector.end.y - connector.start.y);
    const mid = this.lerp(connector.start, connector.end, 0.5);
    for (const x of [-0.18, 0.18]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.06, height, 0.06), this.material('ladder', 0xf6d26b));
      rail.position.set(mid.x - origin.x + x, mid.y - origin.y, mid.z - origin.z);
      group.add(rail);
    }
    for (let y = connector.start.y + 0.6; y < connector.end.y; y += 0.8) {
      const rung = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.05, 0.06), this.material('ladder', 0xf6d26b));
      rung.position.set(connector.start.x - origin.x, y - origin.y, connector.start.z - origin.z);
      group.add(rung);
    }
    group.userData.traversal = connector;
    return group;
  }

  private createElevator(connector: VerticalConnectorDefinition, origin: Vec3): THREE.Group {
    const group = new THREE.Group();
    group.name = connector.id;
    const height = Math.abs(connector.end.y - connector.start.y);
    const mid = this.lerp(connector.start, connector.end, 0.5);
    const shaft = new THREE.Mesh(
      new THREE.BoxGeometry(1.8, height, 1.8),
      this.material('elevator_shaft', 0x6bd6ff, 0.18),
    );
    shaft.position.set(mid.x - origin.x, mid.y - origin.y, mid.z - origin.z);
    group.add(shaft);
    group.userData.traversal = connector;
    return group;
  }

  private createLootZone(loot: LootZoneDefinition, origin: Vec3): THREE.Group {
    const group = new THREE.Group();
    group.name = loot.id;
    const color = loot.isLocked ? 0xff4fd8 : loot.lootTier === 'legendary' ? 0xffd557 : 0x50ffd6;
    const count = Math.max(1, loot.containerCount);
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / 3);
      const col = i % 3;
      const crate = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.55, 0.7), this.material(`loot_${loot.lootTier}`, color));
      crate.position.set(
        loot.position.x - origin.x - loot.size.x / 3 + col * 0.8,
        loot.position.y - origin.y + 0.28,
        loot.position.z - origin.z - loot.size.z / 4 + row * 0.8,
      );
      group.add(crate);
    }
    return group;
  }

  private createCoverZone(cover: CoverZoneDefinition, origin: Vec3): THREE.Mesh {
    const coverMesh = new THREE.Mesh(
      new THREE.BoxGeometry(cover.size.x, cover.height, cover.size.z),
      this.material(`cover_${cover.coverType}`, 0x6f7880),
    );
    coverMesh.name = cover.id;
    coverMesh.position.set(
      cover.position.x - origin.x,
      cover.position.y - origin.y + cover.height / 2,
      cover.position.z - origin.z,
    );
    return coverMesh;
  }

  private createTraversalLink(link: TraversalLinkDefinition): THREE.Object3D {
    if (link.type === 'ramp' || link.start.y !== link.end.y) {
      const ramp = this.createRamp({ ...link, type: 'ramp', width: this.linkWidth(link) }, { x: 0, y: 0, z: 0 });
      ramp.userData.traversal = link;
      return ramp;
    }

    const dx = link.end.x - link.start.x;
    const dz = link.end.z - link.start.z;
    const length = Math.max(0.25, Math.hypot(dx, dz));
    const mid = this.lerp(link.start, link.end, 0.5);
    const color = link.type === 'underground_tunnel'
      ? 0x293456
      : link.type === 'rooftop_bridge'
        ? 0xb89042
        : 0x52645b;
    const surface = new THREE.Mesh(
      new THREE.BoxGeometry(this.linkWidth(link), 0.18, length),
      this.material(`link_${link.type}`, color),
    );
    surface.name = link.id;
    surface.position.set(mid.x, mid.y - 0.09, mid.z);
    surface.rotation.y = Math.atan2(dx, dz);
    surface.castShadow = this.options.castShadow;
    surface.receiveShadow = this.options.receiveShadow;
    surface.userData.traversal = link;
    return surface;
  }

  private linkWidth(link: TraversalLinkDefinition): number {
    if (link.type === 'rooftop_bridge') return 2.2;
    if (link.type === 'underground_tunnel') return 3;
    if (link.type === 'alley_shortcut') return 2.4;
    return 2.8;
  }

  private material(name: string, color: number, opacity = 1): THREE.Material {
    const key = `${name}:${color}:${opacity}`;
    const existing = this.materials.get(key);
    if (existing) return existing;
    const mat = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.88,
      metalness: 0.05,
      flatShading: true,
      transparent: opacity < 1,
      opacity,
    });
    this.materials.set(key, mat);
    return mat;
  }

  private lerp(a: Vec3, b: Vec3, t: number): Vec3 {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  }
}
