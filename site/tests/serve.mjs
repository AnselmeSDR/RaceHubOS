// Builds the site in a temporary folder and serves it, as GitHub Pages would: node site/tests/serve.mjs <port>
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { buildSite } from '../scripts/build.mjs';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
  '.zip': 'application/zip',
  '.bat': 'application/octet-stream',
  '.txt': 'text/plain',
};

const port = Number(process.argv[2] ?? 4390);
const outDir = buildSite(fs.mkdtempSync(path.join(os.tmpdir(), 'racehubos-site-')));

http
  .createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.join(outDir, path.normalize(pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(outDir) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(port, () => console.log(`Site on http://localhost:${port}`));

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    fs.rmSync(outDir, { recursive: true, force: true });
    process.exit(0);
  });
}
