// Deadwire asset registry — the master catalog.
// Pure metadata only (NO three import) so Node QA tooling can read it directly.
// Every coded asset in the game is listed here with its builder module, slot,
// budgets, and tags. Studio + game + QA all key off this list.

export const ASSET_PROJECT = 'deadwire';
export const STYLE_PACK = 'reactor-wasteland-v0';

export const ASSETS = [
  // --- characters ---
  {
    id: 'char_runner', displayName: 'Runner', category: 'character',
    pipeline: 'coded', module: 'asset-lib/builders/char_runner.js',
    budgets: { maxTriangles: 2200, maxMaterials: 16 },
    riggable: true, rigType: 'humanoid',
    tags: ['player', 'humanoid', 'rig-tpose', 'sockets', 'riggable'],
    status: 'active',
  },
  // --- enemies ---
  {
    id: 'enemy_crawler', displayName: 'Crawler', category: 'enemy',
    pipeline: 'coded', module: 'asset-lib/builders/enemy_crawler.js',
    budgets: { maxTriangles: 900, maxMaterials: 6 },
    riggable: true, rigType: 'creature',
    tags: ['machine', 'rusher', 'pve', 'riggable'],
    status: 'active',
  },
  // --- enemies (ranged + tank) ---
  {
    id: 'enemy_turret', displayName: 'Turret', category: 'enemy',
    pipeline: 'coded', module: 'asset-lib/builders/enemy_turret.js',
    budgets: { maxTriangles: 800, maxMaterials: 5 },
    riggable: true, rigType: 'mechanical',
    tags: ['machine', 'ranged', 'pve', 'stationary', 'riggable'],
    status: 'active',
  },
  {
    id: 'enemy_hauler', displayName: 'Hauler', category: 'enemy',
    pipeline: 'coded', module: 'asset-lib/builders/enemy_hauler.js',
    budgets: { maxTriangles: 1400, maxMaterials: 7 },
    riggable: true, rigType: 'heavy-humanoid',
    tags: ['machine', 'tank', 'pve', 'guard', 'riggable'],
    status: 'active',
  },
  // --- weapons ---
  {
    id: 'weapon_scrap_pistol', displayName: 'Scrap Pistol', category: 'weapon', slot: 'weapon',
    pipeline: 'coded', module: 'asset-lib/builders/weapon_scrap_pistol.js',
    budgets: { maxTriangles: 300, maxMaterials: 4 },
    tags: ['sidearm', 'projectile'],
    status: 'active',
  },
  {
    id: 'weapon_burst_rifle', displayName: 'Burst Rifle', category: 'weapon', slot: 'weapon',
    pipeline: 'coded', module: 'asset-lib/builders/weapon_burst_rifle.js',
    budgets: { maxTriangles: 260, maxMaterials: 4 },
    tags: ['rifle', 'burst', 'projectile'],
    status: 'active',
  },
  {
    id: 'weapon_arc_shotgun', displayName: 'Arc Shotgun', category: 'weapon', slot: 'weapon',
    pipeline: 'coded', module: 'asset-lib/builders/weapon_arc_shotgun.js',
    budgets: { maxTriangles: 260, maxMaterials: 4 },
    tags: ['shotgun', 'spread', 'projectile'],
    status: 'active',
  },
  // --- objective / props ---
  {
    id: 'obj_unstable_core', displayName: 'Reactor Core', category: 'objective',
    pipeline: 'coded', module: 'asset-lib/builders/obj_unstable_core.js',
    budgets: { maxTriangles: 1100, maxMaterials: 6 }, rarity: 'apex',
    tags: ['objective', 'carry', 'glow', 'reactor', 'apex'],
    status: 'active',
  },
  {
    id: 'prop_loot_crate', displayName: 'Loot Crate', category: 'prop',
    pipeline: 'coded', module: 'asset-lib/builders/prop_loot_crate.js',
    budgets: { maxTriangles: 300, maxMaterials: 4 },
    tags: ['loot', 'interactable'],
    status: 'active',
  },
  // --- world kit (Breaker Yard) ---
  { id: 'reactor_tower', displayName: 'Reactor Tower', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 800, maxMaterials: 4 }, tags: ['landmark', 'blocker', 'glow'], status: 'active' },
  { id: 'generator', displayName: 'Generator', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 400, maxMaterials: 5 }, tags: ['blocker'], status: 'active' },
  { id: 'vent', displayName: 'Vent Fan', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 400, maxMaterials: 3 }, tags: ['blocker', 'animated'], status: 'active' },
  { id: 'terminal', displayName: 'Terminal', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 300, maxMaterials: 3 }, tags: ['blocker', 'glow'], status: 'active' },
  { id: 'scrap_wall', displayName: 'Scrap Wall', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 500, maxMaterials: 3 }, tags: ['blocker', 'cover'], status: 'active' },
  { id: 'warning_light', displayName: 'Warning Light', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 200, maxMaterials: 3 }, tags: ['glow', 'fx'], status: 'active' },
  { id: 'rail_track', displayName: 'Rail Track', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 600, maxMaterials: 3 }, tags: ['ground'], status: 'active' },
  { id: 'cover_block', displayName: 'Cover Block', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 200, maxMaterials: 3 }, tags: ['blocker', 'cover'], status: 'active' },
  { id: 'container', displayName: 'Cargo Container', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 400, maxMaterials: 3 }, tags: ['blocker', 'landmark'], status: 'active' },
  { id: 'cooling_tower', displayName: 'Cooling Tower', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 900, maxMaterials: 4 }, tags: ['landmark', 'blocker', 'glow'], status: 'active' },
  { id: 'silo', displayName: 'Silo', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 600, maxMaterials: 4 }, tags: ['landmark', 'blocker'], status: 'active' },
  { id: 'fuel_tank', displayName: 'Fuel Tank', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 600, maxMaterials: 4 }, tags: ['blocker', 'industrial'], status: 'active' },
  { id: 'pipe_run', displayName: 'Pipe Run', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 600, maxMaterials: 3 }, tags: ['blocker', 'cover'], status: 'active' },
  { id: 'barrier', displayName: 'Barrier', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 200, maxMaterials: 3 }, tags: ['blocker', 'cover'], status: 'active' },
  { id: 'server_rack', displayName: 'Server Rack', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 300, maxMaterials: 4 }, tags: ['blocker', 'glow', 'datacenter'], status: 'active' },
  { id: 'shanty', displayName: 'Shanty', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 400, maxMaterials: 5 }, tags: ['blocker', 'settlement'], status: 'active' },
  { id: 'market_stall', displayName: 'Market Stall', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 300, maxMaterials: 5 }, tags: ['blocker', 'settlement', 'glow'], status: 'active' },
  { id: 'light_tower', displayName: 'Light Tower', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 200, maxMaterials: 3 }, tags: ['glow', 'fx', 'landmark'], status: 'active' },
  { id: 'rough_grass_patch', displayName: 'Rough Grass Patch', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 240, maxMaterials: 2 }, tags: ['vegetation', 'ground', 'apocalypse'], status: 'active' },
  { id: 'dead_shrub', displayName: 'Dead Shrub', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 220, maxMaterials: 2 }, tags: ['vegetation', 'cover', 'apocalypse'], status: 'active' },
  { id: 'evergreen_tree', displayName: 'Evergreen Tree', category: 'world', pipeline: 'coded', module: 'asset-lib/builders/world_kit.js', budgets: { maxTriangles: 260, maxMaterials: 3 }, tags: ['vegetation', 'landmark', 'blocker'], status: 'active' },
  // --- cosmetics ---
  {
    id: 'helmet_breaker', displayName: 'Breaker Helmet', category: 'cosmetic', slot: 'head',
    pipeline: 'coded', module: 'asset-lib/cosmetics/helmet_breaker.js',
    budgets: { maxTriangles: 200, maxMaterials: 4 }, rarity: 'uncommon', tier: 'starter',
    tags: ['cosmetic', 'universal', 'starter'], status: 'active',
  },
  {
    id: 'backpack_runner', displayName: 'Runner Pack', category: 'cosmetic', slot: 'backpack',
    pipeline: 'coded', module: 'asset-lib/cosmetics/backpack_runner.js',
    budgets: { maxTriangles: 200, maxMaterials: 4 }, rarity: 'common', tier: 'starter',
    tags: ['cosmetic', 'universal', 'starter'], status: 'active',
  },
  {
    id: 'face_dust_mask', displayName: 'Dust Mask', category: 'cosmetic', slot: 'face',
    pipeline: 'coded', module: 'asset-lib/cosmetics/face_dust_mask.js',
    budgets: { maxTriangles: 160, maxMaterials: 4 }, rarity: 'common', tier: 'starter',
    tags: ['cosmetic', 'universal', 'starter'], status: 'active',
  },
  {
    id: 'hip_signal_flare', displayName: 'Signal Flare', category: 'cosmetic', slot: 'hip',
    pipeline: 'coded', module: 'asset-lib/cosmetics/hip_signal_flare.js',
    budgets: { maxTriangles: 160, maxMaterials: 4 }, rarity: 'common', tier: 'starter',
    tags: ['cosmetic', 'universal', 'starter'], status: 'active',
  },
  {
    id: 'aura_corewake', displayName: 'Core Wake', category: 'cosmetic', slot: 'aura',
    pipeline: 'coded', module: 'asset-lib/cosmetics/aura_corewake.js',
    budgets: { maxTriangles: 420, maxMaterials: 4 }, rarity: 'rare', tier: 'advanced',
    unlock: { level: 3, item: 'Core Shard', qty: 1 },
    tags: ['cosmetic', 'universal', 'advanced', 'glow'], status: 'active',
  },
];

export const CATEGORIES = ['character', 'enemy', 'weapon', 'objective', 'prop', 'world', 'cosmetic'];

export function getAsset(id) {
  return ASSETS.find((a) => a.id === id) || null;
}

export function byCategory(category) {
  return ASSETS.filter((a) => a.category === category);
}
