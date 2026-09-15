/** Проверяет ответ перед сохранением, не кэшируя HTML вместо аудиофайла. */
export function cacheable(response, type) {
  if (!response || response.status !== 200 || response.type === 'opaque' || response.redirected) return false;
  const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type === 'html') return mime === 'text/html';
  if (type === 'audio') return mime.startsWith('audio/');
  if (type === 'json') return mime === 'application/json';
  return /^(image|font)\//.test(mime);
}

/** Нормализует адрес главной страницы для единого офлайн-снимка. */
export function shellPath(url) {
  return url.pathname === '/' || url.pathname === '/index.html';
}

/** Строит версионированный адрес записи, не меняя её путь в JSON. */
export function audioPath(item) {
  const revision = item.recording?.revision;
  return typeof revision === 'string' && revision ? `${item.audio}?v=${encodeURIComponent(revision.slice(0, 100))}` : item.audio;
}

/** Получает SHA-256 для сравнения двух локальных снимков, не заменяя HTTPS. */
export async function digest(content) {
  const buffer = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, '0')).join('');
}