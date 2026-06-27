export const vec3 = (x, y, z) => ({ x, y, z });
export const size3 = (x, y, z) => ({ x, y, z });
export function createFloor(id, label, y, size, gameplayPurpose, walkable = true) {
    return { id, label, y, size, gameplayPurpose, walkable };
}
export function createEntrance(params) {
    return { ...params };
}
export function createVerticalConnector(params) {
    return { ...params };
}
export function createCoverZone(params) {
    return { ...params };
}
export function createPOI(params) {
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
//# sourceMappingURL=POIFactory.js.map