import { afterEach, describe, expect, it, vi } from 'vitest';
import { day, dateLabel, longest, monthDays, monthShift, ordinal, plural, shift, validDay, weekday } from '../src/calendar.js';
import { complete, defaults, refresh, validate } from '../src/progress.js';

const now = new Date(2026, 8, 12, 12).getTime();
const result = { roundId: 'calendar-round-001', lessonId: 'alphabet-1', correct: 5, total: 5, finished: true, practice: false, learned: ['a', 'b'] };
afterEach(() => vi.unstubAllEnvs());

describe('Календарные даты', () => {
  it('принимает 29 февраля только в високосный год', () => { expect(validDay('2024-02-29')).toBe(true); expect(validDay('2025-02-29')).toBe(false); });
  it('не нормализует 31 февраля в март', () => expect(validDay('2026-02-31')).toBe(false));
  it('не принимает неполные даты и произвольную строку', () => { expect(validDay('2026-2-1')).toBe(false); expect(validDay(null)).toBe(false); expect(validDay('invalid')).toBe(false); });
  it('переносит день через Новый год', () => expect(shift('2025-12-31', 1)).toBe('2026-01-01'));
  it('переносит день назад через високосный февраль', () => expect(shift('2024-03-01', -1)).toBe('2024-02-29'));
  it('разность календарных дней не зависит от перехода на летнее время', () => expect(ordinal('2026-03-30') - ordinal('2026-03-28')).toBe(2));
  it('использует понедельник как первый день недели', () => { expect(weekday('2026-09-14')).toBe(1); expect(weekday('2026-09-20')).toBe(7); });
  it('строит 42 последовательных клетки с понедельника', () => {
    const days = monthDays('2026-09'); expect(days).toHaveLength(42); expect(weekday(days[0])).toBe(1);
    expect(days.filter((date) => date.startsWith('2026-09'))).toHaveLength(30);
    expect(days.every((date, index) => index === 0 || shift(days[index - 1], 1) === date)).toBe(true);
  });
  it('не создаёт календарь для невозможного месяца', () => expect(monthDays('2026-13')).toEqual([]));
  it('меняет месяц без зависимости от 31-го числа', () => { expect(monthShift('2026-01', -1)).toBe('2025-12'); expect(monthShift('2026-12', 1)).toBe('2027-01'); });
  it('возвращает читаемую подпись без сдвига на соседний день', () => { expect(dateLabel('2026-09-12')).toContain('12 сентября'); expect(dateLabel('invalid')).toBe(''); });
  it('не считает дубликаты дней отдельной серией', () => expect(longest(['2026-09-14', '2026-09-12', '2026-09-13', '2026-09-13'])).toBe(3));
  it('находит лучший отрезок, даже когда последняя серия короче', () => expect(longest(['2026-09-01', '2026-09-02', '2026-09-03', '2026-09-10'])).toBe(3));
  it('не создаёт серию из пустых данных', () => expect(longest([])).toBe(0));
  it('склоняет 1, 2, 11, 21 и 112 правильно', () => {
    expect([1, 2, 11, 21, 112].map((count) => plural(count))).toEqual(['день', 'дня', 'дней', 'день', 'дней']);
  });
});

describe('Ежедневная серия и смена времени', () => {
  it('сохраняет лучшую серию после пропуска', () => {
    const first = complete(defaults(now), result, now);
    const second = complete(first, { ...result, roundId: 'calendar-round-002' }, now + 86400000);
    const afterBreak = refresh(second, now + 4 * 86400000);
    expect(afterBreak.streak).toBe(0); expect(afterBreak.bestStreak).toBe(2); expect(afterBreak.xp).toBe(40);
  });
  it('не забирает дату при перелёте назад через полночь', () => {
    vi.stubEnv('TZ', 'Europe/Moscow');
    const moment = new Date('2026-09-12T00:30:00+03:00').getTime();
    const before = complete(defaults(moment), result, moment);
    expect(before.lastPlayed).toBe('2026-09-12');
    vi.stubEnv('TZ', 'Europe/Paris');
    const after = validate(before, moment);
    expect(day(new Date(moment))).toBe('2026-09-11');
    expect(after.practiceDays).toContain('2026-09-12'); expect(after.streak).toBe(1);
    const repeated = complete(after, { ...result, roundId: 'calendar-travel-002' }, moment);
    expect(repeated.streak).toBe(1); expect(repeated.lastPlayed).toBe('2026-09-12');
  });
  it('считает соседние локальные дни при 23-часовом переходе DST', () => {
    vi.stubEnv('TZ', 'Europe/Paris');
    const firstDay = new Date(2026, 2, 28, 12).getTime(); const nextDay = new Date(2026, 2, 29, 12).getTime();
    expect(nextDay - firstDay).toBe(23 * 3600000);
    const first = complete(defaults(firstDay), result, firstDay);
    expect(complete(first, { ...result, roundId: 'calendar-dst-002' }, nextDay).streak).toBe(2);
  });
  it('не восстанавливает подробности истории из старого streak', () => {
    const old = { ...defaults(now), version: 3, streak: 5, lastPlayed: day(new Date(now)), xp: 150, practiceDays: [day(new Date(now))] };
    const migrated = validate(old, now);
    expect(migrated).toMatchObject({ version: 4, xp: 150, streak: 5, bestStreak: 5, history: [], activity: {}, historySince: null });
  });
  it('берёт известную лучшую серию из старых календарных отметок', () => {
    const state = validate({ ...defaults(now), practiceDays: ['2026-09-01', '2026-09-02', '2026-09-03'] }, now);
    expect(state.bestStreak).toBe(3); expect(state.streak).toBe(0);
  });
});