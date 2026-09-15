import { MAX_JSON_BYTES, parseJSON, record } from './input.js';
import { SCHEMA_VERSION, validate } from './progress.js';
import { importedPreferences } from './preferences.js';
import { identity } from './round.js';

const supported = [1, 2, 3, SCHEMA_VERSION];

/** Проверяет файл до применения и никогда не меняет активный профиль сама. */
export async function inspectImport(file, now = Date.now()) {
  if (!file || !Number.isFinite(file.size) || file.size < 2 || file.size > MAX_JSON_BYTES || typeof file.text !== 'function') throw new Error('import-size');
  const value = parseJSON(await file.text());
  if (!record(value) || !supported.includes(value.version) || !Number.isFinite(value.xp) || !record(value.completed) || !Array.isArray(value.learned)) throw new Error('import-schema');
  if (value.name !== undefined && typeof value.name !== 'string') throw new Error('import-schema');
  const profile = validate(value, now);
  return { ...profile, generation: identity(), preferences: importedPreferences(profile.preferences, now) };
}

/** Экспортирует только разрешённые поля профиля, без содержимого резервной копии и сессии. */
export function exportProfile(profile, now = Date.now()) {
  const encoded = JSON.stringify(validate(profile, now), null, 2);
  if (new TextEncoder().encode(encoded).byteLength > MAX_JSON_BYTES) {
    const compact = JSON.stringify(validate(profile, now));
    if (new TextEncoder().encode(compact).byteLength > MAX_JSON_BYTES) throw new Error('export-size');
    return compact;
  }
  return encoded;
}