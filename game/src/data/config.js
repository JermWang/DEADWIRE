// Deadwire — Core Run tunables. One place to balance the prototype.
export const CONFIG = {
  match: {
    durationSec: 480,        // 8 minute match
    coreSpawnSec: 20,        // core appears (blueprint: ~min 3; short for testing)
    coreDetonateSec: 0,      // 0 = core stays until match end / extracted
    loadoutAmmo: 180,        // ammo you deploy with (later: drawn from your base stash)
  },
  player: {
    moveSpeed: 5.0,          // units/sec
    runSpeed: 7.2,
    jumpVelocity: 6.3,
    gravity: 18,
    rollSpeed: 10.5,
    rollDuration: 0.58,
    rollCooldown: 1.0,
    coreSlowFactor: 0.75,    // 25% slower while carrying the core
    maxHealth: 100,
    radius: 0.34,
    pingIntervalSec: 15,     // core carrier reveal pulse
    interactRange: 1.8,
    extractHoldSec: 3.0,     // seconds standing in extract zone to leave
    ammoMax: 320,            // most ammo you can carry in a run
  },
  // three weapons; player swaps with 1/2/3. `id` maps to an asset builder.
  // ammoCost = ammo spent per volley (so the shotgun's wide blast costs more).
  weapons: {
    scrap_pistol: {
      id: 'weapon_scrap_pistol', name: 'SCRAP PISTOL',
      projectileSpeed: 24, projectileLife: 1.1, damage: 18, fireRate: 2.8,
      pellets: 1, spread: 0.0, burst: 1, burstDelay: 0, ammoCost: 1,
    },
    burst_rifle: {
      id: 'weapon_burst_rifle', name: 'BURST RIFLE',
      projectileSpeed: 34, projectileLife: 1.0, damage: 14, fireRate: 1.6,
      pellets: 1, spread: 0.03, burst: 3, burstDelay: 0.07, ammoCost: 1,
    },
    arc_shotgun: {
      id: 'weapon_arc_shotgun', name: 'ARC SHOTGUN',
      projectileSpeed: 20, projectileLife: 0.45, damage: 9, fireRate: 1.1,
      pellets: 6, spread: 0.32, burst: 1, burstDelay: 0, ammoCost: 3,
    },
  },
  loadout: ['scrap_pistol', 'burst_rifle', 'arc_shotgun'],
  enemy: {
    crawler: {
      kind: 'rusher', health: 40, speed: 3.0, damage: 10,
      attackRange: 1.1, attackCooldown: 0.9, aggroRange: 14, contactRadius: 0.6,
    },
    turret: {
      kind: 'ranged', health: 55, speed: 0, damage: 8,
      attackRange: 18, attackCooldown: 1.3, aggroRange: 18, contactRadius: 0.7,
      projectileSpeed: 16, projectileLife: 1.6,
    },
    hauler: {
      kind: 'tank', health: 160, speed: 1.6, damage: 26,
      attackRange: 1.8, attackCooldown: 1.5, aggroRange: 12, contactRadius: 1.0,
    },
  },
  loot: {
    // weighted roll table for a crate — the resource pyramid (common -> precious)
    table: [
      { item: 'Scrap', min: 10, max: 25, weight: 6 },     // common · building supplies
      { item: 'Ammo', min: 12, max: 30, weight: 5 },      // precious · refills your run pool
      { item: 'Components', min: 1, max: 4, weight: 4 },   // mid · base + gear upgrades
      { item: 'Parts', min: 1, max: 3, weight: 3 },        // mid · weapon parts
      { item: 'Med', min: 1, max: 2, weight: 3 },          // healing supplies
      { item: 'Gold', min: 2, max: 8, weight: 2 },         // precious · hard currency
      { item: 'Core Shard', min: 1, max: 1, weight: 1 },   // rare · objective currency
    ],
  },
  rewards: {
    extractXP: 120,
    coreBonusXP: 250,
    perMachineXP: 15,
    corePayout: [{ item: 'Core', min: 1, max: 1 }],
  },
  camera: {
    // orthographic isometric framing
    height: 14,
    distance: 12,
    viewSize: 11,           // half-height of ortho frustum in world units
  },
};
