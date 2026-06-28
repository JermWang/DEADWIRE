// Converts semantic POIs into compositions of the authored coded Deadwire kit.
// The semantic layer still owns floors/traversal/gameplay; this adapter owns the
// visible world dressing and can later be replaced by a GLTF-backed equivalent.
import * as THREE from 'three';
import { buildAsset } from '../assets.js';

const COLORS = {
  blue: '#426b7b',
  rust: '#8a4b2f',
  amber: '#d59a38',
  green: '#456b59',
  violet: '#65527c',
  concrete: '#727d82',
};

function place(group, id, x, y, z, rotationY = 0, options, scale = 1) {
  const asset = buildAsset(id, options);
  asset.position.set(x, y, z);
  asset.rotation.y = rotationY;
  asset.scale.setScalar(scale);
  asset.userData.semanticMapAsset = true;
  group.add(asset);
  return asset;
}

function wallShell(group, poi, floorY, height = 4.2) {
  const hx = poi.size.x / 2;
  const hz = poi.size.z / 2;
  const frontLength = Math.max(2, poi.size.x * 0.3);
  const sideLength = Math.max(2, poi.size.z * 0.72);
  const optsFront = { length: frontLength, height };
  const optsBack = { length: Math.max(3, poi.size.x * 0.78), height };
  const optsSide = { length: sideLength, height };

  // Split the front facade around the primary entrance instead of sealing it
  // with an opaque placeholder box.
  place(group, 'scrap_wall', -hx * 0.55, floorY, -hz + 0.28, 0, optsFront);
  place(group, 'scrap_wall', hx * 0.55, floorY, -hz + 0.28, 0, optsFront);
  place(group, 'scrap_wall', 0, floorY, hz - 0.28, Math.PI, optsBack);
  place(group, 'scrap_wall', -hx + 0.28, floorY, 0, Math.PI / 2, optsSide);
  place(group, 'scrap_wall', hx - 0.28, floorY, 0, Math.PI / 2, optsSide);
}

function coverRotation(cover) {
  // Direction is the cover-facing normal; the long axis runs perpendicular.
  return Math.abs(cover.direction.x) > Math.abs(cover.direction.z) ? Math.PI / 2 : 0;
}

const detailMaterials = new Map();
function detailMaterial(name, color, { metal = 0.1, rough = 0.78, emissive, emissiveIntensity = 0 } = {}) {
  const key = `${name}:${color}:${metal}:${rough}:${emissive || ''}:${emissiveIntensity}`;
  if (!detailMaterials.has(key)) {
    const params = {
      color,
      metalness: metal,
      roughness: rough,
      emissiveIntensity,
      flatShading: true,
    };
    if (emissive) params.emissive = new THREE.Color(emissive);
    detailMaterials.set(key, new THREE.MeshStandardMaterial(params));
  }
  return detailMaterials.get(key);
}

function detailBox(group, name, x, y, z, sx, sy, sz, color, rotationY = 0, options) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    detailMaterial(name, color, options),
  );
  mesh.position.set(x, y, z);
  mesh.rotation.y = rotationY;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData.semanticMapAsset = true;
  group.add(mesh);
  return mesh;
}

function addApartmentDepth(group, poi) {
  for (const floor of poi.floors.filter((entry) => entry.id !== 'rooftop')) {
    const y = floor.y - poi.position.y;
    detailBox(group, 'apt_hall', 0, y + 1.05, -0.4, 0.22, 2.1, 8.4, 0x3f484d);
    for (const x of [-4.3, -1.6, 1.6, 4.3]) {
      detailBox(group, 'apt_door_frame', x, y + 1.05, -1.85, 0.12, 1.75, 0.18, 0x9a7c4d);
      detailBox(group, 'apt_room_glow', x, y + 1.28, -2.0, 0.75, 0.08, 0.08, 0x63d2ff, 0, {
        emissive: 0x63d2ff,
        emissiveIntensity: floor.id === 'third' ? 0.9 : 0.45,
      });
    }
    place(group, 'server_rack', -4.2, y + 0.12, 2.7, 0.1, undefined, 0.82);
    place(group, 'vent', 4.0, y + 0.12, -3.2, -0.2, undefined, 0.72);
    detailBox(group, 'apt_ceiling_pipe', 0, y + 3.55, 3.6, 8.4, 0.12, 0.12, 0x2d383d);
  }
}

