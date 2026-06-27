// Breaker Yard — Deadwire's flagship map (single canonical arena, instanced per server).
// ~90x90 multi-district wasteland: reactor core (center), warehouse (N), cooling
// works (NW), scrap maze (W), black-market settlement (SW), rail yard (E),
// flooded data center (SE), extraction road (S). Pure data — easy to iterate.

export const BREAKER_YARD = {
  id: 'breaker_yard',
  name: 'Breaker Yard',
  bounds: { min: [-45, -45], max: [45, 45] },
  spawnPoints: [
    [-30, 30], [30, 30], [-38, -2], [38, -2], [0, 36], [0, -38],
  ],
  coreSpawn: [0, 0],            // reactor core chamber (center)
  extractionZones: [
    { pos: [-16, -40], radius: 3.0 },   // south extraction road W
    { pos: [16, -40], radius: 3.0 },    // south extraction road E
  ],

  // district ground tinting (rendered as flat decals for visual identity)
  groundDecals: [
    { shape: 'circle', pos: [0, 0], r: 9, color: '#3a2420', opacity: 0.5 },     // reactor scorch
    { shape: 'circle', pos: [-32, 26], r: 13, color: '#2e3338', opacity: 0.45 }, // cooling works concrete
    { shape: 'circle', pos: [-29, -25], r: 12, color: '#3a2a1e', opacity: 0.5 }, // settlement dirt
    { shape: 'circle', pos: [29, -24], r: 13, color: '#143038', opacity: 0.7 },  // flooded data center (wet teal)
    { shape: 'rect', pos: [0, -38], size: [22, 16], color: '#26342c', opacity: 0.4 }, // extraction road
  ],

  enemyNests: [
    { pos: [3, 7], type: 'hauler', count: 1 },     // core guardian
    { pos: [-4, 9], type: 'crawler', count: 3 },   // reactor pit
    { pos: [0, 32], type: 'crawler', count: 2 },   // warehouse
    { pos: [-30, 26], type: 'turret', count: 2 },  // cooling works overwatch
    { pos: [33, 4], type: 'turret', count: 2 },    // rail yard crossfire
    { pos: [29, -24], type: 'turret', count: 1 },  // data center
    { pos: [-29, -24], type: 'crawler', count: 3 },// settlement
    { pos: [-34, -2], type: 'crawler', count: 2 }, // scrap maze
  ],

  lootCrates: [
    [-6, 8], [6, 8],                 // reactor core
    [-4, 34], [9, 33],               // warehouse
    [-30, 18], [-35, 27],            // cooling works
    [-32, 2], [-39, -5],             // scrap maze
    [-27, -22], [-33, -28],          // settlement
    [29, 3], [35, -11],              // rail yard
    [27, -24], [31, -24],            // data center
    [-10, -33], [10, -33],           // extraction road
  ],

  // static props: [id, x, z, rotationY?, opts?]
  props: [
    // ----- CENTER · Reactor Core -----
    ['reactor_tower', 0, 0, 0],
    ['cover_block', -5, 6, 0], ['cover_block', 5, 6, 0],
    ['cover_block', -6, -6, 0.6], ['cover_block', 6, -6, -0.6],
    ['barrier', -9, 0, 0, { length: 3 }], ['barrier', 9, 0, 0, { length: 3 }],
    ['terminal', 0, 10, 3.14],
    ['warning_light', -3, 9, 0], ['warning_light', 3, -9, 0], ['warning_light', 0, 0, 0],

    // ----- NORTH · Warehouse -----
    ['container', -9, 34, 0, { color: '#f2a93b' }], ['container', -2, 36, 0.15, { color: '#5b6770' }],
    ['container', 6, 33, 0, { color: '#8a4b2f' }], ['container', 13, 36, 1.57, { color: '#5b6770' }],
    ['generator', -4, 28, 0], ['generator', 9, 27, 1.2],
    ['silo', 17, 32, 0], ['scrap_wall', -13, 30, 1.57, { length: 7 }],
    ['warning_light', 0, 26, 0], ['light_tower', 16, 38, 0],

    // ----- NORTHWEST · Cooling Works -----
    ['cooling_tower', -33, 30, 0], ['cooling_tower', -40, 21, 0],
    ['silo', -26, 33, 0], ['fuel_tank', -35, 14, 0], ['fuel_tank', -30, 11, 1.57],
    ['pipe_run', -30, 21, 0, { length: 10 }], ['generator', -24, 24, 0],
    ['vent', -28, 16, 0], ['light_tower', -38, 31, 0],

    // ----- WEST · Scrap Maze -----
    ['scrap_wall', -30, 6, 0, { length: 8 }], ['scrap_wall', -39, 3, 1.57, { length: 8 }],
    ['scrap_wall', -28, -2, 0, { length: 6 }], ['scrap_wall', -34, -8, 0.3, { length: 7 }],
    ['scrap_wall', -41, -7, 1.57, { length: 6 }],
    ['cover_block', -24, 3, 0], ['cover_block', -26, -7, 1.0], ['light_tower', -42, 0, 0],

    // ----- SOUTHWEST · Black-Market Settlement -----
    ['shanty', -30, -24, 0.2, { color: '#7d756b' }], ['shanty', -23, -28, -0.3],
    ['shanty', -35, -30, 1.2, { color: '#8a4b2f' }],
    ['market_stall', -27, -20, 0, { color: '#d83b2a' }], ['market_stall', -33, -22, 0.5, { color: '#9b6dff' }],
    ['light_tower', -28, -27, 0], ['barrier', -21, -24, 1.57, { length: 3 }],
    ['warning_light', -30, -18, 0],

    // ----- EAST · Rail Yard -----
    ['rail_track', 32, 2, 0, { length: 44 }], ['rail_track', 36, 2, 0, { length: 44 }],
    ['terminal', 26, 9, -0.6], ['cover_block', 24, 4, 0.4], ['cover_block', 28, -9, 0],
    ['container', 30, 13, 0, { color: '#5b6770' }], ['container', 34, -15, 1.57, { color: '#8a4b2f' }],
    ['vent', 39, -4, 0], ['fuel_tank', 26, -1, 0], ['light_tower', 41, 7, 0],

    // ----- SOUTHEAST · Flooded Data Center -----
    ['server_rack', 26, -22, 0], ['server_rack', 28, -24, 0], ['server_rack', 30, -22, 0.1],
    ['server_rack', 26, -26, 0], ['server_rack', 31, -26, 0], ['server_rack', 24, -24, 1.57],
    ['terminal', 32, -20, 0.4], ['pipe_run', 29, -30, 1.57, { length: 8 }],
    ['light_tower', 35, -28, 0], ['warning_light', 24, -28, 0],

    // ----- SOUTH · Extraction Road -----
    ['barrier', -16, -31, 0, { length: 3 }], ['barrier', 16, -31, 0, { length: 3 }],
    ['barrier', -8, -35, 0, { length: 3 }], ['barrier', 8, -35, 0, { length: 3 }],
    ['warning_light', -14, -40, 0], ['warning_light', 14, -40, 0], ['warning_light', 0, -33, 0],
    ['pipe_run', -19, -36, 0, { length: 6 }], ['pipe_run', 19, -36, 0, { length: 6 }],
  ],
};
