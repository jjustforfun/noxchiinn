import { afterEach, describe, expect, it, vi } from 'vitest';
import { defaults, STORAGE_KEY } from '../src/progress.js';
import { transaction } from '../src/store.js';
import { verified } from '../src/secure-cache.js';
import { integrity } from '../scripts/security-policy.mjs';

const now = new Date(2026, 8, 20, 12).getTime();
afterEach(() => vi.unstubAllGlobals());

describe('Повторная ревизия этапов 1–5', () => {
  it('повторная инициализация не теряет более свежий прогресс, оставшийся в памяти после quota', () => {
    let raw = JSON.stringify(defaults(now));
    vi.stubGlobal('localStorage', { getItem: (key) => key === STORAGE_KEY ? raw : null, setItem: (_, value) => { raw = value; } });
    const memory = { ...defaults(now), xp: 24, updatedAt: now + 10 };
    const result = transaction(memory, (state) => state, { initialize: true, now: now + 20 });
    expect(result.ok).toBe(true); expect(result.profile.xp).toBe(24); expect(JSON.parse(raw).xp).toBe(24);
  });
  it('новое поколение другой вкладки всё равно важнее старой памяти', () => {
    const stored = { ...defaults(now), generation: 'new-profile', xp: 40 };
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(stored), setItem: vi.fn() });
    const memory = { ...defaults(now), xp: 90, updatedAt: now + 10 };
    expect(transaction(memory, (state) => state, { initialize: true, now: now + 20 }).profile.generation).toBe('new-profile');
  });
  it('text/xml не ломает SRI-кэш sitemap, если байты совпадают', async () => {
    const xml = '<?xml version="1.0"?><urlset/>';
    expect(await verified(new Response(xml, { headers: { 'Content-Type': 'text/xml' } }), { type: 'application/xml', bytes: new TextEncoder().encode(xml).length, integrity: integrity(xml) })).toBe(true);
  });
  it('HTML вместо sitemap отклоняется даже с той же контрольной суммой', async () => {
    const xml = '<urlset/>';
    expect(await verified(new Response(xml, { headers: { 'Content-Type': 'text/html' } }), { type: 'application/xml', bytes: xml.length, integrity: integrity(xml) })).toBe(false);
  });
});