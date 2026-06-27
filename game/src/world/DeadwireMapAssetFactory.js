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

  for (const cover of poi.coverZones) addCoverAsset(group, poi, cover);
  group.userData.poiId = poi.id;
  group.userData.usesCodedAssets = true;
  return group;
}
