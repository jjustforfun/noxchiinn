import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { ASSET_POLICY, SECURITY_HEADERS, WORKER_POLICY, verifySealed } from './security-policy.mjs';

// Локальный сервер приёмочных тестов. Не является новым backend приложения.
const root = resolve(import.meta.dirname, '..');
const directory = resolve(root, 'dist');
const report = JSON.parse(await readFile(resolve(root, 'docs/release-security.json'), 'utf8'));
const release = JSON.parse(await readFile(resolve(directory, 'release-manifest.json'), 'utf8'));
const assets = new Map(release.assets.map((asset) => [asset.url, asset]));
const main = await readFile(resolve(directory, 'index.html'), 'utf8');
if (!verifySealed(main, report.policies['index.html'])) throw new Error('Run scripts/harden.mjs on the current build before testing');

createServer(async (request, response) => {
  const headers = { ...SECURITY_HEADERS, 'Cache-Control': 'no-cache' };
  try {
    if (!['GET', 'HEAD'].includes(request.method)) { response.writeHead(405, { ...headers, Allow: 'GET, HEAD' }); response.end(); return; }
    const url = new URL(request.url, 'http://127.0.0.1:4173');
    const pathname = decodeURIComponent(url.pathname);
    const key = pathname === '/index.html' ? '/' : pathname;
    const asset = assets.get(key);
    if (!asset && !['/release.js', '/release-manifest.json'].includes(key)) {
      const missing = assets.has('/404.html') ? await readFile(resolve(directory, '404.html')) : Buffer.from('Not found');
      response.writeHead(404, { ...headers, ...(report.documentHeaders?.['404.html'] || { 'Content-Security-Policy': ASSET_POLICY }), 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': 'noindex, nofollow' }); response.end(missing); return;
    }
    const file = resolve(directory, key === '/' ? 'index.html' : key.slice(1));
    if (!file.startsWith(`${directory}/`)) throw new Error('Invalid path');
    const data = await readFile(file);
    const fileKey = key === '/' ? 'index.html' : key.slice(1);
    const policy = report.policies[fileKey] || (key.endsWith('.js') ? WORKER_POLICY : ASSET_POLICY);
    const mime = key === '/release.js' ? 'text/javascript' : key === '/release-manifest.json' ? 'application/json' : asset.type;
    response.writeHead(200, { ...headers, ...(report.documentHeaders?.[fileKey] || {}), 'Content-Type': `${mime}${mime.startsWith('text/') ? '; charset=utf-8' : ''}`, 'Content-Length': data.length, 'Content-Security-Policy': policy });
    response.end(request.method === 'HEAD' ? undefined : data);
  } catch { response.writeHead(400, { ...headers, 'Content-Security-Policy': ASSET_POLICY }); response.end('Bad request'); }
}).listen(4173, '127.0.0.1', () => console.log('Security preview ready at http://127.0.0.1:4173'));