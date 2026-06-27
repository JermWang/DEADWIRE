// DistantBackdrop — late-90s/early-2000s painted-horizon illusion.
// Layered world-space image cards surround the playable arena. They are cheap,
// naturally parallax as the camera moves, and dissolve into the scene fog.
import * as THREE from 'three';

function seededRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

function paintCoolingTower(ctx, x, base, width, height, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - width * 0.5, base);
  ctx.bezierCurveTo(
    x - width * 0.42, base - height * 0.32,
    x - width * 0.18, base - height * 0.45,
    x - width * 0.3, base - height,
  );
  ctx.lineTo(x + width * 0.3, base - height);
  ctx.bezierCurveTo(
    x + width * 0.18, base - height * 0.45,
    x + width * 0.42, base - height * 0.32,
    x + width * 0.5, base,
  );
  ctx.closePath();
  ctx.fill();
}

function paintCrane(ctx, x, base, height, direction, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, base);
  ctx.lineTo(x, base - height);
  ctx.lineTo(x + direction * height * 0.72, base - height);
  ctx.moveTo(x, base - height * 0.84);
  ctx.lineTo(x + direction * height * 0.56, base - height);
  ctx.stroke();
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + direction * height * 0.5, base - height);
  ctx.lineTo(x + direction * height * 0.5, base - height * 0.52);
  ctx.stroke();
}

function createHorizonTexture(seed, layer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const random = seededRandom(seed);
  const far = layer === 'far';
  const base = 250;
  const silhouette = far ? 'rgba(47,54,58,0.72)' : 'rgba(31,38,42,0.95)';
  const detail = far ? 'rgba(70,75,75,0.48)' : 'rgba(79,72,63,0.75)';

  // A dusty low ridge hides the bottom of the cards and their intersections.
  ctx.fillStyle = far ? 'rgba(73,72,67,0.38)' : 'rgba(51,51,48,0.72)';
  ctx.beginPath();
  ctx.moveTo(0, base);
  for (let x = 0; x <= canvas.width; x += 48) {
    ctx.lineTo(x, base - 16 - random() * (far ? 34 : 20));
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();

  // Blocky factories and tenements form the main matte-painted skyline.
  let x = -20;
  while (x < canvas.width + 20) {
    const width = (far ? 34 : 46) + random() * (far ? 64 : 82);
    const height = (far ? 28 : 42) + random() * (far ? 72 : 105);
    ctx.fillStyle = silhouette;
    ctx.fillRect(x, base - height, width, height);
    ctx.fillStyle = detail;
    ctx.fillRect(x + width * 0.12, base - height - 5, width * 0.76, 6);

    if (!far) {
      const windowColor = random() > 0.45
        ? 'rgba(242,169,59,0.68)'
        : 'rgba(99,210,255,0.48)';
      ctx.fillStyle = windowColor;
      for (let wy = base - height + 18; wy < base - 14; wy += 19) {
        for (let wx = x + 12; wx < x + width - 9; wx += 21) {
          if (random() > 0.48) ctx.fillRect(wx, wy, 5, 3);
        }
      }
    }

    if (random() > 0.56) {
      const stackWidth = 7 + random() * 7;
      const stackHeight = 28 + random() * 58;
      ctx.fillStyle = silhouette;
      ctx.fillRect(
        x + width * (0.2 + random() * 0.55),
        base - height - stackHeight,
        stackWidth,
        stackHeight,
      );
    }
    x += width + 8 + random() * 24;
  }

  // Large iconic shapes break the repeated-box silhouette.
  paintCoolingTower(ctx, 175 + random() * 40, base, far ? 92 : 112, far ? 112 : 150, silhouette);
  paintCoolingTower(ctx, 770 + random() * 55, base, far ? 74 : 96, far ? 92 : 132, silhouette);
  paintCrane(ctx, 430, base, far ? 118 : 172, 1, silhouette);
  paintCrane(ctx, 910, base, far ? 98 : 145, -1, silhouette);

  // Horizontal haze bands mimic pre-rendered matte-paint compression and help
  // the cards merge into the real fog.
  const haze = ctx.createLinearGradient(0, 150, 0, 256);
  haze.addColorStop(0, 'rgba(125,113,89,0)');
  haze.addColorStop(1, far ? 'rgba(125,113,89,0.48)' : 'rgba(90,82,68,0.2)');
  ctx.fillStyle = haze;
  ctx.fillRect(0, 120, 1024, 136);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

function makeCard(texture, width, height, opacity) {
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    opacity,
    alphaTest: 0.015,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    fog: true,
    toneMapped: false,
  });
  const card = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  card.renderOrder = -20;
  return card;
}

