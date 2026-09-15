import { afterEach, describe, expect, it, vi } from 'vitest';
import { bounded, cleanName, complete, day, defaults, HEART_INTERVAL, load, mistake, refresh, save, score, shuffle, STORAGE_KEY, validate } from '../src/progress.js';

const now = new Date(2026, 8, 12, 12, 0).getTime();
const result = { lessonId: 'alphabet-1', correct: 5, total: 5, practice: false, learned: ['a', 'ae', 'b', 'v', 'g'] };

afterEach(() => vi.unstubAllGlobals());

describe('Очки и звёзды', () => {
  it('выдаёт 20 XP и 3 звезды за 5 правильных ответов', () => expect(score(5, 5)).toEqual({ xp: 20, stars: 3, passed: true }));
  it('выдаёт 2 звезды за 80 процентов', () => expect(score(4, 5).stars).toBe(2));
  it('выдаёт 1 звезду за 60 процентов', () => expect(score(3, 5).stars).toBe(1));
  it('не открывает урок при недостаточном результате', () => expect(score(2, 5)).toEqual({ xp: 8, stars: 0, passed: false }));
  it('ограничивает некорректные числовые аргументы', () => {
    expect(score(-5, 5).xp).toBe(0);
    expect(score(1000, 5).xp).toBe(20);
    expect(score(NaN, 0).passed).toBe(false);
    expect(bounded(Infinity, 0, 5, 2)).toBe(2);
  });
});

describe('Сердечки', () => {
  it('начинает с 5 жизней и без выдуманного опыта', () => {
    expect(defaults(now)).toMatchObject({ xp: 0, hearts: 5, streak: 0, completed: {} });
  });
  it('снимает ровно одну жизнь', () => expect(mistake(defaults(now), now).hearts).toBe(4));
  it('не уходит в отрицательные значения', () => expect(mistake({ ...defaults(now), hearts: 0 }, now).hearts).toBe(0));
  it('не восстанавливает жизнь раньше 30 минут', () => expect(refresh({ ...defaults(now), hearts: 3 }, now + HEART_INTERVAL - 1).hearts).toBe(3));
  it('восстанавливает жизнь ровно через 30 минут', () => expect(refresh({ ...defaults(now), hearts: 3 }, now + HEART_INTERVAL).hearts).toBe(4));
  it('восстанавливает несколько жизней, но не больше пяти', () => expect(refresh({ ...defaults(now), hearts: 0 }, now + 12 * HEART_INTERVAL).hearts).toBe(5));
  it('сохраняет остаток времени между восстановлениями', () => {
    const restored = refresh({ ...defaults(now), hearts: 1 }, now + HEART_INTERVAL * 1.5);
    expect(restored.hearts).toBe(2);
    expect(restored.heartUpdated).toBe(now + HEART_INTERVAL);
  });
  it('не тратит таймер восстановления при следующей ошибке', () => {
    const state = { ...defaults(now), hearts: 4 };
    expect(mistake(state, now + 1000).heartUpdated).toBe(now);
  });
  it('возвращает жизнь за успешную практику', () => {
    const state = complete({ ...defaults(now), hearts: 2 }, { ...result, practice: true }, now);
    expect(state.hearts).toBe(3);
    expect(state.completed).toEqual({});
  });
});