function addWarehouseDepth(group, poi) {
  const groundY = -poi.position.y;
  const mezzY = 5 - poi.position.y;
  for (const x of [-5.8, 0, 5.8]) {
    detailBox(group, 'warehouse_beam', x, groundY + 4.35, 0, 0.22, 0.22, 12.2, 0x3a454a);
  }
  detailBox(group, 'warehouse_mezz_deck', -2.0, mezzY + 0.05, -2.7, 10.5, 0.18, 1.6, 0x4d595d);
  for (const x of [-6.6, -3.0, 0.5, 4.0]) {
    place(group, 'barrier', x, mezzY + 0.12, -1.7, 0, { length: 1.9 }, 0.68);
  }
  place(group, 'terminal', 4.8, groundY + 0.12, -3.4, -Math.PI / 2, undefined, 0.85);
  place(group, 'server_rack', 8.8, groundY + 0.12, -4.3, Math.PI, undefined, 0.9);
  detailBox(group, 'loading_stripe', 0, groundY + 0.03, -5.8, 15.5, 0.035, 0.18, 0xd59a38);
}

function addMarketDepth(group) {
  for (const [x, z, color] of [[-5.4, -1.8, 0x8a4b2f], [-0.8, 1.6, 0x426b7b], [4.8, -0.8, 0x65527c]]) {
    detailBox(group, 'market_canopy', x, 2.15, z, 4.2, 0.08, 2.6, color, 0.12);
    detailBox(group, 'market_counter', x, 0.62, z, 2.4, 0.32, 0.64, 0x3f352d, 0.12);
    detailBox(group, 'market_sign', x, 1.55, z - 1.38, 1.4, 0.42, 0.08, 0xd59a38, 0.12, {
      emissive: 0xd59a38,
      emissiveIntensity: 0.32,
    });
  }
  place(group, 'pipe_run', -0.4, 2.28, 0, Math.PI / 2, { length: 11 }, 0.72);
}

function addGarageDepth(group, poi) {
  for (const floor of poi.floors) {
    const y = floor.y - poi.position.y;
    for (const z of [-5.2, -1.7, 1.8, 5.3]) {
      detailBox(group, 'garage_parking_line', -1.8, y + 0.035, z, 0.08, 0.035, 2.4, 0xded4ba);
      detailBox(group, 'garage_parking_line', 1.8, y + 0.035, z, 0.08, 0.035, 2.4, 0xded4ba);
    }
    place(group, 'fuel_tank', -5.2, y + 0.08, 0.8, 0.35, undefined, 0.58);
    place(group, 'cover_block', 5.2, y + 0.08, -1.6, -0.2, undefined, 0.74);
    detailBox(group, 'garage_light_strip', 0, y + 2.75, 7.55, 10.5, 0.08, 0.08, 0x63d2ff, 0, {
      emissive: 0x63d2ff,
      emissiveIntensity: 0.42,
    });
  }
}

function addVaultDepth(group, poi) {
  const y = -poi.position.y;
  detailBox(group, 'vault_desk', 0, y + 0.52, -1.6, 3.2, 0.42, 0.9, 0x2d383d);
  detailBox(group, 'vault_inner_wall', 0, y + 1.25, 1.8, 5.8, 2.5, 0.26, 0x45343f);
  for (const x of [-2.3, 2.3]) {
    place(group, 'server_rack', x, y + 0.12, 2.9, Math.PI, undefined, 0.76);
    detailBox(group, 'vault_lock_glow', x, y + 1.35, -3.35, 0.42, 0.16, 0.08, 0xff4fd8, 0, {
      emissive: 0xff4fd8,
      emissiveIntensity: 1.0,
    });
  }
}

function addTunnelDepth(group, poi) {
  const y = -5 - poi.position.y;
  detailBox(group, 'tunnel_puddle', 0, y + 0.02, -0.4, 12.5, 0.035, 2.4, 0x143038, 0, {
    metal: 0.35,
    rough: 0.25,
  });
  for (const z of [-3.2, 0, 3.2]) {
    detailBox(group, 'tunnel_cable_bundle', -7.2, y + 1.85, z, 0.16, 0.16, 1.8, 0x20292e);
    detailBox(group, 'tunnel_cable_bundle', 7.2, y + 1.85, z, 0.16, 0.16, 1.8, 0x20292e);
  }
}

function addSmallPoiDepth(group, poi) {
  if (poi.category === 'loot_shack') {
    detailBox(group, 'shack_shelf', -2.2, 0.9, -1.3, 0.28, 1.4, 2.4, 0x3c3328);
    detailBox(group, 'shack_table', 1.2, 0.55, 0.4, 2.2, 0.36, 1.0, 0x4a3b2d);
    place(group, 'terminal', 1.2, 0.74, 0.4, Math.PI, undefined, 0.58);
  }
  if (poi.category === 'alley') {
    for (const z of [-5, -1.5, 2.5, 6]) {
      detailBox(group, 'alley_cross_cable', 0, 2.2, z, 4.2, 0.08, 0.08, 0x20292e);
    }
    place(group, 'vent', -1.15, 0.05, 4.8, Math.PI / 2, undefined, 0.72);
  }
  if (poi.category === 'rooftop_perch') {
    detailBox(group, 'perch_grate', 0, 0.08, -1.6, 6.2, 0.08, 2.1, 0x3f484d);
    detailBox(group, 'perch_scope_bench', -2.1, 0.48, 0.8, 1.7, 0.28, 0.65, 0x2d383d);
  }
  if (poi.category === 'plaza') {
    detailBox(group, 'plaza_planter', -1.8, 0.3, 2.7, 2.6, 0.6, 0.8, 0x456b59);
    detailBox(group, 'plaza_broken_sign', 7.8, 1.1, 1.0, 2.4, 0.38, 0.12, 0xd59a38, -0.25, {
      emissive: 0xd59a38,
      emissiveIntensity: 0.28,
    });
  }
}

