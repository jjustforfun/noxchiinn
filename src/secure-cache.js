/** Принимает только ограниченный перечень ресурсов собственного статического выпуска. */
export function releaseManifest(value) {
  if (!value || value.version !== 1 || typeof value.id !== 'string' || !/^[a-zA-Z0-9]{20,100}$/.test(value.id) || typeof value.worker !== 'string' || /\s/.test(value.worker) || !/^\/service-[a-zA-Z0-9_-]+\.js$/.test(value.worker)) return null;
  if (!Array.isArray(value.assets) || value.assets.length < 3 || value.assets.length > 600) return null;
  const seen = new Set();
  for (const asset of value.assets) {
    if (!asset || typeof asset.url !== 'string' || asset.url.length > 240 || /\s/.test(asset.url) || !/^\/(?:[a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_.-]*$/.test(asset.url) || asset.url.includes('..') || asset.url.includes('//') || seen.has(asset.url)) return null;
    if (!/^sha256-[a-zA-Z0-9+/]{43}=$/.test(asset.integrity) || !Number.isSafeInteger(asset.bytes) || asset.bytes <= 0 || asset.bytes > 8 * 1024 * 1024 || typeof asset.type !== 'string' || asset.type.length > 60) return null;
    seen.add(asset.url);
  }
  return seen.has('/') && seen.has('/offline.html') && seen.has(value.worker) ? value : null;
}

/** Читает ответ с ограничением размера и времени, включая медленный поток тела. */
export async function boundedBody(response, limit = 2 * 1024 * 1024, timeout = 10000) {
  const length = Number(response.headers.get('content-length'));
  if (!response.headers.get('content-encoding') && Number.isFinite(length) && length > limit) throw new Error('response-size');
  const reader = response.body?.getReader();
  if (!reader) return new Uint8Array();
  let timer; let total = 0; const chunks = [];
  try {
    return await Promise.race([
      (async () => {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          total += value.byteLength;
          if (total > limit) throw new Error('response-size');
          chunks.push(value);
        }
        const bytes = new Uint8Array(total); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        return bytes;
      })(),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('response-timeout')), timeout); }),
    ]);
  } finally { clearTimeout(timer); void reader.cancel().catch(() => undefined); }
}

/** Проверяет тело ресурса по SHA-256 выпуска. Это защита целостности, не подпись владельца. */
export async function verified(response, asset) {
  if (!response || !asset || response.status !== 200 || response.redirected || response.type === 'opaque') return false;
  const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const equivalent = asset.type === 'text/javascript' && ['application/javascript', 'text/javascript'].includes(type) || asset.type === 'application/manifest+json' && type === 'application/json' || asset.type === 'application/xml' && type === 'text/xml' || asset.type === 'font/woff2' && type === 'application/font-woff2';
  if (type !== asset.type && !equivalent) return false;
  try {
    const bytes = await boundedBody(response.clone(), asset.bytes);
    if (bytes.byteLength !== asset.bytes) return false;
    const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
    return `sha256-${btoa(String.fromCharCode(...hash))}` === asset.integrity;
  } catch { return false; }
}

/** Разрешает worker-команду только собственному окну приложения, а не произвольному client. */
export function appClient(client, origin) {
  if (!client || client.type !== 'window' || typeof client.url !== 'string') return false;
  try { const url = new URL(client.url); return url.origin === origin && ['/', '/index.html'].includes(url.pathname) && !url.username && !url.password; } catch { return false; }
}