import { cacheNames, clientsClaim, setCacheNameDetails } from 'workbox-core';
import { addPlugins, cleanupOutdatedCaches, getCacheKeyForURL, matchPrecache, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute, setCatchHandler } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { RangeRequestsPlugin } from 'workbox-range-requests';
import { letters, recorded } from './catalog.js';
import { landscape, landscapeFallback, vocabulary } from './assets.js';
import { audioPath, cacheable, digest } from './cache.js';
import manifestSource from '../public/manifest.webmanifest?raw';
import offlineSource from '../public/offline.html?raw';
import words from '../data/words.json';
import { openReminder } from './notification-worker.js';
import { releaseManifest, boundedBody, verified, appClient } from './secure-cache.js';
import site from '../data/site.json' with { type: 'json' };
import { fontFiles } from './fonts.js';

const PREFIX = 'nohchiin-mott';
const PAGES = `${PREFIX}-pages-v3`;
const MEDIA = `${PREFIX}-media-v3`;
const DATA = `${PREFIX}-data-v3`;
const META = `${PREFIX}-meta-v3`;
const origin = self.location.origin;
const release = releaseManifest(self.__NOHCHI_RELEASE__);
if (self.__NOHCHI_RELEASE__ && !release) throw new Error('Invalid release manifest');
const revision = release?.id || new URL(self.location.href).searchParams.get('module');
const manifest = JSON.parse(manifestSource);
const files = ['/', '/offline.html', '/manifest.webmanifest', '/icons/icon.svg', vocabulary, landscape, landscapeFallback, ...fontFiles, ...manifest.icons.map((item) => item.src)];
const audioItems = [...letters, words.daily].filter(recorded);
const assets = new Map((release?.assets || []).map((asset) => [asset.url, asset]));
const required = [...new Set(release ? release.assets.filter((asset) => !asset.url.startsWith('/audio/') && asset.url !== '/sw.js').map((asset) => asset.url) : files)];
const publicDocuments = new Set(['/', '/index.html', ...site.pages.map((page) => page.path)]);
const mediaPaths = new Set([...required.filter((url) => /\.(svg|png|webp|avif|jpe?g|woff2)$/.test(url)), ...audioItems.map((item) => audioPath(item))].map((url) => new URL(url, origin).pathname + new URL(url, origin).search));
const dataPaths = new Set((release?.assets || []).filter((asset) => asset.url.startsWith('/data/') && asset.type === 'application/json').map((asset) => asset.url));
let preparation = null;
let checking = null;

setCacheNameDetails({ prefix: PREFIX, suffix: 'v3' });
cleanupOutdatedCaches();

/** Проверяет, что сеть вернула приложение, а не ошибку или страницу авторизации. */
async function validShell(response) {
  if (release) return verified(response, assets.get('/'));
  if (!cacheable(response, 'html')) return false;
  try { return new TextDecoder().decode(await boundedBody(response.clone())).includes('name="application-name" content="Нохчийн Мотт"'); } catch { return false; }
}

/** Не принимает HTML-заглушку хостинга за иконку или manifest. */
async function validAsset(url, response) {
  const path = new URL(url, origin).pathname;
  if (release) return verified(response, assets.get(path));
  if (path === '/') return validShell(response);
  if (path === '/offline.html') return cacheable(response, 'html') && (await response.clone().text()).includes('Нохчийн Мотт');
  if (path === '/manifest.webmanifest') {
    if (response.status !== 200 || response.redirected) return false;
    try { const value = await response.clone().json(); return value.id === '/' && value.display === 'standalone' && Array.isArray(value.icons); } catch { return false; }
  }
  return cacheable(response, 'media');
}

const pageStrategy = new NetworkFirst({
  cacheName: PAGES,
  networkTimeoutSeconds: 3,
  fetchOptions: { cache: 'no-cache' },
  plugins: [{
    cacheKeyWillBeUsed: async () => new Request(`${origin}/`),
    requestWillFetch: async ({ request }) => new Request(request, { cache: 'no-cache' }),
    fetchDidSucceed: async ({ response }) => { if (!await validShell(response)) throw new Error('invalid-shell'); return response; },
    cacheWillUpdate: async ({ response }) => await validShell(response) ? response : null,
  }],
});

