// Deadwire coded-asset QA — validates the registry without a browser.
// Checks: every asset has required metadata, its builder module exists on disk,
// declared cosmetic slots are valid, budgets are present and sane, ids are unique.
// (Triangle/material counts are verified live in the studio readout against budgets.)
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const pipeline = path.join(root, 'game-asset-pipeline');

const REQUIRED = ['id', 'displayName', 'category', 'pipeline', 'module', 'budgets', 'status'];

async function main() {
  const reg = await import(path.join(pipeline, 'asset-lib', 'registry.js').replaceAll('\\', '/').replace(/^/, 'file:///'));
  const { ASSETS, CATEGORIES } = reg;
  const sockets = await import(path.join(pipeline, 'asset-lib', 'sockets.js').replaceAll('\\', '/').replace(/^/, 'file:///'));
  const SLOTS = new Set(sockets.SLOTS);

  const errors = [];
  const warnings = [];
  const seen = new Set();

  for (const a of ASSETS) {
    const tag = a.id || '(no id)';
    for (const f of REQUIRED) if (a[f] == null) errors.push(`${tag}: missing field '${f}'`);
    if (seen.has(a.id)) errors.push(`${tag}: duplicate id`);
    seen.add(a.id);
    if (a.category && !CATEGORIES.includes(a.category)) errors.push(`${tag}: unknown category '${a.category}'`);
    if (a.slot && !SLOTS.has(a.slot)) errors.push(`${tag}: invalid slot '${a.slot}'`);
    if (a.budgets) {
      if (!(a.budgets.maxTriangles > 0)) errors.push(`${tag}: maxTriangles must be > 0`);
      if (!(a.budgets.maxMaterials > 0)) errors.push(`${tag}: maxMaterials must be > 0`);
    }
    if (a.module) {
      try { await stat(path.join(pipeline, a.module)); }
      catch { errors.push(`${tag}: builder module not found -> ${a.module}`); }
    }
    if (a.category === 'cosmetic' && !a.slot) warnings.push(`${tag}: cosmetic without a slot`);
    if (a.riggable && !a.rigType) errors.push(`${tag}: riggable asset requires rigType`);
    if (a.riggable && !['character', 'enemy'].includes(a.category)) {
      warnings.push(`${tag}: riggable asset is outside character/enemy categories`);
    }
  }

  console.log(`\nDeadwire asset QA — ${ASSETS.length} assets, ${CATEGORIES.length} categories`);
  console.log('Categories:', CATEGORIES.map((c) => `${c}(${ASSETS.filter((a) => a.category === c).length})`).join(' '));
  if (warnings.length) { console.log('\nWarnings:'); warnings.forEach((w) => console.log('  ! ' + w)); }
  if (errors.length) {
    console.log('\nERRORS:'); errors.forEach((e) => console.log('  ✗ ' + e));
    console.log(`\nFAIL — ${errors.length} error(s)\n`); process.exitCode = 1;
  } else {
    console.log('\nPASS — registry valid, all builder modules present\n');
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
