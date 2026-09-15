import { lessons, letterIds, unlocked, gameModes } from './catalog.js';
import { day, validDay, shift, longest } from './calendar.js';
import { cleanPreferences, preferenceDefaults } from './preferences.js';
import { cleanDays, cleanHistory, recordActivity } from './statistics.js';
import { MAX_JSON_BYTES, parseJSON, record } from './input.js';
export { shuffle } from './round.js';
export { day } from './calendar.js';

export const STORAGE_KEY = 'nohchiin-mott:progress';
export const MAX_SAVE_SIZE = MAX_JSON_BYTES;
export const PROGRESS_LOCK = 'nohchiin-mott:progress-write';
export const MAX_HEARTS = 5;
export const HEART_INTERVAL = 30 * 60 * 1000;
export const SCHEMA_VERSION = 4;

/** Создаёт пустой профиль без персональных данных. */
export function defaults(now = Date.now()) {
  return { version: SCHEMA_VERSION, generation: String(now), updatedAt: now, name: 'друг', age: '5-8', avatar: 'wolf', xp: 0, hearts: MAX_HEARTS, heartUpdated: now, streak: 0, lastPlayed: null, lastLogin: day(new Date(now)), dailyXP: 0, dailyDate: day(new Date(now)), completed: {}, learned: [], sessions: 0, practiceDays: [], rewardedRounds: [], spentAttempts: [], bestStreak: 0, preferences: preferenceDefaults(), activity: {}, history: [], historySince: null };
}

/** Очищает локальное имя от управляющих знаков и разметки. */
export function cleanName(value) {
  if (typeof value !== 'string') return '';
  const clean = value.slice(0, 1024).normalize('NFC').replace(/[<>\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim();
  return Array.from(clean).slice(0, 24).join('');
}

/** Ограничивает числовые значения из недоверенного хранилища. */
export function bounded(value, min, max, fallback = min) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;
}

/** Переносит сохранение этапа 1 в новую схему без потери XP и пройденных уроков. */
export function migrate(value) {
  if (!record(value) || !Object.hasOwn(value, 'version')) return null;
  if ([1, 2, 3].includes(value.version)) {
    return { ...value, version: SCHEMA_VERSION,
      ...(value.version === 1 ? { generation: 'legacy-v1', rewardedRounds: [], spentAttempts: [] } : {}),
      bestStreak: bounded(value.streak, 0, 10000), preferences: preferenceDefaults(), activity: {}, history: [], historySince: null,
    };
  }
  return value.version === SCHEMA_VERSION ? value : null;
}

/** Валидирует и восстанавливает сохранение; неизвестную версию не интерпретирует. */
export function validate(value, now = Date.now()) {
  const base = defaults(now);
  value = migrate(value);
  if (!value) return base;
  // При перелёте назад через полночь вчерашняя запись может оказаться «завтра».
  const validDate = (date) => validDay(date) && date <= shift(day(new Date(now)), 1);
  const completed = {};
  if (record(value.completed)) {
    for (const item of lessons) {
      const result = Object.hasOwn(value.completed, item.id) ? value.completed[item.id] : null;
      if (record(result) && Number.isFinite(result.stars) && result.stars >= 1) {
        const total = bounded(result.total, 1, 49, 5);
        const correct = bounded(result.correct, 0, total);
        const measured = score(correct, total);
        if (measured.passed) completed[item.id] = { stars: Math.min(bounded(result.stars, 1, 3), measured.stars), correct, total, mode: gameModes.some((mode) => mode.id === result.mode) ? result.mode : 'visual' };
      }
    }
  }
  return refresh({
    ...base,
    generation: typeof value.generation === 'string' && /^[a-zA-Z0-9-]{1,90}$/.test(value.generation) ? value.generation : base.generation,
    updatedAt: bounded(value.updatedAt, 0, now + 1000, now),
    name: cleanName(value.name) || base.name,
    age: value.age === '9+' ? '9+' : '5-8',
    avatar: ['wolf', 'sun', 'mountain'].includes(value.avatar) ? value.avatar : 'wolf',
    xp: bounded(value.xp, 0, 1000000),
    hearts: bounded(value.hearts, 0, MAX_HEARTS, MAX_HEARTS),
    heartUpdated: bounded(value.heartUpdated, 0, now, now),
    streak: bounded(value.streak, 0, 10000),
    lastPlayed: validDate(value.lastPlayed) ? value.lastPlayed : null,
    dailyDate: validDate(value.dailyDate) ? value.dailyDate : base.dailyDate,
    dailyXP: bounded(value.dailyXP, 0, 100000),
    completed,
    learned: Array.isArray(value.learned) ? [...new Set(value.learned.filter((id) => typeof id === 'string' && letterIds.has(id)))].slice(0, letterIds.size) : [],
    sessions: bounded(value.sessions, 0, 100000),
    practiceDays: Array.isArray(value.practiceDays) ? [...new Set(value.practiceDays.filter(validDate))].sort().slice(-366) : [],
    rewardedRounds: Array.isArray(value.rewardedRounds) ? [...new Set(value.rewardedRounds.filter((id) => typeof id === 'string' && /^[a-zA-Z0-9-]{8,90}$/.test(id)))].slice(-256) : [],
    spentAttempts: Array.isArray(value.spentAttempts) ? [...new Set(value.spentAttempts.filter((id) => typeof id === 'string' && /^[a-zA-Z0-9-]{8,90}:\d{1,2}$/.test(id)))].slice(-256) : [],
    bestStreak: bounded(value.bestStreak, 0, 10000),
    preferences: cleanPreferences(value.preferences, now),
    activity: cleanDays(value.activity, now),
    history: cleanHistory(value.history, now),
    historySince: validDate(value.historySince) ? value.historySince : null,
  }, now);
}

/** Восстанавливает сердечки по таймеру и обнуляет устаревшую серию. */
export function refresh(state, now = Date.now()) {
  const today = day(new Date(now));
  const anchor = Math.min(state.heartUpdated, now);
  const elapsed = Math.max(0, now - anchor);
  const recovered = Math.floor(elapsed / HEART_INTERVAL);
  const hearts = Math.min(MAX_HEARTS, state.hearts + recovered);
  return {
    ...state, hearts,
    heartUpdated: hearts === MAX_HEARTS ? now : anchor + recovered * HEART_INTERVAL,
    streak: validDay(state.lastPlayed) && state.lastPlayed >= shift(today, -1) && state.lastPlayed <= shift(today, 1) ? Math.max(1, state.streak) : 0,
    bestStreak: Math.max(state.bestStreak || 0, validDay(state.lastPlayed) ? state.streak : 0, longest(state.practiceDays)),
    dailyDate: today,
    dailyXP: state.dailyDate === today ? state.dailyXP : state.activity?.[today]?.xp || 0,
    lastLogin: today,
  };
}

/** Безопасно читает localStorage, сохраняя приложение рабочим при его недоступности. */
export function load() {
  return readProgress().profile;
}

/** Читает профиль вместе со статусом; будущая схема и запрет хранилища различаются. */
export function readProgress(now = Date.now()) {
  let raw = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return { status: 'empty', raw, profile: defaults(now) };
    if (raw.length > MAX_SAVE_SIZE || new TextEncoder().encode(raw).byteLength > MAX_SAVE_SIZE) return { status: 'future', raw, profile: defaults(now) };
    const parsed = parseJSON(raw);
    if (!record(parsed) || !Number.isInteger(parsed.version)) throw new Error('invalid-profile');
    if (![1, 2, 3, SCHEMA_VERSION].includes(parsed.version)) {
      backup(raw);
      return { status: 'future', raw, profile: defaults(now) };
    }
    return { status: 'ready', raw, profile: validate(parsed, now) };
  } catch {
    if (raw !== null) backup(raw);
    return { status: raw === null ? 'unavailable' : 'corrupt', raw, profile: defaults(now) };
  }
}