// Онлайн-навигация обнаруживает обновление HTML, даже если код worker не менялся.
registerRoute(new NavigationRoute(async (context) => {
  if (release) {
    const pathname = new URL(context.request.url).pathname;
    const key = pathname === '/index.html' ? '/' : pathname;
    const response = await matchPrecache(key);
    if (await verified(response, assets.get(key))) return response;
    return (await matchPrecache('/offline.html')) || Response.error();
  }
  try { return await pageStrategy.handle(context); }
  catch { return (await matchPrecache('/')) || (await matchPrecache('/offline.html')) || Response.error(); }
}, { allowlist: [/^\/(?:index\.html)?(?:\?.*)?$/, /^\/(?:about|privacy|sources)\.html(?:\?.*)?$/] }));

addPlugins([{
  cacheWillUpdate: async ({ request, response }) => await validAsset(request.url, response) ? response : null,
  cachedResponseWillBeUsed: async ({ request, cachedResponse }) => !release || !cachedResponse ? cachedResponse : await validAsset(request.url, cachedResponse) ? cachedResponse : null,
}]);
precacheAndRoute(required.map((url) => ({ url, revision, ...(assets.has(url) ? { integrity: assets.get(url).integrity } : {}) })), { ignoreURLParametersMatching: [/^utm_/, /^source$/, /^fbclid$/] });

// Данные уроков сейчас уже встроены в HTML; маршрут готов для отдельных JSON следующего этапа.
registerRoute(({ url }) => url.origin === origin && !url.search && dataPaths.has(url.pathname), new StaleWhileRevalidate({
  cacheName: DATA,
  plugins: [{ cacheWillUpdate: async ({ request, response }) => cacheable(response, 'json') && await validAsset(request.url, response) ? response : null }],
}));

registerRoute(({ url }) => url.origin === origin && mediaPaths.has(url.pathname + url.search), new CacheFirst({
  cacheName: MEDIA,
  plugins: [{
    cacheWillUpdate: async ({ request, response }) => cacheable(response, new URL(request.url).pathname.startsWith('/audio/') ? 'audio' : 'media') && (!release || await validAsset(request.url, response)) ? response : null,
    cachedResponseWillBeUsed: async ({ request, cachedResponse }) => !release || !cachedResponse ? cachedResponse : await validAsset(request.url, cachedResponse) ? cachedResponse : null,
  }, new RangeRequestsPlugin()],
}));

setCatchHandler(async ({ request }) => request.mode === 'navigate' ? (await matchPrecache('/offline.html')) || Response.error() : Response.error());

/** Сохраняет только полные согласованные записи, поддерживая Range-запросы Safari. */
async function prepareAudio() {
  const cache = await caches.open(MEDIA);
  const deadline = Date.now() + 40000;
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(4, audioItems.length) }, async () => {
    while (cursor < audioItems.length && Date.now() < deadline) {
      const item = audioItems[cursor++];
      const path = audioPath(item);
      const cached = await cache.match(path);
      if (cached && (!release || await verified(cached, assets.get(new URL(path, origin).pathname)))) continue;
      if (cached) await cache.delete(path);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), Math.min(8000, deadline - Date.now()));
      try {
        const expected = assets.get(new URL(path, origin).pathname);
        const response = await fetch(path, { signal: controller.signal, cache: 'no-cache', redirect: 'error', ...(expected ? { integrity: expected.integrity } : {}) });
        if (cacheable(response, 'audio') && (!release || await verified(response, expected))) await cache.put(path, response);
      } catch { /* Один недоступный файл не блокирует офлайн-алфавит. */ }
      finally { clearTimeout(timer); }
    }
  }));
}

/** Восстанавливает недостающие ресурсы, если браузер очистил часть кэша. */
async function repair() {
  const cache = await caches.open(cacheNames.precache);
  await Promise.all(required.map(async (url) => {
    const key = getCacheKeyForURL(url);
    if (!key) return;
    const cached = await cache.match(key);
    if (cached && await validAsset(url, cached)) return;
    if (cached) await cache.delete(key);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const expected = assets.get(new URL(url, origin).pathname);
      const response = await fetch(url, { cache: 'reload', signal: controller.signal, redirect: 'error', ...(expected ? { integrity: expected.integrity } : {}) });
      if (await validAsset(url, response)) await cache.put(key, response);
    } catch { /* Готовность будет заново вычислена по фактическим файлам. */ }
    finally { clearTimeout(timer); }
  }));
}

