import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve, relative, extname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { integrity, sealHtml, verifySealed, SECURITY_HEADERS, WORKER_POLICY, ASSET_POLICY } from './security-policy.mjs';
import { documentHeaders, documentRoutes } from './route-policy.mjs';

const root = resolve(import.meta.dirname, '..');
const allowedTypes = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.avif': 'image/avif', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.xml': 'application/xml', '.txt': 'text/plain' };

/** Подготавливает уже существующий dist: не запускает сборку и не меняет исходную конфигурацию Vite. */
export async function harden(directory = resolve(root, 'dist'), vercel = false) {
  const policies = {};
  const robots = {};
  const robotsTag = (html) => html.match(/<meta\s+name="robots"\s+content="([^"]+)"/i)?.[1] || 'noindex, nofollow';
  for (const name of ['index.html', 'offline.html']) {
    const file = resolve(directory, name);
    const sealed = sealHtml(await readFile(file, 'utf8'));
    if (!verifySealed(sealed.html, sealed.policy)) throw new Error('CSP verification failed');
    if (name === 'index.html' && (!sealed.scriptHashes.length || sealed.html.includes('/@vite/client'))) throw new Error('Not a production build');
    policies[name] = sealed.policy;
    robots[name] = robotsTag(sealed.html);
    await writeFile(file, sealed.html);
  }
  const assets = [];
  async function visit(path) {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      if (entry.isSymbolicLink()) throw new Error('Symlinks are not allowed in public output');
      const full = resolve(path, entry.name);
      if (entry.isDirectory()) { await visit(full); continue; }
      const name = relative(directory, full).replaceAll('\\', '/');
      if (['_headers', '.htaccess', 'release.js', 'release-manifest.json'].includes(name)) continue;
      if (name.endsWith('.md')) { await rm(full); continue; }
      if (name.split('/').some((part) => part.startsWith('.')) || !allowedTypes[extname(name)]) throw new Error(`Unreviewed public asset: ${name}`);
      let data = await readFile(full);
      if (name.endsWith('.html') && !policies[name]) {
        const sealed = sealHtml(data.toString('utf8'));
        if (!verifySealed(sealed.html, sealed.policy)) throw new Error(`Invalid CSP in ${name}`);
        policies[name] = sealed.policy; data = Buffer.from(sealed.html); await writeFile(full, data);
        robots[name] = robotsTag(sealed.html);
      }
      if (data.length > 8 * 1024 * 1024) throw new Error(`Asset exceeds 8MB: ${name}`);
      assets.push({ url: name === 'index.html' ? '/' : `/${name}`, integrity: integrity(data), bytes: data.length, type: allowedTypes[extname(name)] });
    }
  }
  await visit(directory);
  const worker = assets.find((asset) => /^\/service-[a-zA-Z0-9_-]+\.js$/.test(asset.url));
  if (!worker) throw new Error('Missing local Workbox bundle');
  const release = { version: 1, id: integrity(JSON.stringify(assets.sort((a, b) => a.url.localeCompare(b.url)))).slice(7).replace(/[+/=]/g, ''), worker: worker.url, assets };
  await writeFile(resolve(directory, 'release.js'), `/* Generated from final production bytes. */\nself.__NOHCHI_RELEASE__ = ${JSON.stringify(release)};\n`);
  await writeFile(resolve(directory, 'release-manifest.json'), `${JSON.stringify(release, null, 2)}\n`);

  const common = Object.entries(SECURITY_HEADERS).map(([key, value]) => `  ${key}: ${value}`).join('\n');
  const htmlHeaders = documentHeaders(policies, robots);
  const pageHeaderText = Object.entries(htmlHeaders).flatMap(([file, headers]) => (file === 'index.html' ? ['/', '/index.html'] : [`/${file}`]).map((url) => `${url}\n${Object.entries(headers).map(([key, value]) => `  ${key}: ${value}`).join('\n')}`)).join('\n\n');
  const headerText = `/*\n${common}\n\n${pageHeaderText}\n\n/sw.js\n  Content-Security-Policy: ${WORKER_POLICY}\n  Cache-Control: no-cache\n\n/release.js\n  Cache-Control: no-cache\n\n/release-manifest.json\n  Cache-Control: no-cache\n\n/*.svg\n  Content-Security-Policy: ${ASSET_POLICY}\n\n/icons/*\n  Content-Security-Policy: ${ASSET_POLICY}\n`;
  await writeFile(resolve(directory, '_headers'), headerText);
  const apachePages = Object.entries(htmlHeaders).map(([file, headers]) => {
    if (file.includes('/')) throw new Error('Nested HTML requires directory-scoped Apache configuration');
    return `<Files "${file}">\n${Object.entries(headers).map(([key, value]) => `Header always set ${key} "${value}"`).join('\n')}\n</Files>`;
  }).join('\n');
  await writeFile(resolve(directory, '.htaccess'), `<IfModule mod_headers.c>\n${Object.entries(SECURITY_HEADERS).map(([key, value]) => `Header always set ${key} "${value}"`).join('\n')}\n${apachePages}\n<Files "sw.js">\nHeader always set Content-Security-Policy "${WORKER_POLICY}"\n</Files>\n<FilesMatch "^(sw\\.js|release\\.js|release-manifest\\.json)$">\nHeader always set Cache-Control "no-cache"\n</FilesMatch>\n<FilesMatch "\\.svg$">\nHeader always set Content-Security-Policy "${ASSET_POLICY}"\n</FilesMatch>\n</IfModule>\nOptions -Indexes\nDirectoryIndex index.html\nErrorDocument 404 /404.html\n`);

  if (vercel) {
    const output = resolve(root, '.vercel/output');
    await mkdir(output, { recursive: true });
    await rm(resolve(output, 'static'), { recursive: true, force: true });
    await cp(directory, resolve(output, 'static'), { recursive: true });
    await rm(resolve(output, 'static/.htaccess'), { force: true });
    await rm(resolve(output, 'static/_headers'), { force: true });
    const routes = [
      { src: '/(.*)', headers: SECURITY_HEADERS, continue: true },
      ...documentRoutes(htmlHeaders),
      { src: '^/sw\\.js$', headers: { 'Content-Security-Policy': WORKER_POLICY, 'Cache-Control': 'no-cache' }, continue: true },
      { src: '^/release(?:\\.js|-manifest\\.json)$', headers: { 'Cache-Control': 'no-cache' }, continue: true },
      { src: '^/(.*)\\.svg$', headers: { 'Content-Security-Policy': ASSET_POLICY }, continue: true },
      { handle: 'filesystem' },
      { src: '/(.*)', status: 404, ...(policies['404.html'] ? { dest: '/404.html', headers: htmlHeaders['404.html'] } : {}) },
    ];
    await writeFile(resolve(output, 'config.json'), JSON.stringify({ version: 3, routes, overrides: { 'manifest.webmanifest': { contentType: 'application/manifest+json' }, 'sw.js': { contentType: 'text/javascript' } } }, null, 2));
  }
  await mkdir(resolve(root, 'docs'), { recursive: true });
  const report = { release: release.id, generatedAt: new Date().toISOString(), files: assets.length, strictScriptCsp: true, strictStyleCsp: true, policies, documentHeaders: htmlHeaders, browserVerified: false };
  await writeFile(resolve(root, 'docs/release-security.json'), JSON.stringify(report, null, 2));
  console.log(`Sealed ${assets.length} local assets. CSP hashes verified against final HTML. Browser audit is still required.`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await stat(resolve(root, 'dist/index.html')); await harden(resolve(root, 'dist'), process.argv.includes('--vercel')); }
  catch (error) { console.error('Secure release preparation failed:', error.message); process.exitCode = 1; }
}