function addInteriorDepth(group, poi) {
  switch (poi.category) {
    case 'apartment_block': addApartmentDepth(group, poi); break;
    case 'warehouse': addWarehouseDepth(group, poi); break;
    case 'market': addMarketDepth(group, poi); break;
    case 'parking_garage': addGarageDepth(group, poi); break;
    case 'locked_loot_room': addVaultDepth(group, poi); break;
    case 'underground_tunnel': addTunnelDepth(group, poi); break;
    default: addSmallPoiDepth(group, poi); break;
  }
}

function addCoverAsset(group, poi, cover) {
  const x = cover.position.x - poi.position.x;
  const y = cover.position.y - poi.position.y;
  const z = cover.position.z - poi.position.z;
  const rotation = coverRotation(cover);
  const length = Math.max(1.4, rotation ? cover.size.z : cover.size.x);

  switch (cover.coverType) {
    case 'market_stall':
      place(group, 'market_stall', x, y, z, rotation, {
        color: cover.id.includes('east') ? '#9b6dff' : '#d83b2a',
      });
      break;
    case 'rooftop_ac_unit':
      place(group, 'vent', x, y, z, rotation);
      break;
    case 'vehicle':
      place(group, 'fuel_tank', x, y, z, rotation);
      break;
    case 'interior_wall':
      place(group, 'scrap_wall', x, y, z, rotation, {
        length,
        height: cover.height,
      });
      break;
    case 'crate_stack':
      place(group, 'cover_block', x - 0.45, y, z, rotation);
      place(group, 'cover_block', x + 0.45, y, z + 0.12, rotation + 0.08);
      if (cover.height > 1.5) place(group, 'cover_block', x, y + 0.75, z, rotation - 0.05);
      break;
    case 'concrete_barrier':
    case 'low_wall':
    default:
      place(group, 'barrier', x, y, z, rotation, { length });
      break;
  }
}

function buildApartment(group, poi) {
  for (const floor of poi.floors.filter((entry) => entry.id !== 'rooftop')) {
    const y = floor.y - poi.position.y;
    wallShell(group, poi, y, 4.15);
    place(group, 'container', -2.5, y + 0.12, 1.8, 0, {
      color: floor.id === 'ground' ? COLORS.blue : COLORS.rust,
    });
    place(group, 'terminal', 2.7, y + 0.12, 2.6, Math.PI);
    place(group, 'warning_light', 0, y + 0.12, -poi.size.z / 2 + 0.8);
  }
  place(group, 'vent', -2.2, 15 - poi.position.y, 2.8);
  place(group, 'generator', 2.5, 15 - poi.position.y, 1.8, Math.PI / 2);
  place(group, 'light_tower', 0, 15 - poi.position.y, -2.5);
}

function buildWarehouse(group, poi) {
  wallShell(group, poi, -poi.position.y, 4.7);
  place(group, 'container', -7, 0, 2.6, 0, { color: COLORS.amber });
  place(group, 'container', 0, 0, 3.4, 0.08, { color: COLORS.blue });
  place(group, 'container', 7, 0, 2.2, Math.PI / 2, { color: COLORS.rust });
  place(group, 'generator', -5, 5 - poi.position.y, 0, Math.PI / 2);
  place(group, 'pipe_run', 4.5, 5 - poi.position.y, 1.4, Math.PI / 2, { length: 7 });
  place(group, 'light_tower', -10, 0, -5);
  place(group, 'light_tower', 10, 0, 5);
}

function buildMarket(group) {
  place(group, 'shanty', -7, 0, -4, 0.12, { color: COLORS.concrete });
  place(group, 'shanty', 7, 0, 4, Math.PI + 0.08, { color: COLORS.rust });
  place(group, 'market_stall', -1.8, 0, -4.2, 0, { color: '#e09a35' });
  place(group, 'market_stall', 2.1, 0, 4.1, Math.PI, { color: '#4b9b8b' });
  place(group, 'warning_light', 0, 0, 0);
  place(group, 'light_tower', 0, 0, -5);
}

