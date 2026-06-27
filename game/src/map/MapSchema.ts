export type Vec3 = { x: number; y: number; z: number };
export type Size3 = { x: number; y: number; z: number };

export const FLOOR_HEIGHT = 5;

export const FLOOR_Y = {
  underground: -FLOOR_HEIGHT,
  ground: 0,
  second: FLOOR_HEIGHT,
  third: FLOOR_HEIGHT * 2,
  rooftop: FLOOR_HEIGHT * 3,
} as const;

export type POICategory =
  | 'apartment_block'
  | 'warehouse'
  | 'market'
  | 'parking_garage'
  | 'rooftop_perch'
  | 'underground_tunnel'
  | 'loot_shack'
  | 'locked_loot_room'
  | 'alley'
  | 'plaza';

export type DangerLevel = 1 | 2 | 3 | 4 | 5;
export type LootTier = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
export type CoverType =
  | 'low_wall'
  | 'crate_stack'
  | 'vehicle'
  | 'concrete_barrier'
  | 'interior_wall'
  | 'rooftop_ac_unit'
  | 'market_stall';

export type TraversalType =
  | 'stairs'
  | 'ramp'
  | 'ladder'
  | 'elevator'
  | 'rooftop_bridge'
  | 'alley_shortcut'
  | 'underground_tunnel';

export type VisibilityLevel = 'hidden' | 'limited' | 'open' | 'exposed';
export type LightingMood = 'daylit' | 'shadowed' | 'neon' | 'industrial' | 'underground' | 'high_contrast';

export type FloorId = string;

export interface FloorDefinition {
  id: FloorId;
  label: string;
  y: number;
  size: Size3;
  walkable: boolean;
  gameplayPurpose: string;
}

export interface EntranceDefinition {
  id: string;
  floor: FloorId;
  position: Vec3;
  width: number;
  direction: Vec3;
  isLocked?: boolean;
  requiredKeyId?: string;
  gameplayNotes?: string;
}

export interface VerticalConnectorDefinition {
  id: string;
  type: Extract<TraversalType, 'stairs' | 'ramp' | 'ladder' | 'elevator'>;
  fromFloor: FloorId;
  toFloor: FloorId;
  start: Vec3;
  end: Vec3;
  width?: number;
  riskLevel: DangerLevel;
  visibility: VisibilityLevel;
  gameplayNotes: string;
}

export interface LootZoneDefinition {
  id: string;
  position: Vec3;
  size: Size3;
  lootTier: LootTier;
  spawnChance: number;
  containerCount: number;
  isHidden: boolean;
  isLocked: boolean;
  requiredKeyId?: string;
  gameplayNotes: string;
}

export interface CoverZoneDefinition {
  id: string;
  position: Vec3;
  size: Size3;
  coverType: CoverType;
  height: number;
  direction: Vec3;
  gameplayPurpose: string;
}

export interface TraversalLinkDefinition {
  id: string;
  type: TraversalType;
  fromPOI: string;
  toPOI: string;
  fromFloor: FloorId;
  toFloor: FloorId;
  start: Vec3;
  end: Vec3;
  riskLevel: DangerLevel;
  visibility: VisibilityLevel;
  gameplayNotes: string;
}

export interface POIDefinition {
  id: string;
  name: string;
  category: POICategory;
  position: Vec3;
  size: Size3;
  dangerLevel: DangerLevel;
  gameplayPurpose: string;
  floors: FloorDefinition[];
  entrances: EntranceDefinition[];
  stairs: VerticalConnectorDefinition[];
  ramps: VerticalConnectorDefinition[];
  ladders: VerticalConnectorDefinition[];
  elevators: VerticalConnectorDefinition[];
  lootZones: LootZoneDefinition[];
  coverZones: CoverZoneDefinition[];
  traversalLinks: string[];
  lightingMood: LightingMood;
  notes: string;
  /** Optional future GLTF/catalog key. The placeholder renderer ignores it. */
  renderAssetId?: string;
  tags?: string[];
}

export interface DistrictMapDefinition {
  id: string;
  name: string;
  bounds: { min: Vec3; max: Vec3 };
  floorHeight: number;
  pois: POIDefinition[];
  traversalLinks: TraversalLinkDefinition[];
  notes: string;
}

/**
 * Runtime validation sits beside the compile-time schema so authored maps fail
 * loudly before incomplete traversal or loot data reaches the renderer.
 */
export function validateMapDefinition(map: DistrictMapDefinition): string[] {
  const errors: string[] = [];
  const poiIds = new Set<string>();
  const linkIds = new Set<string>();

  for (const link of map.traversalLinks) {
    if (linkIds.has(link.id)) errors.push(`Duplicate traversal link id: ${link.id}`);
    linkIds.add(link.id);
  }

  for (const poi of map.pois) {
    if (poiIds.has(poi.id)) errors.push(`Duplicate POI id: ${poi.id}`);
    poiIds.add(poi.id);
    if (!poi.floors.length) errors.push(`${poi.id} has no walkable floors`);

    const floorIds = new Set(poi.floors.map((floor) => floor.id));
    for (const floor of poi.floors) {
      if (floor.walkable && floor.y % map.floorHeight !== 0) {
        errors.push(`${poi.id}.${floor.id} height ${floor.y} is not aligned to ${map.floorHeight}m floors`);
      }
    }
    for (const entrance of poi.entrances) {
      if (!floorIds.has(entrance.floor)) errors.push(`${entrance.id} references missing floor ${entrance.floor}`);
      if (entrance.isLocked && !entrance.requiredKeyId) errors.push(`${entrance.id} is locked without requiredKeyId`);
    }
    for (const connector of [...poi.stairs, ...poi.ramps, ...poi.ladders, ...poi.elevators]) {
      if (!floorIds.has(connector.fromFloor)) errors.push(`${connector.id} references missing fromFloor ${connector.fromFloor}`);
      if (!floorIds.has(connector.toFloor)) errors.push(`${connector.id} references missing toFloor ${connector.toFloor}`);
    }
    for (const loot of poi.lootZones) {
      if (loot.spawnChance < 0 || loot.spawnChance > 1) errors.push(`${loot.id} spawnChance must be between 0 and 1`);
      if (loot.containerCount < 1) errors.push(`${loot.id} must contain at least one container`);
      if (loot.isLocked && !loot.requiredKeyId) errors.push(`${loot.id} is locked without requiredKeyId`);
    }
    for (const linkId of poi.traversalLinks) {
      if (!linkIds.has(linkId)) errors.push(`${poi.id} references missing traversal link ${linkId}`);
    }
  }

  for (const link of map.traversalLinks) {
    if (!poiIds.has(link.fromPOI)) errors.push(`${link.id} references missing fromPOI ${link.fromPOI}`);
    if (!poiIds.has(link.toPOI)) errors.push(`${link.id} references missing toPOI ${link.toPOI}`);
  }
  return errors;
}
