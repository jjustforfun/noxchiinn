import { afterEach, describe, expect, it, vi } from 'vitest';
import { create, choose, answer, advance, outcome, restoreRound, storeRound, clearRound, validateRound, ROUND_KEY } from '../src/round.js';
import { defaults, complete, migrate, mistake, remaining, save, validate } from '../src/progress.js';
import { lesson, material, recorded, recordings, topicUnlocked, unlocked, upcoming } from '../src/catalog.js';

const now = new Date(2026, 8, 12, 12).getTime();
const profile = () => defaults(now);
const first = (options = {}) => create('alphabet-1', profile(), { now, random: () => .4, ...options });

afterEach(() => vi.unstubAllGlobals());

describe('Карта уроков и тем', () => {
  it('не подменяет неизвестный урок', () => expect(lesson('not-a-lesson')).toBe(null));
  it('открывает только первый урок на чистом профиле', () => {
    expect(unlocked('alphabet-1', {})).toBe(true);
    expect(unlocked('alphabet-2', {})).toBe(false);
  });
  it('требует все предыдущие уроки, а не только соседа', () => expect(unlocked('alphabet-3', { 'alphabet-2': { stars: 3 } })).toBe(false));
  it('находит первый пропущенный шаг', () => expect(upcoming({ 'alphabet-1': { stars: 3 }, 'alphabet-3': { stars: 3 } }).id).toBe('alphabet-2'));
  it('не открывает цифры после семи из восьми уроков', () => {
    const done = Object.fromEntries(Array.from({ length: 7 }, (_, i) => [`alphabet-${i + 1}`, { stars: 3 }]));
    expect(topicUnlocked('numbers', done)).toBe(false);
    done['alphabet-8'] = { stars: 1 };
    expect(topicUnlocked('numbers', done)).toBe(true);
    expect(topicUnlocked('colors', done)).toBe(false);
  });
  it('не считает неизвестную тему доступной', () => expect(topicUnlocked('unknown', {})).toBe(false));
});

describe('Создание раунда', () => {
  it('не пропускает две последние буквы первой группы у младших', () => {
    expect(first().questions.map((item) => item.answer).sort()).toEqual(material('alphabet-1').map((item) => item.id).sort());
    expect(first().questions).toHaveLength(7);
  });
  it('предлагает младшим три разных варианта с верным ответом', () => {
    for (const question of first().questions) {
      expect(question.options).toHaveLength(3);
      expect(new Set(question.options).size).toBe(3);
      expect(question.options).toContain(question.answer);
    }
  });
  it('предлагает старшим четыре варианта', () => {
    const round = create('alphabet-1', { ...profile(), age: '9+' }, { now });
    expect(round.questions.every((item) => item.options.length === 4)).toBe(true);
  });
  it('оставляет свободную тренировку короткой', () => expect(first({ practice: true }).questions).toHaveLength(5));
  it('не создаёт заблокированный урок', () => expect(create('alphabet-8', profile(), { now })).toBe(null));
  it('не включает звук без записей', () => expect(first({ mode: 'audio' })).toBe(null));
  it('требует проверку и разрешение даже для записи с ready', () => {
    const raw = { audio: '/audio/a.mp3', audioStatus: 'ready' };
    expect(recorded(raw)).toBe(false);
    expect(recorded({ ...raw, recording: { reviewed: true, permission: 'own-consent-01' } })).toBe(true);
  });
  it('показывает количество готовых записей, а не скрывает недостающие', () => expect(recordings(material('alphabet-1'))).toEqual({ ready: 0, total: 7, available: false }));
});