describe('Серия, прогресс и локальный день', () => {
  it('считает первый день', () => expect(complete(defaults(now), result, now).streak).toBe(1));
  it('не удваивает серию за второй урок в один день', () => {
    const first = complete(defaults(now), result, now);
    const second = complete(first, result, now + 1000);
    expect(second.streak).toBe(1);
    expect(second.dailyXP).toBe(40);
    expect(second.practiceDays).toHaveLength(1);
  });
  it('продлевает серию на следующий календарный день', () => {
    const first = complete(defaults(now), result, now);
    const nextDate = new Date(now); nextDate.setDate(nextDate.getDate() + 1);
    const next = complete(first, result, nextDate.getTime());
    expect(next.streak).toBe(2);
    expect(next.dailyXP).toBe(20);
  });
  it('начинает серию заново после пропуска дня', () => {
    const first = complete(defaults(now), result, now);
    const future = new Date(now); future.setDate(future.getDate() + 2);
    expect(complete(first, result, future.getTime()).streak).toBe(1);
  });
  it('обнуляет устаревшую серию при открытии приложения', () => {
    const first = complete(defaults(now), result, now);
    expect(refresh(first, now + 3 * 24 * 3600000).streak).toBe(0);
  });
  it('не удаляет лучшую оценку при повторении', () => {
    const first = complete(defaults(now), result, now);
    expect(complete(first, { ...result, correct: 3 }, now).completed['alphabet-1'].stars).toBe(3);
  });
  it('не записывает несуществующие буквы и дубликаты', () => {
    expect(complete(defaults(now), { ...result, learned: ['a', 'a', 'not-a-letter'] }, now).learned).toEqual(['a']);
  });
  it('не продлевает серию за незавершённый успешно раунд', () => expect(complete(defaults(now), { ...result, correct: 0 }, now).streak).toBe(0));
  it('формирует локальную дату, а не UTC-срез', () => expect(day(new Date(2026, 0, 2, 0, 5))).toBe('2026-01-02'));
});

describe('Валидация и восстановление', () => {
  it('восстанавливает пустой или повреждённый объект', () => {
    expect(validate(null, now)).toEqual(defaults(now));
    expect(validate('invalid', now)).toEqual(defaults(now));
    expect(validate({ version: 100 }, now)).toEqual(defaults(now));
  });
  it('ограничивает числа, возраст, имя и аватар', () => {
    const state = validate({ ...defaults(now), hearts: -40, xp: Infinity, name: '<Лиса>', age: 'unknown', avatar: 'javascript:alert(1)', learned: ['a', 'madeup'], heartUpdated: now }, now);
    expect(state).toMatchObject({ hearts: 0, xp: 0, name: 'Лиса', age: '5-8', avatar: 'wolf', learned: ['a'] });
  });
  it('удаляет невозможные и будущие даты', () => {
    expect(validate({ ...defaults(now), lastPlayed: '2026-02-31', streak: 500 }, now).lastPlayed).toBe(null);
    expect(validate({ ...defaults(now), lastPlayed: '2099-01-01' }, now).streak).toBe(0);
  });
  it('не переносит произвольные свойства из localStorage', () => {
    const restored = validate(JSON.parse('{"version":1,"__proto__":{"polluted":true},"password":"secret"}'), now);
    expect(restored.password).toBeUndefined();
    expect({}.polluted).toBeUndefined();
  });
  it('ограничивает длину имени и удаляет управляющие знаки', () => {
    expect(cleanName('  <Друг>\u0000\u202e  ')).toBe('Друг');
    expect(cleanName('А'.repeat(100))).toHaveLength(24);
    expect(cleanName(42)).toBe('');
  });
  it('не падает при запрещённом localStorage', () => {
    vi.stubGlobal('localStorage', { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } });
    expect(load().hearts).toBe(5);
    expect(save(defaults(now))).toBe(false);
  });
  it('оставляет резервную копию повреждённого сохранения', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => '{broken', setItem });
    expect(load().xp).toBe(0);
    expect(setItem).toHaveBeenCalledWith(`${STORAGE_KEY}:recovery`, '{broken');
  });
  it('не уничтожает незнакомую будущую версию без резервной копии', () => {
    const raw = JSON.stringify({ version: 9, xp: 100 }); const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => raw, setItem });
    expect(load().version).toBe(4);
    expect(setItem).toHaveBeenCalledWith(`${STORAGE_KEY}:recovery`, raw);
  });
  it('сохраняет структурированный JSON без cookies', () => {
    const setItem = vi.fn(); vi.stubGlobal('localStorage', { setItem, getItem: () => null });
    expect(save(defaults(now))).toBe(true);
    expect(JSON.parse(setItem.mock.calls[0][1])).toMatchObject({ version: 4, xp: 0 });
  });
});

describe('Перемешивание', () => {
  it('сохраняет все варианты и не меняет исходный массив', () => {
    const source = ['a', 'b', 'v', 'g'];
    const mixed = shuffle(source, () => 0.2);
    expect([...mixed].sort()).toEqual([...source].sort());
    expect(source).toEqual(['a', 'b', 'v', 'g']);
    expect(mixed).not.toBe(source);
  });
});