import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const assetDir = path.join(root, 'assets', 'pet_crystal_shardling');

function padBuffer(buffer, padByte = 0) {
  const padding = (4 - (buffer.length % 4)) % 4;
  return padding ? Buffer.concat([buffer, Buffer.alloc(padding, padByte)]) : buffer;
}

function typedBuffer(view) {
  return Buffer.from(view.buffer, view.byteOffset, view.byteLength);
}

function createCrystalGlb() {
  const r = 0.46;
  const y = 0;
  const top = [0, 1.05, 0];
  const bottom = [0, -0.55, 0];
  const ring = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI * 2 * i) / 6 + Math.PI / 6;
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  });
  const positions = new Float32Array([...top, ...bottom, ...ring.flat()]);
  const normals = new Float32Array(positions.length);

  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const yy = positions[i + 1];
    const z = positions[i + 2];
    const len = Math.hypot(x, yy * 0.7, z) || 1;
    normals[i] = x / len;
    normals[i + 1] = (yy * 0.7) / len;
    normals[i + 2] = z / len;
  }

  const indices = [];
  for (let i = 0; i < 6; i += 1) {
    const a = 2 + i;
    const b = 2 + ((i + 1) % 6);
    indices.push(0, a, b);
    indices.push(1, b, a);
  }
  const indexArray = new Uint16Array(indices);

  const positionBuffer = typedBuffer(positions);
  const normalBuffer = typedBuffer(normals);
  const indexBuffer = typedBuffer(indexArray);
  const binBuffer = padBuffer(Buffer.concat([positionBuffer, normalBuffer, indexBuffer]));

  const gltf = {
    asset: {
      version: '2.0',
      generator: 'Codex sample asset generator'
    },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [
      {
        name: 'pet_crystal_shardling_root',
        mesh: 0,
        rotation: [0, 0.3826834, 0, 0.9238795]
      }
    ],
    materials: [
      {
        name: 'faceted_arcane_crystal',
        pbrMetallicRoughness: {
          baseColorFactor: [0.32, 0.78, 1, 1],
          metallicFactor: 0.02,
          roughnessFactor: 0.72
        }
      }
    ],
    meshes: [
      {
        name: 'pet_crystal_shardling_mesh',
        primitives: [
          {
            attributes: {
              POSITION: 0,
              NORMAL: 1
            },
            indices: 2,
            material: 0,
            mode: 4
          }
        ]
      }
    ],
    buffers: [{ byteLength: binBuffer.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionBuffer.length, target: 34962 },
      { buffer: 0, byteOffset: positionBuffer.length, byteLength: normalBuffer.length, target: 34962 },
      { buffer: 0, byteOffset: positionBuffer.length + normalBuffer.length, byteLength: indexBuffer.length, target: 34963 }
    ],
    accessors: [
      {
        bufferView: 0,
        byteOffset: 0,
        componentType: 5126,
        count: positions.length / 3,
        type: 'VEC3',
        min: [-0.3983716965, -0.55, -0.46],
        max: [0.3983716965, 1.05, 0.46]
      },
      {
        bufferView: 1,
        byteOffset: 0,
        componentType: 5126,
        count: normals.length / 3,
        type: 'VEC3'
      },
      {
        bufferView: 2,
        byteOffset: 0,
        componentType: 5123,
        count: indexArray.length,
        type: 'SCALAR'
      }
    ]
  };

  const jsonBuffer = padBuffer(Buffer.from(JSON.stringify(gltf)), 0x20);
  const totalLength = 12 + 8 + jsonBuffer.length + 8 + binBuffer.length;
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(totalLength, 8);

  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonBuffer.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);

  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binBuffer.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);

  return Buffer.concat([header, jsonHeader, jsonBuffer, binHeader, binBuffer]);
}

function conceptSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" fill="#111922"/>
  <circle cx="512" cy="540" r="310" fill="#1e2b39"/>
  <path d="M512 124 666 514 512 900 358 514Z" fill="#63d2ff"/>
  <path d="M512 124 666 514 512 460Z" fill="#9b6dff" opacity="0.9"/>
  <path d="M512 900 666 514 512 626Z" fill="#2ea7d5"/>
  <path d="M512 124 358 514 512 460Z" fill="#b7f0ff"/>
  <path d="M512 900 358 514 512 626Z" fill="#3956d6"/>
  <circle cx="512" cy="536" r="52" fill="#f2d38b"/>
  <circle cx="512" cy="536" r="92" fill="none" stroke="#f2d38b" stroke-width="10" opacity="0.55"/>
  <ellipse cx="512" cy="910" rx="190" ry="32" fill="#000" opacity="0.28"/>
</svg>`;
}

function iconSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="84" fill="#1b2632"/>
  <circle cx="256" cy="270" r="168" fill="#26394b"/>
  <path d="M256 58 342 260 256 454 170 260Z" fill="#63d2ff"/>
  <path d="M256 58 342 260 256 232Z" fill="#9b6dff"/>
  <path d="M256 454 170 260 256 310Z" fill="#3956d6"/>
  <circle cx="256" cy="266" r="31" fill="#f2d38b"/>
  <circle cx="256" cy="266" r="58" fill="none" stroke="#f2d38b" stroke-width="8" opacity="0.55"/>
</svg>`;
}

async function main() {
  await mkdir(path.join(assetDir, 'source'), { recursive: true });
  await mkdir(path.join(assetDir, 'model'), { recursive: true });
  await writeFile(path.join(assetDir, 'source', 'concept.svg'), conceptSvg());
  await writeFile(path.join(assetDir, 'icon.svg'), iconSvg());
  await writeFile(path.join(assetDir, 'thumbnail.svg'), conceptSvg());
  await writeFile(path.join(assetDir, 'model', 'pet_crystal_shardling.glb'), createCrystalGlb());
  console.log(`Generated sample asset at ${path.relative(process.cwd(), assetDir)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

