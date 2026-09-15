import { PROGRESS_LOCK, readProgress, save, validate } from './progress.js';

/** Выполняет одну проверяемую запись поверх свежего профиля, не доверяя старой вкладке. */
export function transaction(fallback, action, { expectedGeneration = fallback.generation, replace = false, initialize = false, now = Date.now() } = {}) {
  const snapshot = readProgress(now);
  if (snapshot.status === 'future') return { ok: false, status: 'future', profile: fallback };
  const stored = snapshot.status === 'ready' ? snapshot.profile : null;
  const base = stored && (initialize || stored.generation !== fallback.generation || stored.updatedAt >= fallback.updatedAt) ? stored : fallback;
  if (stored && !initialize && stored.generation !== expectedGeneration) return { ok: false, status: 'changed', profile: base };
  if (initialize && stored) {
    const profile = fallback.generation === stored.generation && fallback.updatedAt > stored.updatedAt ? fallback : stored;
    const ok = save(profile, snapshot.raw);
    return { ok, status: ok ? 'ready' : 'memory', profile };
  }
  try {
    const next = typeof action === 'function' ? action(base) : action;
    if (!next || (!replace && next.generation !== base.generation)) return { ok: false, status: 'changed', profile: base };
    const clean = validate({ ...next, updatedAt: Math.max(now, base.updatedAt + 1) }, now + 1);
    if (!replace && base.preferences.reminders.lastAt > clean.preferences.reminders.lastAt) {
      clean.preferences.reminders.lastAt = base.preferences.reminders.lastAt;
      clean.preferences.reminders.lastDay = base.preferences.reminders.lastDay;
    }
    if (snapshot.status === 'unavailable') return { ok: false, status: 'memory', profile: replace ? base : clean };
    if (!save(clean, snapshot.raw)) {
      const latest = readProgress(now);
      if (latest.status === 'future') return { ok: false, status: 'future', profile: base };
      if (latest.raw !== snapshot.raw) return { ok: false, status: 'changed', profile: latest.profile };
      return { ok: false, status: 'memory', profile: replace ? base : clean };
    }
    return { ok: true, status: snapshot.status === 'corrupt' ? 'recovered' : 'ready', profile: clean };
  } catch { return { ok: false, status: 'invalid', profile: base }; }
}

/**
 * Согласует записи всех вкладок одним Web Lock; без него сохраняет проверку свежего снимка.
 * @param {object} fallback Текущее состояние вкладки.
 * @param {object | ((state: any) => any)} action Изменение профиля.
 * @param {{expectedGeneration?: string, replace?: boolean, initialize?: boolean, now?: number}} [options] Ограничения записи.
 */
export async function writeProgress(fallback, action, options = {}) {
  const commit = () => transaction(fallback, action, options);
  if (typeof navigator === 'undefined' || !navigator.locks?.request) return commit();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try { return await navigator.locks.request(PROGRESS_LOCK, { signal: controller.signal }, commit); }
  catch { return { ok: false, status: 'busy', profile: fallback }; }
  finally { clearTimeout(timer); }
}