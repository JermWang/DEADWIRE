export const FLOOR_HEIGHT = 5;
export const FLOOR_Y = {
    underground: -FLOOR_HEIGHT,
    ground: 0,
    second: FLOOR_HEIGHT,
    third: FLOOR_HEIGHT * 2,
    rooftop: FLOOR_HEIGHT * 3,
};
/**
 * Runtime validation sits beside the compile-time schema so authored maps fail
 * loudly before incomplete traversal or loot data reaches the renderer.
 */
export function validateMapDefinition(map) {
    const errors = [];
    const poiIds = new Set();
    const linkIds = new Set();
    for (const link of map.traversalLinks) {
        if (linkIds.has(link.id))
            errors.push(`Duplicate traversal link id: ${link.id}`);
        linkIds.add(link.id);
    }
    for (const poi of map.pois) {
        if (poiIds.has(poi.id))
            errors.push(`Duplicate POI id: ${poi.id}`);
        poiIds.add(poi.id);
        if (!poi.floors.length)
            errors.push(`${poi.id} has no walkable floors`);
        const floorIds = new Set(poi.floors.map((floor) => floor.id));
        for (const floor of poi.floors) {
            if (floor.walkable && floor.y % map.floorHeight !== 0) {
                errors.push(`${poi.id}.${floor.id} height ${floor.y} is not aligned to ${map.floorHeight}m floors`);
            }
        }
        for (const entrance of poi.entrances) {
            if (!floorIds.has(entrance.floor))
                errors.push(`${entrance.id} references missing floor ${entrance.floor}`);
            if (entrance.isLocked && !entrance.requiredKeyId)
                errors.push(`${entrance.id} is locked without requiredKeyId`);
        }
        for (const connector of [...poi.stairs, ...poi.ramps, ...poi.ladders, ...poi.elevators]) {
            if (!floorIds.has(connector.fromFloor))
                errors.push(`${connector.id} references missing fromFloor ${connector.fromFloor}`);
            if (!floorIds.has(connector.toFloor))
                errors.push(`${connector.id} references missing toFloor ${connector.toFloor}`);
        }
        for (const loot of poi.lootZones) {
            if (loot.spawnChance < 0 || loot.spawnChance > 1)
                errors.push(`${loot.id} spawnChance must be between 0 and 1`);
            if (loot.containerCount < 1)
                errors.push(`${loot.id} must contain at least one container`);
            if (loot.isLocked && !loot.requiredKeyId)
                errors.push(`${loot.id} is locked without requiredKeyId`);
        }
        for (const linkId of poi.traversalLinks) {
            if (!linkIds.has(linkId))
                errors.push(`${poi.id} references missing traversal link ${linkId}`);
        }
    }
    for (const link of map.traversalLinks) {
        if (!poiIds.has(link.fromPOI))
            errors.push(`${link.id} references missing fromPOI ${link.fromPOI}`);
        if (!poiIds.has(link.toPOI))
            errors.push(`${link.id} references missing toPOI ${link.toPOI}`);
    }
    return errors;
}
//# sourceMappingURL=MapSchema.js.map