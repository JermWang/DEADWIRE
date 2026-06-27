// Deadwire dev server — serves the whole project root so the game can import the
// shared asset-lib from game-asset-pipeline/. Node built-ins only.
//   node tools/serve.mjs   ->  http://127.0.0.1:5180/game/   and   /game-asset-pipeline/studio/
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const startPort = Number(process.env.PORT || 5180);
const publicRoots = [
  path.join(root, 'game'),
  path.join(root, 'game-asset-pipeline', 'asset-lib'),
  path.join(root, 'game-asset-pipeline', 'studio'),
  path.join(root, 'public'),
];

const types = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary',
  '.png': 'image/png', '.webp': 'image/webp',
};

function isInside(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function resolve(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  let clean = decoded === '/' ? '/game/index.html' : decoded;
  const full = path.resolve(root, '.' + clean);
  if (!publicRoots.some((allowed) => isInside(allowed, full))) return null;
  return full;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end('Method not allowed');
    }
    // redirect bare root to the game so relative module paths resolve correctly
    if ((req.url || '/').split('?')[0] === '/') {
      res.writeHead(302, { Location: '/game/' }); return res.end();
    }
    let file = resolve(req.url || '/');
    if (!file) { res.writeHead(403); return res.end('Forbidden'); }
    let s;
    try { s = await stat(file); } catch { res.writeHead(404); return res.end('Not found'); }
    if (s.isDirectory()) { file = path.join(file, 'index.html'); await stat(file); }
    res.writeHead(200, {
      'Content-Type': types[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    });
    if (req.method === 'HEAD') return res.end();
    createReadStream(file).pipe(res);
  } catch { res.writeHead(404); res.end('Not found'); }
});

(function listen(port, tries = 25) {
  server.once('error', (e) => { if (e.code === 'EADDRINUSE' && tries > 0) listen(port + 1, tries - 1); else throw e; });
  server.listen(port, '127.0.0.1', () => {
    console.log(`Deadwire dev server: http://127.0.0.1:${port}/`);
    console.log(`  Game   -> http://127.0.0.1:${port}/game/`);
    console.log(`  Studio -> http://127.0.0.1:${port}/game-asset-pipeline/studio/`);
  });
})(startPort);
