import type {
  DangerLevel,
  FloorId,
  TraversalLinkDefinition,
  TraversalType,
  Vec3,
  VisibilityLevel,
} from './MapSchema.js';

export function createTraversalLink(params: {
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
}): TraversalLinkDefinition {
  return { ...params };
}

export const rooftopBridge = (params: Omit<Parameters<typeof createTraversalLink>[0], 'type'>) =>
  createTraversalLink({ ...params, type: 'rooftop_bridge' });

export const alleyShortcut = (params: Omit<Parameters<typeof createTraversalLink>[0], 'type'>) =>
  createTraversalLink({ ...params, type: 'alley_shortcut' });

export const undergroundTunnel = (params: Omit<Parameters<typeof createTraversalLink>[0], 'type'>) =>
  createTraversalLink({ ...params, type: 'underground_tunnel' });

export const rampLink = (params: Omit<Parameters<typeof createTraversalLink>[0], 'type'>) =>
  createTraversalLink({ ...params, type: 'ramp' });

export const ladderLink = (params: Omit<Parameters<typeof createTraversalLink>[0], 'type'>) =>
  createTraversalLink({ ...params, type: 'ladder' });
