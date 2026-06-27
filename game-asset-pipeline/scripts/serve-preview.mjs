import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const requestedPort = Number(process.env.PORT || 5177);

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.png': 'image/png',
  '.webp': 'image/webp'
};

function safePath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const clean = decoded === '/' ? '/preview/index.html' : decoded;
  const fullPath = path.resolve(root, `.${clean}`);
  if (!fullPath.startsWith(root)) return null;
  return fullPath;
}

function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const filePath = safePath(req.url || '/');
      if (!filePath) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      const s = await stat(filePath);
      if (!s.isFile()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        'Content-Type': contentTypes[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      createReadStream(filePath).pipe(res);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

async function listen(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

for (let port = requestedPort; port < requestedPort + 25; port += 1) {
  try {
    await listen(port);
    console.log(`Asset preview running at http://127.0.0.1:${port}/preview/`);
    console.log(`Serving ${root}`);
    break;
  } catch (error) {
    if (error.code !== 'EADDRINUSE') throw error;
  }
}

