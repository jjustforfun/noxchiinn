export const MAX_JSON_BYTES = 250000;
export const MAX_JSON_DEPTH = 14;
export const MAX_JSON_NODES = 20000;
const forbidden = new Set(['__proto__', 'prototype', 'constructor']);

/** Отличает обычный объект данных от массива, класса и изменённого прототипа. */
export function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/** Проверяет дерево итеративно: без рекурсивного переполнения стека и вызова getter. */
export function safeTree(value) {
  const pending = [{ value, depth: 0 }]; const seen = new Set(); let nodes = 0;
  while (pending.length) {
    const current = pending.pop();
    if (++nodes > MAX_JSON_NODES || current.depth > MAX_JSON_DEPTH) return false;
    const item = current.value;
    if (item === null || typeof item === 'boolean') continue;
    if (typeof item === 'string') { if (item.length > 8192) return false; continue; }
    if (typeof item === 'number') { if (!Number.isFinite(item)) return false; continue; }
    if ((!Array.isArray(item) && !record(item)) || seen.has(item)) return false;
    seen.add(item);
    const fields = Object.getOwnPropertyDescriptors(item);
    if (Array.isArray(item) && Object.keys(fields).length !== item.length + 1) return false;
    for (const key of Object.keys(fields)) {
      if (Array.isArray(item) && key === 'length') continue;
      if (forbidden.has(key) || !Object.hasOwn(fields[key], 'value') || key.length > 120) return false;
      pending.push({ value: fields[key].value, depth: current.depth + 1 });
    }
  }
  return true;
}

/** Разбирает ограниченный UTF-8 JSON, проверяя объём, глубину и небезопасные ключи. */
export function parseJSON(text, limit = MAX_JSON_BYTES) {
  if (typeof text !== 'string' || text.length > limit || new TextEncoder().encode(text).byteLength > limit) throw new Error('json-size');
  const value = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!safeTree(value)) throw new Error('json-structure');
  return value;
}

/** Проверяет локальный путь аудио до подстановки в URL браузера. */
export function audioLocation(value) { return typeof value === 'string' && !/[\r\n]/.test(value) && /^\/audio\/[a-z0-9-]{1,100}\.(mp3|ogg)$/.test(value); }

/** Ограничивает ссылки на источники HTTPS-адресами без credentials и управляющих символов. */
export function sourceLocation(value) {
  if (typeof value !== 'string' || value.length > 2000 || /[\u0000-\u0020\\]/.test(value)) return null;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password ? url.href : null; } catch { return null; }
}