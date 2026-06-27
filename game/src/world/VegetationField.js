// Deterministic, semantic-aware wilderness infill for the expanded district.
// Vegetation avoids POI footprints and keeps traversal corridors readable.
import * as THREE from 'three';
import { buildAsset } from '../assets.js';

function hash2(x, z, salt = 0) {
  let value = Math.imul(x + salt * 1013, 374761393) ^ Math.imul(z - salt * 733, 668265263);
  value = Math.imul(value ^ (value >>> 13), 1274126177);
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295;
}

function distanceToSegment(x, z, start, end) {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  const lengthSq = dx * dx + dz * dz;
  if (lengthSq < 0.001) return Math.hypot(x - start.x, z - start.z);
  const t = Math.max(0, Math.min(1, ((x - start.x) * dx + (z - start.z) * dz) / lengthSq));
  return Math.hypot(x - (start.x + dx * t), z - (start.z + dz * t));
}

function insidePOI(x, z, poi, margin) {
  return Math.abs(x - poi.position.x) <= poi.size.x / 2 + margin &&
    Math.abs(z - poi.position.z) <= poi.size.z / 2 + margin;
}

export class VegetationField {
  constructor(mapDefinition) {
    this.root = new THREE.Group();
    this.root.name = 'semantic_wilderness_infill';
    this.blockers = [];
    this.counts = { grass: 0, shrubs: 0, trees: 0 };
    this._build(mapDefinition);
  }

  _build(map) {
    const spacing = 7.2;
    const minX = Math.ceil((map.bounds.min.x + 5) / spacing);
    const maxX = Math.floor((map.bounds.max.x - 5) / spacing);
    const minZ = Math.ceil((map.bounds.min.z + 5) / spacing);
    const maxZ = Math.floor((map.bounds.max.z - 5) / spacing);

    for (let gx = minX; gx <= maxX; gx++) {
      for (let gz = minZ; gz <= maxZ; gz++) {
        const density = hash2(gx, gz, 1);
        if (density < 0.29) continue;

        const x = gx * spacing + (hash2(gx, gz, 2) - 0.5) * 4.6;
        const z = gz * spacing + (hash2(gx, gz, 3) - 0.5) * 4.6;
        if (map.pois.some((poi) => insidePOI(x, z, poi, 4.5))) continue;

        let routeDistance = Infinity;
        for (const link of map.traversalLinks) {
          routeDistance = Math.min(routeDistance, distanceToSegment(x, z, link.start, link.end));
        }

        const edgeDistance = Math.min(
          x - map.bounds.min.x,
          map.bounds.max.x - x,
          z - map.bounds.min.z,
          map.bounds.max.z - z,
        );
        const typeRoll = hash2(gx, gz, 4);
        const rotation = hash2(gx, gz, 5) * Math.PI * 2;

        // Route shoulders get sparse grass, never hard tree blockers.
        if (routeDistance < 4.2) {
          if (routeDistance > 1.6 && density > 0.56) {
            this._placeGrass(x, z, rotation, gx, gz, 0.42);
          }
          continue;
        }

        // Forested border bands frame the district while the central gaps stay
        // mostly scrubland, preserving combat visibility.
        const forestBand = edgeDistance < 28;
        if ((forestBand && typeRoll > 0.61) || (!forestBand && typeRoll > 0.94)) {
          this._placeTree(x, z, rotation, gx, gz);
        } else if (typeRoll > 0.72) {
          this._placeShrub(x, z, rotation, gx, gz);
        } else {
          this._placeGrass(x, z, rotation, gx, gz, forestBand ? 0.68 : 0.48);
        }
      }
    }
  }

  _placeGrass(x, z, rotation, gx, gz, lushness) {
    const radius = 1.25 + hash2(gx, gz, 7) * 1.45;
    const asset = buildAsset('rough_grass_patch', { radius, lushness });
    asset.position.set(x, 0.025, z);
    asset.rotation.y = rotation;
    asset.scale.y = 0.7 + hash2(gx, gz, 8) * 0.65;
    this.root.add(asset);
    this.counts.grass++;
  }

  _placeShrub(x, z, rotation, gx, gz) {
    const asset = buildAsset('dead_shrub', { green: hash2(gx, gz, 9) > 0.68 });
    asset.position.set(x, 0.02, z);
    asset.rotation.y = rotation;
    asset.scale.setScalar(0.72 + hash2(gx, gz, 10) * 0.78);
    this.root.add(asset);
    this.counts.shrubs++;
  }

  _placeTree(x, z, rotation, gx, gz) {
    const height = 4.5 + hash2(gx, gz, 11) * 3.7;
    const asset = buildAsset('evergreen_tree', {
      height,
      dead: hash2(gx, gz, 12) > 0.82,
    });
    asset.position.set(x, 0, z);
    asset.rotation.y = rotation;
    this.root.add(asset);
    this.blockers.push({ x, z, radius: 0.55 });
    this.counts.trees++;
  }

  dispose() {
    this.root.traverse((object) => {
      object.geometry?.dispose?.();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) material?.dispose?.();
    });
  }
}
