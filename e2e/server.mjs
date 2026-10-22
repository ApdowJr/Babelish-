/**
 * Minimal static file server for the exported web app (dist/).
 * Deterministic, dependency-free, SPA-fallback to index.html so deep links
 * like /lesson/es-ch1-l1 resolve against the exported bundle.
 * Port comes from process.env.E2E_PORT (default 3100).
 */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'dist');
const PORT = Number(process.env.E2E_PORT || 3100);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
};

async function tryFile(path) {
  try {
    return await readFile(path);
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  let pathname = decodeURIComponent(url.pathname);
  // Prevent path traversal — normalize and re-root under dist/.
  pathname = normalize(pathname).replace(/^(\.\.[/\\])+/, '');
  let filePath = join(ROOT, pathname);
  if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) filePath = join(ROOT, 'index.html');

  let body = await tryFile(filePath);
  if (body === null) {
    // Expo web export uses hash or history routing depending on config; try
    // the .html sibling first, then fall back to the SPA shell.
    body = (await tryFile(`${filePath}.html`)) ?? (await tryFile(join(ROOT, 'index.html')));
  }
  if (body === null) {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('not built — run `npm run build:web` before e2e');
    return;
  }
  const type = MIME[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`e2e static server: http://127.0.0.1:${PORT} (root ${ROOT})`);
});
