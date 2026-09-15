import { courses, lesson, gameModes, alphabetIds, letterIds } from './catalog.js';
import { day, validDay, shift } from './calendar.js';
import { record as plainRecord } from './input.js';

export const HISTORY_LIMIT = 80;
export const DAYS_LIMIT = 366;
const integer = (value, max = 100000) => Number.isFinite(value) ? Math.max(0, Math.min(max, Math.floor(value))) : 0;

/** Создаёт пустую дневную сводку, не восстанавливая вымышленные старые занятия. */
export function emptyDay() { return { rounds: 0, successful: 0, practice: 0, correct: 0, total: 0, xp: 0 }; }

/** Проверяет дневные суммы и ограничивает объём локальной истории. */
export function cleanDays(value, now = Date.now()) {
  const clean = {};
  if (!plainRecord(value)) return clean;
  const latest = shift(day(new Date(now)), 1);
  for (const key of Object.keys(value).filter((key) => validDay(key) && key <= latest).sort().slice(-DAYS_LIMIT)) {
    const record = value[key];
    if (!plainRecord(record)) continue;
    const rounds = integer(record.rounds, 10000); const total = integer(record.total, 500000);
    clean[key] = { rounds, successful: Math.min(rounds, integer(record.successful)), practice: Math.min(rounds, integer(record.practice)), total, correct: Math.min(total, integer(record.correct, 500000)), xp: integer(record.xp) };
  }
  return clean;
}

/** Проверяет журнал последних раундов, не сохраняя ответы по буквам и персональные данные. */
export function cleanHistory(value, now = Date.now()) {
  if (!Array.isArray(value)) return [];
  const latest = shift(day(new Date(now)), 1); const seen = new Set();
  return value.slice(-HISTORY_LIMIT * 2).filter((record) => {
    if (!record || typeof record.id !== 'string' || !/^[a-zA-Z0-9-]{8,90}$/.test(record.id) || seen.has(record.id) || !validDay(record.date) || record.date > latest || !lesson(record.lessonId)) return false;
    seen.add(record.id); return true;
  }).map((record) => {
    const total = Math.max(1, integer(record.total, 49)); const correct = integer(record.correct, total);
    const finished = record.finished === true;
    return { id: record.id, date: record.date, lessonId: record.lessonId, mode: gameModes.some((mode) => mode.id === record.mode) ? record.mode : 'visual', total, correct, finished, passed: finished && correct / total >= .6, practice: record.practice === true, xp: correct * 4 };
  }).slice(-HISTORY_LIMIT);
}

/** Добавляет новый фактический результат к дневным суммам и короткому журналу. */
export function recordActivity(state, result, reward, now = Date.now()) {
  const date = day(new Date(now));
  const previous = state.activity?.[date] || emptyDay();
  const total = Math.max(1, integer(result.total, 49));
  const correct = integer(result.correct, total); const finished = result.finished !== false;
  const passed = finished && reward.passed;
  const record = { id: result.roundId || `legacy-session-${state.sessions + 1}`, date, lessonId: result.lessonId, mode: result.mode || 'visual', total, correct, finished, passed, practice: Boolean(result.practice), xp: reward.xp };
  const current = {
    rounds: Math.min(10000, previous.rounds + 1), successful: Math.min(10000, previous.successful + (passed ? 1 : 0)), practice: Math.min(10000, previous.practice + (result.practice ? 1 : 0)),
    correct: Math.min(500000, previous.correct + (finished ? correct : 0)), total: Math.min(500000, previous.total + (finished ? total : 0)), xp: Math.min(100000, previous.xp + reward.xp),
  };
  const activity = Object.fromEntries(Object.entries({ ...(state.activity || {}), [date]: current }).sort(([a], [b]) => a.localeCompare(b)).slice(-DAYS_LIMIT));
  return { activity, history: [...(state.history || []), record].slice(-HISTORY_LIMIT), historySince: state.historySince || date };
}

/** Считает выбранный период по дневным суммам, независимо от длины журнала раундов. */
export function period(state, length = 7, today = day()) {
  const start = shift(today, 1 - Math.max(1, Math.min(DAYS_LIMIT, length)));
  const entries = Object.entries(state.activity || {}).filter(([date]) => date >= start && date <= today);
  const totals = emptyDay();
  for (const [, stats] of entries) for (const key of Object.keys(totals)) totals[key] += stats[key];
  return { ...totals, days: entries.filter(([, stats]) => stats.rounds > 0).length, accuracy: totals.total ? Math.round(totals.correct / totals.total * 100) : null, start, end: today };
}

/** Показывает фактический прогресс темы: уроки и карточки, узнанные в игре. */
export function topicStats(state) {
  return courses.map((course) => {
    const known = course.items.filter((item) => state.learned.includes(item.id)).length;
    const completed = course.lessons.filter((item) => Boolean(state.completed[item.id])).length;
    return { id: course.id, title: course.title, known, cards: course.items.length, completed, lessons: course.lessons.length, percent: Math.round(completed / course.lessons.length * 100) };
  });
}

/** Различает карточки букв и слов, не называя результат игры знанием произношения. */
export function learnedCounts(state) {
  return { letters: state.learned.filter((id) => alphabetIds.has(id)).length, words: state.learned.filter((id) => letterIds.has(id) && !alphabetIds.has(id)).length };
}