/** Проверяет реальные записи кэша вместо предположения «worker активен, значит всё готово». */
async function status() {
  const pages = await caches.open(PAGES);
  const shell = await pages.match(`${origin}/`) || await matchPrecache('/');
  const media = await caches.open(MEDIA);
  const stored = await Promise.all(audioItems.map((item) => media.match(audioPath(item))));
  const audioValid = await Promise.all(stored.map((response, index) => !response ? false : release ? verified(response, assets.get(new URL(audioPath(audioItems[index]), origin).pathname)) : cacheable(response, 'audio')));
  const cachedAssets = await Promise.all(required.filter((url) => url !== '/').map((url) => matchPrecache(url)));
  const valid = await Promise.all(required.filter((url) => url !== '/').map((url, index) => cachedAssets[index] ? validAsset(url, cachedAssets[index]) : false));
  return { protocol: 2, ready: Boolean(await validShell(release ? await matchPrecache('/') : shell) && valid.every(Boolean)), audioReady: audioValid.filter(Boolean).length, audioTotal: audioItems.length, revision, integrity: Boolean(release) };
}

/** Проверяет свежий HTML и атомарно сохраняет новый снимок для следующего открытия. */
async function check() {
  const pages = await caches.open(PAGES);
  const old = await pages.match(`${origin}/`) || await matchPrecache('/');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    if (release) {
      const response = await fetch('/release-manifest.json', { cache: 'no-store', signal: controller.signal, redirect: 'error' });
      if (!cacheable(response, 'json')) throw new Error('invalid-release-response');
      const candidate = releaseManifest(JSON.parse(new TextDecoder().decode(await boundedBody(response, 150000))));
      if (!candidate) throw new Error('invalid-release');
      return { ...await status(), changed: candidate.id !== release.id };
    }
    const response = await fetch(`${origin}/`, { cache: 'no-store', signal: controller.signal, redirect: 'error' });
    if (!await validShell(response)) throw new Error('invalid-shell');
    const hash = await digest(await response.clone().arrayBuffer());
    const oldHash = old ? await digest(await old.arrayBuffer()) : null;
    await pages.put(`${origin}/`, response);
    const metadata = await caches.open(META);
    await metadata.put(`${origin}/__app_snapshot`, Response.json({ hash }));
    return { ...await status(), changed: Boolean(oldHash && oldHash !== hash) };
  } finally { clearTimeout(timer); }
}

self.addEventListener('install', (event) => {
  preparation = prepareAudio().catch(() => undefined).finally(() => { preparation = null; });
  event.waitUntil(preparation);
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const pages = await caches.open(PAGES);
    if (!await pages.match(`${origin}/`)) {
      const shell = await matchPrecache('/');
      if (shell) await pages.put(`${origin}/`, shell);
    }
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => [`${PREFIX}-pages-v2`, `${PREFIX}-media-v2`, `${PREFIX}-data-v2`, `${PREFIX}-meta-v2`, `${PREFIX}-precache-v2-stage1-v1`].includes(key)).map((key) => caches.delete(key)));
    const media = await caches.open(MEDIA);
    await Promise.all((await media.keys()).filter((request) => { const url = new URL(request.url); return !mediaPaths.has(url.pathname + url.search); }).map((request) => media.delete(request)));
    // Содержимое fallback входит в код worker, поэтому его изменение обновляет хеш сборки.
    if (!offlineSource.includes('Нохчийн Мотт')) throw new Error('invalid-offline-page');
  })());
});

self.addEventListener('message', (event) => {
  const type = event.data?.type;
  if (!['STATUS', 'CHECK_UPDATE', 'PREPARE_AUDIO', 'SKIP_WAITING'].includes(type)) return;
  event.waitUntil((async () => {
    try {
      const client = event.source?.id ? await self.clients.get(event.source.id) : null;
      if (!appClient(client, origin)) return;
      if (type === 'SKIP_WAITING') {
        const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        if (windows.filter((window) => { try { const url = new URL(window.url); return url.origin === origin && publicDocuments.has(url.pathname); } catch { return false; } }).length > 1) { event.ports[0]?.postMessage({ protocol: 2, blocked: true }); return; }
        event.ports[0]?.postMessage({ protocol: 2, applied: true }); await self.skipWaiting(); return;
      }
      if (type === 'PREPARE_AUDIO') {
        if (!preparation) preparation = (async () => { await repair(); await prepareAudio(); })().finally(() => { preparation = null; });
        await preparation;
      }
      if (type === 'CHECK_UPDATE' && !checking) checking = check().finally(() => { checking = null; });
      const result = type === 'CHECK_UPDATE' ? await checking : await status();
      event.ports[0]?.postMessage(result);
    } catch { event.ports[0]?.postMessage({ protocol: 2, error: true, message: 'Не удалось подготовить обновление. Сохранённые уроки остаются доступны.' }); }
  })());
});

clientsClaim();

// Нет push-подписки или фонового таймера: уведомление создаётся из открытой страницы.
self.addEventListener('notificationclick', (event) => { event.waitUntil(openReminder(event, self.clients, origin)); });