/** Сохраняет одну ограниченную резервную копию; её содержимое не попадает в журналы или UI. */
function backup(raw) {
  try { localStorage.setItem(`${STORAGE_KEY}:recovery`, raw.slice(0, MAX_SAVE_SIZE)); } catch { /* Режим без сохранения остаётся доступным. */ }
}

/**
 * Записывает только разрешённые поля и не перезаписывает неизвестную версию или новый снимок.
 * @param {object} state Проверенный профиль.
 * @param {string | null} [expectedRaw] Снимок для обнаружения конкурентной записи.
 */
export function save(state, expectedRaw = undefined) {
  try {
    if (!record(state) || state.version !== SCHEMA_VERSION) return false;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (expectedRaw !== undefined && raw !== expectedRaw) return false;
    if (raw && (raw.length > MAX_SAVE_SIZE || new TextEncoder().encode(raw).byteLength > MAX_SAVE_SIZE)) return false;
    let stored = null;
    try { stored = raw === null ? null : parseJSON(raw); } catch { if (raw) backup(raw); }
    if (record(stored) && ![1, 2, 3, SCHEMA_VERSION].includes(stored.version)) return false;
    const clean = validate(state, Math.max(Date.now(), state.updatedAt || 0));
    const encoded = JSON.stringify(clean);
    if (new TextEncoder().encode(encoded).byteLength > MAX_SAVE_SIZE) return false;
    localStorage.setItem(STORAGE_KEY, encoded); return true;
  }
  catch { return false; }
}

