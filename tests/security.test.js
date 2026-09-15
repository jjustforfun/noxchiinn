import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseJSON, record, safeTree, MAX_JSON_BYTES, sourceLocation, audioLocation } from '../src/input.js';
import { defaults, readProgress, save, STORAGE_KEY, complete } from '../src/progress.js';
import { transaction, writeProgress } from '../src/store.js';
import { inspectImport, exportProfile } from '../src/transfer.js';
import { deliveryAllowed, reserveReminder } from '../src/reminders.js';
import { create, validateRound } from '../src/round.js';
import { integrity, sealHtml, verifySealed } from '../scripts/security-policy.mjs';
import { appClient, boundedBody, releaseManifest, verified } from '../src/secure-cache.js';

const now = new Date(2026, 8, 14, 18, 5).getTime();
const base = () => defaults(now);
function storage(value = null) {
  const values = new Map(value === null ? [] : [[STORAGE_KEY, typeof value === 'string' ? value : JSON.stringify(value)]]);
  const mock = { getItem: vi.fn((key) => values.get(key) ?? null), setItem: vi.fn((key, value) => values.set(key, value)), removeItem: vi.fn((key) => values.delete(key)) };
  vi.stubGlobal('localStorage', mock); return { ...mock, values };
}
function file(value) { const text = typeof value === 'string' ? value : JSON.stringify(value); return { size: new TextEncoder().encode(text).byteLength, text: async () => text }; }
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Граница недоверенного JSON', () => {
  it('принимает ограниченный обычный JSON', () => expect(parseJSON('{"version":4,"xp":12}')).toEqual({ version: 4, xp: 12 }));
  it('принимает UTF-8 BOM из сохранения редактора', () => expect(parseJSON('\uFEFF{"xp":1}').xp).toBe(1));
  it('проверяет байты, не только число символов', () => expect(() => parseJSON(`"${'я'.repeat(MAX_JSON_BYTES / 2)}"`)).toThrow('json-size'));
  it('отклоняет слишком глубокое дерево без рекурсии', () => expect(() => parseJSON('['.repeat(30) + '0' + ']'.repeat(30))).toThrow('json-structure'));
  it('не допускает prototype pollution ключи на любой глубине', () => {
    for (const key of ['__proto__', 'constructor', 'prototype']) expect(() => parseJSON(`{"nested":{"${key}":{}}}`)).toThrow('json-structure');
    expect({}.polluted).toBeUndefined();
  });
  it('не принимает NaN, Infinity, getter или циклическую ссылку', () => {
    const circular = {}; circular.self = circular; const getter = vi.fn();
    expect(safeTree(circular)).toBe(false); expect(safeTree({ value: Infinity })).toBe(false);
    const object = Object.defineProperty({}, 'field', { get: getter }); expect(safeTree(object)).toBe(false); expect(getter).not.toHaveBeenCalled();
  });
  it('не принимает разреженные массивы в восстановлении раунда', () => expect(safeTree(new Array(10))).toBe(false));
  it('отличает массив и экземпляр класса от записи данных', () => { expect(record([])).toBe(false); expect(record(new Date())).toBe(false); expect(record(Object.create(null))).toBe(true); });
  it('ограничивает число узлов дерева', () => expect(safeTree(Array.from({ length: 21000 }, () => 1))).toBe(false));
  it('принимает только HTTPS источники без credentials', () => { expect(sourceLocation('https://example.org/page')).toBe('https://example.org/page'); expect(sourceLocation('javascript:alert(1)')).toBe(null); expect(sourceLocation('https://user@example.org')).toBe(null); });
  it('не принимает traversal, внешний адрес и query в исходном audio path', () => { expect(audioLocation('/audio/a.mp3')).toBe(true); expect(audioLocation('/audio/../a.mp3')).toBe(false); expect(audioLocation('//evil.test/a.mp3')).toBe(false); expect(audioLocation('/audio/a.mp3?raw')).toBe(false); });
});

describe('Безопасный импорт и экспорт', () => {
  it('проверка файла не изменяет активный прогресс', async () => {
    const store = storage(base()); await inspectImport(file({ ...base(), xp: 99 }), now);
    expect(store.setItem).not.toHaveBeenCalled();
  });
  it('отклоняет файл до чтения, если размер превышен', async () => { const text = vi.fn(); await expect(inspectImport({ size: MAX_JSON_BYTES + 1, text })).rejects.toThrow('import-size'); expect(text).not.toHaveBeenCalled(); });
  it('отклоняет ошибочную структуру вместо сброса текущего профиля', async () => {
    for (const value of [null, [], { version: 4, xp: 20, completed: [], learned: [] }, { version: 999, xp: 20, completed: {}, learned: [] }]) await expect(inspectImport(file(value), now)).rejects.toThrow();
  });
  it('обнуляет согласие и создаёт новое поколение только кандидата', async () => {
    const profile = base(); profile.preferences.reminders.enabled = true; profile.preferences.reminders.consent = true;
    const candidate = await inspectImport(file(profile), now);
    expect(candidate.generation).not.toBe(profile.generation); expect(candidate.preferences.reminders.enabled).toBe(false); expect(candidate.preferences.reminders.consent).toBe(false);
  });
  it('экспорт не переносит произвольные секретные поля и сырой snapshot', () => {
    const exported = JSON.parse(exportProfile({ ...base(), password: 'secret', raw: 'snapshot' }, now));
    expect(exported.password).toBeUndefined(); expect(exported.raw).toBeUndefined();
  });
  it('отклоняет подмену честного размера файла после чтения', async () => { await expect(inspectImport({ size: 10, text: async () => ' '.repeat(MAX_JSON_BYTES + 1) }, now)).rejects.toThrow('json-size'); });
});

