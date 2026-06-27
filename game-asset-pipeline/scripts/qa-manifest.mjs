import { readFile, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const manifestPath = path.join(root, 'manifest', 'assets.json');
const reportPath = path.join(root, 'QA_REPORT.md');

const requiredAssetFields = [
  'id',
  'displayName',
  'category',
  'version',
  'status',
  'files',
  'source',
  'transform',
  'budgets',
  'license'
];

function rel(filePath) {
  return path.relative(root, filePath).replaceAll(path.sep, '/');
}

async function existsWithSize(relativePath) {
  const fullPath = path.join(root, relativePath);
  const s = await stat(fullPath);
  return { fullPath, size: s.size };
}

function parseGlb(buffer) {
  if (buffer.length < 20) throw new Error('GLB too small');
  if (buffer.readUInt32LE(0) !== 0x46546c67) throw new Error('Missing glTF magic');
  const version = buffer.readUInt32LE(4);
  if (version !== 2) throw new Error(`Unsupported GLB version ${version}`);
  const totalLength = buffer.readUInt32LE(8);
  if (totalLength !== buffer.length) throw new Error(`GLB length mismatch: header ${totalLength}, file ${buffer.length}`);

  let offset = 12;
  let json = null;
  while (offset + 8 <= buffer.length) {
    const chunkLength = buffer.readUInt32LE(offset);
    const chunkType = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;
    const chunkEnd = chunkStart + chunkLength;
    if (chunkEnd > buffer.length) throw new Error('GLB chunk overruns file');
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(buffer.subarray(chunkStart, chunkEnd).toString('utf8').trim());
    }
    offset = chunkEnd;
  }
  if (!json) throw new Error('GLB missing JSON chunk');
  return json;
}

function countTriangles(gltf) {
  let triangles = 0;
  for (const mesh of gltf.meshes || []) {
    for (const primitive of mesh.primitives || []) {
      if (primitive.mode != null && primitive.mode !== 4) continue;
      if (primitive.indices != null) {
        triangles += Math.floor(((gltf.accessors || [])[primitive.indices]?.count || 0) / 3);
      } else {
        const positionAccessor = primitive.attributes ? primitive.attributes.POSITION : null;
        triangles += Math.floor(((gltf.accessors || [])[positionAccessor]?.count || 0) / 3);
      }
    }
  }
  return triangles;
}

function tableRow(values) {
  return `| ${values.map((value) => String(value).replaceAll('\n', ' ')).join(' | ')} |`;
}

async function inspectAsset(asset) {
  const errors = [];
  const warnings = [];
  const info = {
    id: asset.id || '(missing id)',
    triangles: 0,
    materials: 0,
    fileSizeKB: 0
  };

  for (const field of requiredAssetFields) {
    if (asset[field] == null) errors.push(`Missing required field: ${field}`);
  }

  const files = asset.files || {};
  for (const key of ['concept', 'modelGLB', 'icon', 'thumbnail']) {
    if (!files[key]) {
      errors.push(`Missing file path: files.${key}`);
      continue;
    }
    try {
      await existsWithSize(files[key]);
    } catch {
      errors.push(`Missing file: ${files[key]}`);
    }
  }

  if (files.modelGLB) {
    try {
      const { fullPath, size } = await existsWithSize(files.modelGLB);
      info.fileSizeKB = Number((size / 1024).toFixed(2));
      const glb = parseGlb(await readFile(fullPath));
      info.triangles = countTriangles(glb);
      info.materials = (glb.materials || []).length;
    } catch (error) {
      errors.push(`GLB parse failed: ${error.message}`);
    }
  }

  const budgets = asset.budgets || {};
  if (Number.isFinite(budgets.maxTriangles) && info.triangles > budgets.maxTriangles) {
    errors.push(`Triangle budget exceeded: ${info.triangles}/${budgets.maxTriangles}`);
  }
  if (Number.isFinite(budgets.maxMaterials) && info.materials > budgets.maxMaterials) {
    errors.push(`Material budget exceeded: ${info.materials}/${budgets.maxMaterials}`);
  }
  if (Number.isFinite(budgets.maxFileSizeKB) && info.fileSizeKB > budgets.maxFileSizeKB) {
    errors.push(`File size budget exceeded: ${info.fileSizeKB}/${budgets.maxFileSizeKB} KB`);
  }

  if (!asset.license?.notes || /replace/i.test(asset.license.notes)) {
    warnings.push('License notes still need production replacement.');
  }
  if (asset.status && /smoke-test|placeholder/i.test(asset.status)) {
    warnings.push('Asset is marked as placeholder/smoke-test.');
  }

  return { errors, warnings, info };
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const results = [];

  for (const asset of manifest.assets || []) {
    results.push({ asset, result: await inspectAsset(asset) });
  }

  const failed = results.some(({ result }) => result.errors.length);
  const now = new Date().toISOString();
  const lines = [
    '# Asset QA Report',
    '',
    `Generated: ${now}`,
    '',
    `Manifest: \`${rel(manifestPath)}\``,
    '',
    failed ? '**Status: FAIL**' : '**Status: PASS**',
    '',
    tableRow(['Asset', 'Triangles', 'Materials', 'File Size', 'Errors', 'Warnings']),
    tableRow(['---', '---:', '---:', '---:', '---', '---'])
  ];

  for (const { asset, result } of results) {
    lines.push(
      tableRow([
        asset.id || '(missing id)',
        result.info.triangles,
        result.info.materials,
        `${result.info.fileSizeKB} KB`,
        result.errors.length ? result.errors.join('; ') : 'none',
        result.warnings.length ? result.warnings.join('; ') : 'none'
      ])
    );
  }

  lines.push('');
  lines.push('## Next Gate');
  lines.push('');
  lines.push('- Replace placeholder sample outputs with generated PNG concepts and image-to-3D GLBs.');
  lines.push('- Run this QA script after every asset import.');
  lines.push('- Add desktop/mobile screenshot checks once a project preview scene exists.');

  await writeFile(reportPath, `${lines.join('\n')}\n`);
  console.log(`Wrote ${rel(reportPath)}`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

