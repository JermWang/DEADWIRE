// Browser-side build map: asset id -> build function.
// The studio and the game both import BUILDERS from here. One source of truth.
import { build as char_runner } from './char_runner.js?v=wii-voxel-toy-v3';
import { build as enemy_crawler } from './enemy_crawler.js?v=wii-voxel-toy-v3';
import { build as enemy_turret } from './enemy_turret.js?v=wii-voxel-toy-v3';
import { build as enemy_hauler } from './enemy_hauler.js?v=wii-voxel-toy-v3';
import { build as weapon_scrap_pistol } from './weapon_scrap_pistol.js?v=wii-voxel-toy-v3';
import { build as weapon_burst_rifle } from './weapon_burst_rifle.js?v=wii-voxel-toy-v3';
import { build as weapon_arc_shotgun } from './weapon_arc_shotgun.js?v=wii-voxel-toy-v3';
import { build as prop_loot_crate } from './prop_loot_crate.js?v=wii-voxel-toy-v3';
import { build as obj_unstable_core } from './obj_unstable_core.js?v=wii-voxel-toy-v3';
import { build as helmet_breaker } from '../cosmetics/helmet_breaker.js?v=wii-voxel-toy-v3';
import { build as backpack_runner } from '../cosmetics/backpack_runner.js?v=wii-voxel-toy-v3';
import { build as face_dust_mask } from '../cosmetics/face_dust_mask.js?v=wii-voxel-toy-v3';
import { build as hip_signal_flare } from '../cosmetics/hip_signal_flare.js?v=wii-voxel-toy-v3';
import { build as aura_corewake } from '../cosmetics/aura_corewake.js?v=wii-voxel-toy-v3';
import * as world from './world_kit.js?v=wii-voxel-toy-v3';

export const BUILDERS = {
  char_runner,
  enemy_crawler,
  enemy_turret,
  enemy_hauler,
  weapon_scrap_pistol,
  weapon_burst_rifle,
  weapon_arc_shotgun,
  prop_loot_crate,
  obj_unstable_core,
  helmet_breaker,
  backpack_runner,
  face_dust_mask,
  hip_signal_flare,
  aura_corewake,
  // world kit
  reactor_tower: world.reactor_tower,
  generator: world.generator,
  vent: world.vent,
  terminal: world.terminal,
  scrap_wall: world.scrap_wall,
  warning_light: world.warning_light,
  rail_track: world.rail_track,
  cover_block: world.cover_block,
  container: world.container,
  cooling_tower: world.cooling_tower,
  silo: world.silo,
  fuel_tank: world.fuel_tank,
  pipe_run: world.pipe_run,
  barrier: world.barrier,
  server_rack: world.server_rack,
  shanty: world.shanty,
  market_stall: world.market_stall,
  light_tower: world.light_tower,
  rough_grass_patch: world.rough_grass_patch,
  dead_shrub: world.dead_shrub,
  evergreen_tree: world.evergreen_tree,
};

// Build any registered asset by id.
export function buildAsset(id, opts) {
  const fn = BUILDERS[id];
  if (!fn) throw new Error(`Unknown asset id: ${id}`);
  return fn(opts);
}
