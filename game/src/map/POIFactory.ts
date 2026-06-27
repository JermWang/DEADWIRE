import type {
  CoverType,
  CoverZoneDefinition,
  DangerLevel,
  EntranceDefinition,
  FloorDefinition,
  FloorId,
  LightingMood,
  POICategory,
  POIDefinition,
  Size3,
  Vec3,
  VerticalConnectorDefinition,
  VisibilityLevel,
} from './MapSchema.js';

export const vec3 = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
export const size3 = (x: number, y: number, z: number): Size3 => ({ x, y, z });

export function createFloor(
  id: FloorId,
  label: string,
  y: number,
  size: Size3,
  gameplayPurpose: string,
  walkable = true,
): FloorDefinition {
  return { id, label, y, size, gameplayPurpose, walkable };
}

export function createEntrance(params: {
  id: string;
  floor: FloorId;
  position: Vec3;
  width: number;
  direction: Vec3;
  isLocked?: boolean;
  requiredKeyId?: string;
  gameplayNotes?: string;
}): EntranceDefinition {
  return { ...params };
}

export function createVerticalConnector(params: {
  id: string;
  type: VerticalConnectorDefinition['type'];
  fromFloor: FloorId;
  toFloor: FloorId;
  start: Vec3;
  end: Vec3;
  width?: number;
  riskLevel: DangerLevel;
  visibility: VisibilityLevel;
  gameplayNotes: string;
}): VerticalConnectorDefinition {
  return { ...params };
}

export function createCoverZone(params: {
  id: string;
  position: Vec3;
  size: Size3;
  coverType: CoverType;
  height: number;
  direction: Vec3;
  gameplayPurpose: string;
}): CoverZoneDefinition {
  return { ...params };
}

export function createPOI(params: {
  id: string;
  name: string;
  category: POICategory;
  position: Vec3;
  size: Size3;
  dangerLevel: DangerLevel;
  gameplayPurpose: string;
  floors: FloorDefinition[];
  entrances?: EntranceDefinition[];
  stairs?: VerticalConnectorDefinition[];
  ramps?: VerticalConnectorDefinition[];
  ladders?: VerticalConnectorDefinition[];
  elevators?: VerticalConnectorDefinition[];
  lootZones?: POIDefinition['lootZones'];
  coverZones?: CoverZoneDefinition[];
  traversalLinks?: string[];
  lightingMood: LightingMood;
  notes: string;
  renderAssetId?: string;
  tags?: string[];
}): POIDefinition {
  return {
    entrances: [],
    stairs: [],
    ramps: [],
    ladders: [],
    elevators: [],
    lootZones: [],
    coverZones: [],
    traversalLinks: [],
    ...params,
  };
}
