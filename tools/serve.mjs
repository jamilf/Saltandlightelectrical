// Preview the built site: node tools/serve.mjs, then open http://localhost:8080
// Serves dist/ the way the host does: folders serve index.html, /about becomes /about/,
// and anything missing gets 404.html.
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const { values } = parseArgs({ options: { port: { type: 'string', default: '8080' } } });
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

if (!existsSync(root)) {
  console.error('dist/ does not exist yet. Run node tools/build.mjs first.');
  process.exit(1);
}

createServer((request, response) => {
  const path = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  const file = normalize(join(root, path));
  if (!file.startsWith(root + sep) && file !== root) {
    response.writeHead(400).end();
    return;
  }
  const isDir = existsSync(file) && statSync(file).isDirectory();
  if (isDir && !path.endsWith('/')) {
    response.writeHead(301, { Location: `${path}/` }).end();
    return;
  }
  const target = isDir ? join(file, 'index.html') : file;
  if (existsSync(target) && statSync(target).isFile()) {
    response.writeHead(200, { 'Content-Type': TYPES[extname(target)] ?? 'application/octet-stream' });
    createReadStream(target).pipe(response);
    return;
  }
  response.writeHead(404, { 'Content-Type': TYPES['.html'] });
  createReadStream(join(root, '404.html')).pipe(response);
}).listen(Number(values.port), () => {
  console.log(`Previewing dist/ at http://localhost:${values.port} (Ctrl+C to stop)`);
});