describe('Шаги и результат раунда', () => {
  it('не проверяет вопрос без выбора', () => { const round = first(); expect(answer(round)).toBe(round); });
  it('не принимает посторонний вариант', () => { const round = first(); expect(choose(round, 'unknown')).toBe(round); });
  it('фиксирует попытку ровно один раз', () => {
    const round = first(); const checked = answer(choose(round, round.questions[0].answer));
    expect(checked.responses).toHaveLength(1);
    expect(answer(checked)).toBe(checked);
    expect(choose(checked, checked.questions[0].options[1])).toBe(checked);
  });
  it('не пропускает вопрос кнопкой Дальше до проверки', () => { const round = first(); expect(advance(round, 5)).toBe(round); });
  it('сбрасывает выбор для следующего вопроса', () => {
    const round = first(); const next = advance(answer(choose(round, round.questions[0].answer)), 5);
    expect(next).toMatchObject({ index: 1, selected: null, phase: 'question' });
  });
  it('завершает раунд при исчерпании жизней, но не выдаёт полное прохождение', () => {
    let round = first();
    for (let i = 0; i < 5; i++) { round = answer(choose(round, round.questions[round.index].answer)); round = advance(round, i === 4 ? 0 : 5); }
    expect(round.phase).toBe('result');
    const result = outcome(round);
    expect(result).toMatchObject({ correct: 5, total: 7, finished: false });
    expect(complete(profile(), result, now).completed).toEqual({});
    expect(complete(profile(), result, now).xp).toBe(20);
  });
  it('практика продолжается даже без жизней', () => {
    const round = first({ practice: true });
    expect(advance(answer(choose(round, round.questions[0].answer)), 0).phase).toBe('question');
  });
  it('выдаёт награду полному раунду только один раз, в том числе после сериализации', () => {
    let round = first();
    while (round.phase !== 'result') round = advance(answer(choose(round, round.questions[round.index].answer)), 5);
    const result = outcome(round);
    const done = complete(profile(), result, now);
    expect(done.xp).toBe(28);
    expect(done.completed['alphabet-1'].stars).toBe(3);
    expect(complete(validate(JSON.parse(JSON.stringify(done)), now), result, now).xp).toBe(28);
  });
  it('не списывает жизнь повторно за ту же попытку', () => {
    const token = 'round-123456:0';
    const once = mistake(profile(), now, token);
    expect(mistake(once, now + 1000, token).hearts).toBe(4);
  });
  it('отбрасывает результат от старого профиля после сброса', () => {
    const result = outcome(first());
    expect(complete({ ...profile(), generation: 'another-profile' }, result, now).xp).toBe(0);
  });
});

describe('Сохранение временного вопроса', () => {
  it('восстанавливает одинаковый порядок вариантов и выбранную букву', () => {
    const round = first(); const selected = choose(round, round.questions[0].answer);
    expect(validateRound(JSON.parse(JSON.stringify(selected)), profile(), now)).toEqual(selected);
  });
  it('не доверяет лишним ответам или несуществующей букве', () => {
    expect(validateRound({ ...first(), responses: ['a'] }, profile(), now)).toBe(null);
    expect(validateRound({ ...first(), selected: 'unknown' }, profile(), now)).toBe(null);
  });
  it('отбрасывает слишком старую сессию', () => expect(validateRound(first(), profile(), now + 13 * 3600000)).toBe(null));
  it('отбрасывает сессию после сброса профиля', () => expect(validateRound(first(), { ...profile(), generation: 'new' }, now)).toBe(null));
  it('не принимает сокращённый учебный раунд из повреждённого sessionStorage', () => {
    const round = first();
    expect(validateRound({ ...round, questions: round.questions.slice(0, 3) }, profile(), now)).toBe(null);
  });
  it('не падает при запрещённом sessionStorage', () => {
    vi.stubGlobal('sessionStorage', { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() { throw new Error('denied'); } });
    expect(storeRound(first())).toBe(false);
    expect(restoreRound(profile())).toBe(null);
    expect(clearRound()).toBe(false);
  });
  it('сохраняет раунд только в ключ текущей сессии', () => {
    const setItem = vi.fn(); vi.stubGlobal('sessionStorage', { setItem });
    const round = first();
    expect(storeRound(round)).toBe(true);
    expect(setItem).toHaveBeenCalledWith(ROUND_KEY, JSON.stringify(round));
  });
});

describe('Миграция и устойчивые таймеры', () => {
  it('мигрирует v1 без потери честного прогресса', () => {
    const old = { ...profile(), version: 1, xp: 20, completed: { 'alphabet-1': { stars: 3, correct: 5, total: 5 } }, learned: ['a'] };
    const next = validate(old, now);
    expect(next).toMatchObject({ version: 4, xp: 20, learned: ['a'], generation: 'legacy-v1' });
    expect(next.completed['alphabet-1'].stars).toBe(3);
  });
  it('не мигрирует неизвестную будущую схему', () => expect(migrate({ version: 99 })).toBe(null));
  it('не перезаписывает более новое сохранение', () => {
    const setItem = vi.fn();
    vi.stubGlobal('localStorage', { getItem: () => '{"version":99}', setItem });
    expect(save(profile())).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
  });
  it('обнуляет некорректную оценку при нуле правильных ответов', () => expect(validate({ ...profile(), completed: { 'alphabet-1': { stars: 3, correct: 0, total: 5 } } }, now).completed).toEqual({}));
  it('показывает точный остаток восстановления', () => {
    expect(remaining({ ...profile(), hearts: 4 }, now + 1000)).toBe(1799000);
    expect(remaining(profile(), now)).toBe(0);
  });
});