describe('Сохранение и параллельные вкладки', () => {
  it('не перезаписывает будущую схему при старте или изменении', () => {
    const store = storage({ version: 100, xp: 999 });
    expect(readProgress(now).status).toBe('future'); expect(save(base())).toBe(false);
    expect(transaction(base(), (state) => ({ ...state, xp: 1 }), { now }).status).toBe('future');
    expect(JSON.parse(store.values.get(STORAGE_KEY)).xp).toBe(999);
  });
  it('не перезаписывает слишком большой неизвестный snapshot', () => {
    const raw = ' '.repeat(MAX_JSON_BYTES + 1); const store = storage(raw);
    expect(readProgress(now).status).toBe('future'); expect(save(base())).toBe(false); expect(store.values.get(STORAGE_KEY)).toBe(raw);
  });
  it('первичная инициализация подхватывает другой уже сохранённый профиль', () => {
    storage({ ...base(), generation: 'another-tab', xp: 120 });
    expect(transaction(base(), (state) => state, { initialize: true, now }).profile).toMatchObject({ generation: 'another-tab', xp: 120 });
  });
  it('отклоняет старую операцию после импорта в другой вкладке', () => {
    storage({ ...base(), generation: 'another-tab', xp: 120 });
    const result = transaction(base(), (state) => ({ ...state, xp: state.xp + 4 }), { now });
    expect(result.status).toBe('changed'); expect(result.profile.xp).toBe(120);
  });
  it('изменение имени не возвращает старое включённое напоминание', () => {
    const stale = base(); stale.preferences.reminders.enabled = true; stale.preferences.reminders.consent = true;
    const fresh = { ...base(), updatedAt: now + 1 }; storage(fresh);
    const result = transaction(stale, (state) => ({ ...state, name: 'Лиса' }), { now: now + 2 });
    expect(result.profile.preferences.reminders.enabled).toBe(false);
  });
  it('не сбрасывает дневной ограничитель старой формой настроек', () => {
    const fresh = base(); fresh.preferences.reminders.lastAt = now; fresh.preferences.reminders.lastDay = fresh.dailyDate; storage(fresh);
    const result = transaction(fresh, (state) => ({ ...state, preferences: { ...state.preferences, reminders: { ...state.preferences.reminders, lastAt: 0, lastDay: null } } }), { now });
    expect(result.profile.preferences.reminders.lastAt).toBe(now);
  });
  it('явная замена не удаляет старый профиль, когда квота не позволяет записать новый', () => {
    const store = storage({ ...base(), xp: 20 }); store.setItem.mockImplementation(() => { throw new Error('quota'); });
    const result = transaction(base(), { ...base(), xp: 300, generation: 'imported' }, { now, replace: true });
    expect(result.ok).toBe(false); expect(result.profile.xp).toBe(20); expect(JSON.parse(store.values.get(STORAGE_KEY)).xp).toBe(20);
  });
  it('обнаруживает конкурентную запись через expectedRaw', () => { const store = storage(base()); const old = store.getItem(STORAGE_KEY); store.setItem(STORAGE_KEY, JSON.stringify({ ...base(), xp: 90 })); expect(save(base(), old)).toBe(false); });
  it('записывает только очищенные разрешённые поля', () => { const store = storage(); expect(save({ ...base(), unknown: 'ignored', hearts: -8 })).toBe(true); const saved = JSON.parse(store.values.get(STORAGE_KEY)); expect(saved.unknown).toBeUndefined(); expect(saved.hearts).toBeGreaterThanOrEqual(0); });
  it('использует общий Web Lock для записи', async () => {
    storage(base()); const request = vi.fn(async (_, options, callback) => callback()); vi.stubGlobal('navigator', { locks: { request } });
    expect((await writeProgress(base(), (state) => ({ ...state, xp: 4 }), { now })).ok).toBe(true); expect(request.mock.calls[0][0]).toBe('nohchiin-mott:progress-write');
  });
  it('не выдаёт награду за некорректный результат', () => {
    expect(complete(base(), null, now)).toMatchObject({ xp: 0 });
    expect(complete(base(), { lessonId: 'alphabet-1', total: 5, correct: Infinity, practice: false }, now).xp).toBe(0);
    expect(complete(base(), { lessonId: 'alphabet-1', total: 5, correct: 5, practice: false, mode: 'speed' }, now).xp).toBe(0);
  });
  it('не принимает укороченную поддельную практику', () => { const round = create('alphabet-1', base(), { practice: true, now }); round.questions = round.questions.slice(0, 1); expect(validateRound(round, base(), now)).toBe(null); });
});

