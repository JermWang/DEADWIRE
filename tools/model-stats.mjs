// Headless model-stats — instantiates every coded asset and checks triangle +
// material counts against its registry budget. Complements the in-studio readout.
//
// Needs three installed locally (the runtime uses a CDN, so this is dev-only):
//   npm install three --no-save && node tools/model-stats.mjs
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pipe = path.join(root, 'game-asset-pipeline');
const url = (p) => pathToFileURL(path.join(pipe, p)).href;

let registry, builders, prim;
try {
  registry = await import(url('asset-lib/registry.js'));
  builders = await import(url('asset-lib/builders/index.js'));
  prim = await import(url('asset-lib/prim.js'));
} catch (e) {
  if (/Cannot find package 'three'/.test(String(e))) {
    console.error('\nthree not installed. Run:  npm install three --no-save\n');
    process.exit(2);
  }
  throw e;
}

const { ASSETS } = registry;
const { BUILDERS } = builders;
const { inspect } = prim;

let fails = 0;
const rows = [];
for (const a of ASSETS) {
  const fn = BUILDERS[a.id];
  if (!fn) { rows.push([a.id, '—', '—', 'NO BUILDER']); fails++; continue; }
  try {
    const obj = a.category === 'character' ? fn({ pose: 'tpose' }) : fn();
    const { triangles, materials } = inspect(obj);
    const tb = a.budgets.maxTriangles, mb = a.budgets.maxMaterials;
    const over = triangles > tb || materials > mb;
    if (over) fails++;
    rows.push([a.id, `${triangles}/${tb}`, `${materials}/${mb}`, over ? 'OVER BUDGET' : 'ok']);
  } catch (e) {
    rows.push([a.id, '—', '—', 'ERROR: ' + e.message]); fails++;
  }
}

const w = [Math.max(...rows.map((r) => r[0].length)), 12, 10];
console.log('\nDeadwire model stats\n');
console.log('  ' + 'asset'.padEnd(w[0]) + '  ' + 'tris'.padEnd(w[1]) + 'mats'.padEnd(w[2]) + 'status');
for (const r of rows) {
  console.log('  ' + r[0].padEnd(w[0]) + '  ' + String(r[1]).padEnd(w[1]) + String(r[2]).padEnd(w[2]) + r[3]);
}
console.log('');
console.log(fails ? `FAIL — ${fails} asset(s) over budget or erroring\n` : 'PASS — all assets within budget\n');
process.exitCode = fails ? 1 : 0;