function buildGarage(group, poi) {
  const levels = poi.floors.map((floor) => floor.y - poi.position.y);
  for (const y of levels) {
    for (const x of [-6, 0, 6]) {
      place(group, 'barrier', x, y, -8.2, 0, { length: 4.4 });
      place(group, 'barrier', x, y, 8.2, Math.PI, { length: 4.4 });
    }
    place(group, 'warning_light', -8, y, 0);
    place(group, 'warning_light', 8, y, 0);
  }
  place(group, 'container', -4.8, 5 - poi.position.y, 3.5, Math.PI / 2, { color: COLORS.blue });
  place(group, 'generator', 4.5, 10 - poi.position.y, -3.5, Math.PI);
  place(group, 'light_tower', -6, 15 - poi.position.y, 5.5);
  place(group, 'light_tower', 6, 15 - poi.position.y, -5.5);
}

function buildPerch(group, poi) {
  const y = 15 - poi.position.y;
  place(group, 'scrap_wall', 0, y, 3, 0, { length: 7.5, height: 1.5 });
  place(group, 'terminal', 0, y, 0.6, Math.PI);
  place(group, 'vent', -2.6, y, -1);
  place(group, 'light_tower', 2.8, y, 1.8);
  place(group, 'warning_light', -3.8, y, 0);
  place(group, 'warning_light', 3.8, y, 0);
}

function buildTunnel(group, poi) {
  const y = -5 - poi.position.y;
  place(group, 'pipe_run', -4, y, -2.7, Math.PI / 2, { length: 8 });
  place(group, 'pipe_run', 4, y, 2.7, Math.PI / 2, { length: 8 });
  place(group, 'server_rack', -2.5, y, 0.7, 0);
  place(group, 'server_rack', 2.5, y, -0.7, Math.PI);
  for (const x of [-7, 0, 7]) place(group, 'warning_light', x, y, 0);
}

function buildLootShack(group) {
  place(group, 'shanty', 0, 0, 0, 0, { color: COLORS.green }, 1.25);
  place(group, 'warning_light', 2.5, 0, -1.8);
  place(group, 'generator', -2.5, 0, 1.8, Math.PI / 2, undefined, 0.8);
}

function buildVault(group, poi) {
  wallShell(group, poi, -poi.position.y, 3.7);
  place(group, 'container', -1.8, 0, 0.8, Math.PI / 2, { color: COLORS.violet });
  place(group, 'container', 1.8, 0, 0.8, Math.PI / 2, { color: COLORS.rust });
  place(group, 'terminal', 0, 0, -3.2, 0);
  place(group, 'warning_light', -2.8, 0, -3);
  place(group, 'warning_light', 2.8, 0, -3);
}

function buildAlley(group, poi) {
  const sideLength = Math.max(4, poi.size.z * 0.78);
  place(group, 'scrap_wall', -poi.size.x / 2, 0, 0, Math.PI / 2, { length: sideLength, height: 2.3 });
  place(group, 'scrap_wall', poi.size.x / 2, 0, 0, Math.PI / 2, { length: sideLength, height: 2.3 });
  place(group, 'pipe_run', 0, 0, 1.5, 0, { length: 5 });
  place(group, 'warning_light', 0, 0, -5);
}

function buildPlaza(group) {
  place(group, 'reactor_tower', 5, 0, 3);
  place(group, 'terminal', -4.5, 0, 2, -Math.PI / 2);
  place(group, 'generator', 5.5, 0, -4.5);
  place(group, 'light_tower', -7.5, 0, -5.5);
  place(group, 'barrier', -4, 0, -6.5, 0.2, { length: 4 });
  place(group, 'barrier', 4, 0, -6.5, -0.2, { length: 4 });
  place(group, 'warning_light', 0, 0, -2);
}

export function createDeadwirePOIAssets(poi) {
  const group = new THREE.Group();
  group.name = `${poi.id}_coded_assets`;

  switch (poi.category) {
    case 'apartment_block': buildApartment(group, poi); break;
    case 'warehouse': buildWarehouse(group, poi); break;
    case 'market': buildMarket(group, poi); break;
    case 'parking_garage': buildGarage(group, poi); break;
    case 'rooftop_perch': buildPerch(group, poi); break;
    case 'underground_tunnel': buildTunnel(group, poi); break;
    case 'loot_shack': buildLootShack(group, poi); break;
    case 'locked_loot_room': buildVault(group, poi); break;
    case 'alley': buildAlley(group, poi); break;
    case 'plaza': buildPlaza(group, poi); break;
  }

  addInteriorDepth(group, poi);
  for (const cover of poi.coverZones) addCoverAsset(group, poi, cover);
  group.userData.poiId = poi.id;
  group.userData.usesCodedAssets = true;
  return group;
}