describe('Отзыв согласия перед доставкой', () => {
  it('читает отключение из localStorage, а не старую копию вкладки', () => {
    const profile = base(); profile.preferences.reminders = { ...profile.preferences.reminders, enabled: true, consent: true };
    const store = storage(profile); const reserved = reserveReminder(profile, now);
    expect(deliveryAllowed(reserved, now)).toBe(true);
    const saved = JSON.parse(store.values.get(STORAGE_KEY)); saved.preferences.reminders.enabled = false; store.setItem(STORAGE_KEY, JSON.stringify(saved));
    expect(deliveryAllowed(reserved, now)).toBe(false);
  });
  it('не доставляет старое напоминание после смены поколения', () => {
    const profile = base(); profile.preferences.reminders = { ...profile.preferences.reminders, enabled: true, consent: true };
    const store = storage(profile); const reserved = reserveReminder(profile, now);
    store.setItem(STORAGE_KEY, JSON.stringify({ ...profile, generation: 'new-profile' })); expect(deliveryAllowed(reserved, now)).toBe(false);
  });
});

describe('CSP финального HTML', () => {
  const html = '<!doctype html><html><head><meta charset="UTF-8"><style>body{color:green}</style><script type="module">console.log("app")</script></head><body><div id="root"></div></body></html>';
  it('вычисляет известный SHA-256, не выдумывает хеш', () => expect(integrity('abc')).toBe('sha256-ungWv48Bz+pBQUDeXa4iI7ADYaOWF3qctBD/YfIAFa0='));
  it('разрешает только точные скрипты и стили', () => { const result = sealHtml(html); expect(verifySealed(result.html, result.policy)).toBe(true); expect(result.policy).not.toMatch(/unsafe-inline|unsafe-eval|nonce-/); });
  it('meta находится до исполняемого блока', () => { const result = sealHtml(html); expect(result.html.indexOf('http-equiv="Content-Security-Policy"')).toBeLessThan(result.html.indexOf('<script')); });
  it('изменение одного байта скрипта требует нового хеша', () => { const result = sealHtml(html); expect(verifySealed(result.html.replace('console.log("app")', 'console.log("other")'), result.policy)).toBe(false); });
  it('не подписывает повторно произвольный уже подписанный документ', () => expect(() => sealHtml(sealHtml(html).html)).toThrow());
  it('отклоняет непроверенный внешний скрипт', () => expect(() => sealHtml(html.replace('<script type="module">', '<script src="https://cdn.test/app.js">'))).toThrow());
});

describe('Целостность кэша и граница worker', () => {
  it('сверяет тело и размер с SHA-256', async () => {
    const response = new Response('abc', { headers: { 'Content-Type': 'text/plain' } });
    expect(await verified(response, { type: 'text/plain', bytes: 3, integrity: integrity('abc') })).toBe(true);
    expect(await verified(response, { type: 'text/plain', bytes: 3, integrity: integrity('abd') })).toBe(false);
  });
  it('не принимает HTML вместо MP3', async () => expect(await verified(new Response('abc', { headers: { 'Content-Type': 'text/html' } }), { bytes: 3, type: 'audio/mpeg', integrity: integrity('abc') })).toBe(false));
  it('обрывает слишком большой поток даже без Content-Length', async () => await expect(boundedBody(new Response('abcdef'), 3)).rejects.toThrow('response-size'));
  it('не принимает произвольное окно или другой origin для worker-команд', () => {
    expect(appClient({ type: 'window', url: 'https://app.test/#learn' }, 'https://app.test')).toBe(true);
    expect(appClient({ type: 'window', url: 'https://app.test/untrusted.html' }, 'https://app.test')).toBe(false);
    expect(appClient({ type: 'worker', url: 'https://app.test/' }, 'https://app.test')).toBe(false);
    expect(appClient({ type: 'window', url: 'https://other.test/' }, 'https://app.test')).toBe(false);
  });
  it('не принимает манифест выпуска с traversal или повторяющимися путями', () => {
    const asset = (url) => ({ url, bytes: 3, type: 'text/plain', integrity: integrity('abc') });
    const release = { version: 1, id: 'a'.repeat(30), worker: '/service-abc.js', assets: [asset('/'), asset('/offline.html'), asset('/service-abc.js')] };
    expect(releaseManifest(release)).toBe(release);
    expect(releaseManifest({ ...release, assets: [...release.assets, asset('/../file')] })).toBe(null);
    expect(releaseManifest({ ...release, assets: [...release.assets, asset('/')] })).toBe(null);
  });
});