/** Удаляет только данные этой игры после явного подтверждения сброса. */
export function reset() {
  try { localStorage.removeItem(STORAGE_KEY); localStorage.removeItem(`${STORAGE_KEY}:recovery`); return true; }
  catch { return false; }
}

/** Возвращает оставшееся время до следующей жизни в миллисекундах. */
export function remaining(state, now = Date.now()) {
  const current = refresh(state, now);
  return current.hearts === MAX_HEARTS ? 0 : Math.max(0, HEART_INTERVAL - (now - current.heartUpdated));
}

/** Вычисляет XP и звёзды за раунд с учётом порога прохождения. */
export function score(correct, total) {
  const safeTotal = bounded(total, 1, 49, 1);
  const safeCorrect = bounded(correct, 0, safeTotal);
  const ratio = safeCorrect / safeTotal;
  return { xp: safeCorrect * 4, stars: ratio >= .9 ? 3 : ratio >= .7 ? 2 : ratio >= .6 ? 1 : 0, passed: ratio >= .6 };
}

/** Убирает одну жизнь, не позволяя счётчику уйти ниже нуля. */
export function mistake(state, now = Date.now(), attemptId = '') {
  const current = refresh(state, now);
  if (attemptId && (typeof attemptId !== 'string' || !/^[a-zA-Z0-9-]{8,90}:\d{1,2}$/.test(attemptId))) return current;
  if (attemptId && current.spentAttempts?.includes(attemptId)) return current;
  return { ...current, hearts: Math.max(0, current.hearts - 1), heartUpdated: current.hearts === MAX_HEARTS ? now : current.heartUpdated,
    spentAttempts: attemptId ? [...(current.spentAttempts || []), attemptId].slice(-256) : current.spentAttempts };
}

/** Сохраняет результат раунда; практика восстанавливает жизнь, но не открывает уроки. */
export function complete(state, result, now = Date.now()) {
  const current = refresh(state, now);
  if (!record(result) || !Number.isInteger(result.total) || result.total < 1 || result.total > 49 || !Number.isInteger(result.correct) || result.correct < 0 || result.correct > result.total) return current;
  if (result.roundId !== undefined && (typeof result.roundId !== 'string' || !/^[a-zA-Z0-9-]{8,90}$/.test(result.roundId))) return current;
  if (typeof result.practice !== 'boolean' || result.finished !== undefined && typeof result.finished !== 'boolean') return current;
  if (result.mode !== undefined && !gameModes.some((mode) => mode.id === result.mode)) return current;
  if (result.mode === 'speed' && !result.practice) return current;
  if (result.generation && result.generation !== current.generation) return current;
  if (!lessons.some((item) => item.id === result.lessonId) || (!result.practice && !unlocked(result.lessonId, current.completed))) return current;
  if (result.roundId && current.rewardedRounds?.includes(result.roundId)) return current;
  const total = bounded(result.total, 1, 49, 1);
  const correct = bounded(result.correct, 0, total);
  const reward = score(correct, total);
  const passed = reward.passed && result.finished !== false;
  const today = day(new Date(now));
  const streak = current.lastPlayed && current.lastPlayed >= today ? Math.max(1, current.streak) : current.lastPlayed === shift(today, -1) ? current.streak + 1 : 1;
  const old = current.completed[result.lessonId];
  const completed = passed && !result.practice ? {
    ...current.completed,
    [result.lessonId]: old && old.stars > reward.stars ? old : { stars: reward.stars, correct, total, mode: gameModes.some((mode) => mode.id === result.mode) ? result.mode : 'visual' },
  } : current.completed;
  return {
    ...current, completed,
    xp: Math.min(1000000, current.xp + reward.xp),
    dailyXP: Math.min(100000, current.dailyXP + reward.xp),
    hearts: result.practice && passed ? Math.min(MAX_HEARTS, current.hearts + 1) : current.hearts,
    streak: passed ? streak : current.streak,
    lastPlayed: passed ? current.lastPlayed && current.lastPlayed > today ? current.lastPlayed : today : current.lastPlayed,
    bestStreak: Math.max(current.bestStreak || 0, passed ? streak : current.streak),
    learned: [...new Set([...current.learned, ...(Array.isArray(result.learned) ? result.learned : []).filter((id) => letterIds.has(id))])].slice(0, letterIds.size),
    sessions: Math.min(100000, current.sessions + 1),
    practiceDays: passed ? [...new Set([...current.practiceDays, today])].sort().slice(-366) : current.practiceDays,
    rewardedRounds: result.roundId ? [...(current.rewardedRounds || []), result.roundId].slice(-256) : current.rewardedRounds,
    ...recordActivity(current, { ...result, correct, total }, reward, now),
  };
}