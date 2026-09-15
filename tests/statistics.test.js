import { describe, expect, it } from 'vitest';
import { cleanDays, cleanHistory, DAYS_LIMIT, HISTORY_LIMIT, learnedCounts, period, topicStats } from '../src/statistics.js';
import { complete, day, defaults, validate } from '../src/progress.js';
import { shift } from '../src/calendar.js';
import { cleanPreferences, importedPreferences, preferenceDefaults, validTime } from '../src/preferences.js';

const now = new Date(2026, 8, 12, 12).getTime(); const today = day(new Date(now));
const result = { roundId: 'statistics-round-001', lessonId: 'alphabet-1', correct: 5, total: 5, finished: true, practice: false, learned: ['a'] };

describe('Реальная история занятий', () => {
  it('начинает без статистики и точности, а не с вымышленными 100%', () => {
    const stats = period(defaults(now), 7, today);
    expect(stats).toMatchObject({ xp: 0, rounds: 0, days: 0, accuracy: null });
  });
  it('один раунд записывается один раз', () => {
    const first = complete(defaults(now), result, now); const second = complete(first, result, now + 1000);
    expect(second.history).toHaveLength(1); expect(second.activity[today]).toMatchObject({ xp: 20, rounds: 1, successful: 1, correct: 5, total: 5 });
  });
  it('сохраняет дату начала подробной статистики', () => {
    const first = complete(defaults(now), result, now);
    expect(first.historySince).toBe(today);
    expect(complete(first, { ...result, roundId: 'statistics-round-002' }, now + 86400000).historySince).toBe(today);
  });
  it('показывает попытку, даже если серия не продлилась', () => {
    const state = complete(defaults(now), { ...result, correct: 1 }, now);
    expect(state.activity[today]).toMatchObject({ rounds: 1, successful: 0, xp: 4 });
    expect(state.practiceDays).toEqual([]);
  });
  it('не включает незаконченный раунд в процент точности', () => {
    const state = complete(defaults(now), { ...result, correct: 2, finished: false }, now);
    expect(state.history[0]).toMatchObject({ correct: 2, finished: false, xp: 8 });
    expect(period(state, 7, today)).toMatchObject({ rounds: 1, xp: 8, accuracy: null });
  });
  it('усредняет точность по ответам, а не по процентам разных раундов', () => {
    let state = complete(defaults(now), { ...result, correct: 4 }, now);
    state = complete(state, { ...result, roundId: 'statistics-round-002', correct: 1, total: 10, practice: true }, now);
    expect(period(state, 7, today).accuracy).toBe(33);
  });
  it('ограничивает подробный журнал, не теряя дневную сводку', () => {
    let state = defaults(now);
    for (let index = 0; index < HISTORY_LIMIT + 10; index++) state = complete(state, { ...result, roundId: `statistics-round-${String(index).padStart(3, '0')}` }, now);
    expect(state.history).toHaveLength(HISTORY_LIMIT); expect(state.activity[today].rounds).toBe(HISTORY_LIMIT + 10);
  });
  it('считает последние семь дней включительно и не берёт будущее', () => {
    const state = { ...defaults(now), activity: { [today]: { rounds: 1, xp: 20, correct: 5, total: 5, practice: 0, successful: 1 }, [shift(today, -7)]: { rounds: 1, xp: 20, correct: 5, total: 5, practice: 0, successful: 1 }, [shift(today, 1)]: { rounds: 1, xp: 20, correct: 5, total: 5, practice: 0, successful: 1 } } };
    expect(period(state, 7, today).xp).toBe(20); expect(period(state, 30, today).xp).toBe(40);
  });
  it('отклоняет невозможные даты и повреждённые счётчики', () => {
    const data = cleanDays({ '2026-02-31': {}, [today]: { rounds: -7, xp: Infinity, total: 5, correct: 900, successful: 9 } }, now);
    expect(data['2026-02-31']).toBeUndefined(); expect(data[today]).toMatchObject({ rounds: 0, xp: 0, total: 5, correct: 5, successful: 0 });
  });
  it('ограничивает дневные записи 366 датами', () => {
    const entries = Object.fromEntries(Array.from({ length: 500 }, (_, index) => [shift(today, -index), { rounds: 1, xp: 4, total: 1, correct: 1, successful: 1, practice: 1 }]));
    expect(Object.keys(cleanDays(entries, now))).toHaveLength(DAYS_LIMIT);
  });
  it('фильтрует неизвестные уроки и дубликаты истории', () => {
    const record = { id: 'record-123456', lessonId: 'alphabet-1', date: today, correct: 4, total: 5, finished: true, practice: false };
    const cleaned = cleanHistory([record, record, { ...record, id: 'record-unknown', lessonId: 'unknown' }], now);
    expect(cleaned).toHaveLength(1); expect(cleaned[0].xp).toBe(16);
  });
  it('сохраняет новые данные после экспорта и валидации', () => {
    const state = complete(defaults(now), result, now);
    const restored = validate(JSON.parse(JSON.stringify(state)), now);
    expect(restored.history).toEqual(state.history); expect(restored.activity).toEqual(state.activity);
  });
  it('различает буквы и слова, не засчитывает незнакомые ID', () => expect(learnedCounts({ learned: ['a', 'family-mother', 'unknown'] })).toEqual({ letters: 1, words: 1 }));
  it('практика карточек не превращается в пройденный урок карты', () => {
    const state = { ...defaults(now), learned: ['family-mother'] };
    expect(topicStats(state).find((topic) => topic.id === 'family')).toMatchObject({ known: 1, completed: 0, percent: 0 });
  });
});

describe('Семейные настройки и перенос', () => {
  it('по умолчанию напоминания выключены', () => expect(preferenceDefaults().reminders).toMatchObject({ enabled: false, consent: false, channel: 'in-app' }));
  it('не принимает enabled без согласия взрослого', () => {
    const state = cleanPreferences({ reminders: { enabled: true, consent: false, time: '18:00', days: [1] } }, now);
    expect(state.reminders.enabled).toBe(false);
  });
  it('проверяет время и исключает ночь', () => { expect(validTime('08:00')).toBe(true); expect(validTime('20:30')).toBe(true); expect(validTime('23:00')).toBe(false); expect(validTime('18:99')).toBe(false); });
  it('фильтрует дни недели и не даёт включить пустое расписание', () => {
    const state = cleanPreferences({ reminders: { enabled: true, consent: true, time: '18:00', days: [0, 8, '1'] } }, now);
    expect(state.reminders.days).toEqual([]); expect(state.reminders.enabled).toBe(false);
  });
  it('ограничивает громкость и выбирает только существующую цель', () => {
    expect(cleanPreferences({ volume: 700, dailyGoal: 10000 }, now)).toMatchObject({ volume: 100, dailyGoal: 20 });
    expect(cleanPreferences({ volume: -50, dailyGoal: 12 }, now)).toMatchObject({ volume: 0, dailyGoal: 12 });
  });
  it('перенос не включает уведомления на новом устройстве', () => {
    const old = { ...preferenceDefaults(), dailyGoal: 32, reminders: { ...preferenceDefaults().reminders, enabled: true, consent: true, channel: 'system', lastAt: now } };
    expect(importedPreferences(old, now)).toMatchObject({ dailyGoal: 32, reminders: { enabled: false, consent: false, channel: 'in-app', lastAt: 0, lastDay: null } });
  });
});