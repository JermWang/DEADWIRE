// Game-side asset hub. Re-exports the shared asset-lib so the rest of the game
// never reaches across folders directly. Swap the path here if the pipeline moves.
export { BUILDERS, buildAsset } from '../../game-asset-pipeline/asset-lib/builders/index.js?v=wii-voxel-toy-v3';
export { ASSETS, getAsset, byCategory } from '../../game-asset-pipeline/asset-lib/registry.js?v=wii-voxel-toy-v3';
export { PALETTE, mat } from '../../game-asset-pipeline/asset-lib/palette.js?v=wii-voxel-toy-v3';
export { box, cyl, cylX, cylZ, sphere, group, socket } from '../../game-asset-pipeline/asset-lib/prim.js?v=wii-voxel-toy-v3';
export { mountWeaponToSocket } from '../../game-asset-pipeline/asset-lib/weaponMount.js?v=hand-mount-v2';
