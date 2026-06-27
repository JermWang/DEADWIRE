import type {
  DistrictMapDefinition,
  POIDefinition,
  TraversalLinkDefinition,
  Vec3,
} from './MapSchema.js';

function translatedPoint(point: Vec3, oldPOI: POIDefinition, newPosition: Vec3): Vec3 {
  return {
    x: newPosition.x + (point.x - oldPOI.position.x),
    y: point.y,
    z: newPosition.z + (point.z - oldPOI.position.z),
  };
}

/**
 * Expands travel space between POIs while preserving each POI's authored
 * internal dimensions. A scale of sqrt(5) produces approximately five times
 * the playable ground area.
 */
export function expandMapLayout(
  source: DistrictMapDefinition,
  horizontalScale: number,
): DistrictMapDefinition {
  const center = {
    x: (source.bounds.min.x + source.bounds.max.x) / 2,
    z: (source.bounds.min.z + source.bounds.max.z) / 2,
  };

  const pois = source.pois.map((poi): POIDefinition => {
    const position: Vec3 = {
      x: center.x + (poi.position.x - center.x) * horizontalScale,
      y: poi.position.y,
      z: center.z + (poi.position.z - center.z) * horizontalScale,
    };
    const move = (point: Vec3) => translatedPoint(point, poi, position);
    const moveConnector = <T extends POIDefinition['stairs'][number]>(connector: T): T => ({
      ...connector,
      start: move(connector.start),
      end: move(connector.end),
    });

    return {
      ...poi,
      position,
      entrances: poi.entrances.map((entrance) => ({ ...entrance, position: move(entrance.position) })),
      stairs: poi.stairs.map(moveConnector),
      ramps: poi.ramps.map(moveConnector),
      ladders: poi.ladders.map(moveConnector),
      elevators: poi.elevators.map(moveConnector),
      lootZones: poi.lootZones.map((zone) => ({ ...zone, position: move(zone.position) })),
      coverZones: poi.coverZones.map((zone) => ({ ...zone, position: move(zone.position) })),
    };
  });

  const oldPOIs = new Map(source.pois.map((poi) => [poi.id, poi]));
  const newPOIs = new Map(pois.map((poi) => [poi.id, poi]));
  const traversalLinks = source.traversalLinks.map((link): TraversalLinkDefinition => {
    const oldFrom = oldPOIs.get(link.fromPOI);
    const oldTo = oldPOIs.get(link.toPOI);
    const newFrom = newPOIs.get(link.fromPOI);
    const newTo = newPOIs.get(link.toPOI);
    if (!oldFrom || !oldTo || !newFrom || !newTo) return { ...link };
    return {
      ...link,
      start: translatedPoint(link.start, oldFrom, newFrom.position),
      end: translatedPoint(link.end, oldTo, newTo.position),
    };
  });

  return {
    ...source,
    id: `${source.id}_expanded`,
    name: `${source.name} — Expanded`,
    bounds: {
      min: {
        x: center.x + (source.bounds.min.x - center.x) * horizontalScale,
        y: source.bounds.min.y,
        z: center.z + (source.bounds.min.z - center.z) * horizontalScale,
      },
      max: {
        x: center.x + (source.bounds.max.x - center.x) * horizontalScale,
        y: source.bounds.max.y,
        z: center.z + (source.bounds.max.z - center.z) * horizontalScale,
      },
    },
    pois,
    traversalLinks,
    notes: `${source.notes} POI spacing expanded ${horizontalScale.toFixed(2)}x for approximately ${(horizontalScale ** 2).toFixed(1)}x ground area.`,
  };
}