export class DistantBackdrop {
  constructor(bounds) {
    this.root = new THREE.Group();
    this.root.name = 'distant_painted_horizon';
    this.textures = [];
    this.materials = [];
    this._build(bounds);
  }

  _build(bounds) {
    const centerX = (bounds.min.x + bounds.max.x) / 2;
    const centerZ = (bounds.min.z + bounds.max.z) / 2;
    const width = bounds.max.x - bounds.min.x;
    const depth = bounds.max.z - bounds.min.z;

    // A cheap continuation plane prevents a visible void immediately beyond
    // the collision wall. Fog erases its outer edge.
    const outerGround = new THREE.Mesh(
      new THREE.PlaneGeometry(width + 190, depth + 190),
      new THREE.MeshBasicMaterial({ color: 0x49463e, fog: true }),
    );
    outerGround.name = 'distant_ground_matte';
    outerGround.rotation.x = -Math.PI / 2;
    outerGround.position.set(centerX, -0.15, centerZ);
    outerGround.receiveShadow = false;
    this.root.add(outerGround);

    const layers = [
      { name: 'near', offset: 15, height: 29, overscan: 28, opacity: 0.96 },
      { name: 'far', offset: 43, height: 38, overscan: 78, opacity: 0.72 },
    ];

    layers.forEach((layer, layerIndex) => {
      const seeds = [19, 47, 83, 131].map((seed) => seed + layerIndex * 997);
      const textures = seeds.map((seed) => createHorizonTexture(seed, layer.name));
      this.textures.push(...textures);

      const north = makeCard(textures[0], width + layer.overscan, layer.height, layer.opacity);
      north.name = `${layer.name}_horizon_north`;
      north.position.set(centerX, layer.height / 2 - 0.2, bounds.max.z + layer.offset);
      this.root.add(north);

      const south = makeCard(textures[1], width + layer.overscan, layer.height, layer.opacity);
      south.name = `${layer.name}_horizon_south`;
      south.position.set(centerX, layer.height / 2 - 0.2, bounds.min.z - layer.offset);
      this.root.add(south);

      const east = makeCard(textures[2], depth + layer.overscan, layer.height, layer.opacity);
      east.name = `${layer.name}_horizon_east`;
      east.position.set(bounds.max.x + layer.offset, layer.height / 2 - 0.2, centerZ);
      east.rotation.y = Math.PI / 2;
      this.root.add(east);

      const west = makeCard(textures[3], depth + layer.overscan, layer.height, layer.opacity);
      west.name = `${layer.name}_horizon_west`;
      west.position.set(bounds.min.x - layer.offset, layer.height / 2 - 0.2, centerZ);
      west.rotation.y = Math.PI / 2;
      this.root.add(west);

      for (const card of [north, south, east, west]) this.materials.push(card.material);
    });
  }

  update(time) {
    // Very slight far-layer breathing emulates old animated matte plates without
    // making the horizon look alive or distracting.
    for (let i = 4; i < this.materials.length; i++) {
      this.materials[i].opacity = 0.7 + Math.sin(time * 0.17 + i) * 0.025;
    }
  }

  dispose() {
    for (const texture of this.textures) texture.dispose();
    for (const material of this.materials) material.dispose();
  }
}
