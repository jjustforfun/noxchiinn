import { describe, expect, it } from 'vitest';
import { create, current, addTile, removeTile, answer, advance, pickPair, matchPair, group, outcome, validateRound, pauseClock, resumeClock, tick, choose, abortPairs } from '../src/round.js';
import { normalize, tokenize, movable, assemble, spelled } from '../src/spelling.js';
import { courses, lessons, modes, difficulty, topicProgress } from '../src/catalog.js';
import { complete, defaults, validate } from '../src/progress.js';

const now = new Date(2026, 8, 12, 12).getTime();
const base = () => defaults(now);
const learned = () => ({ ...base(), completed: Object.fromEntries(lessons.map((lesson) => [lesson.id, { correct: lesson.items.length, total: lesson.items.length, stars: 3, mode: 'visual' }])) });
const start = (mode, id = 'family-1', age = '5-8', practice = false) => create(id, { ...learned(), age }, { mode, practice, now, random: () => .35 });

/** Собирает слово с учётом физических индексов повторяющихся фишек. */
function solveWord(round) {
  for (const token of movable(current(round).chechen)) {
    const index = round.bank.findIndex((value, index) => value === token && !round.draft.includes(index));
    round = addTile(round, index);
  }
  return answer(round);
}

/** Собирает всю страницу пар в любом порядке, как при реальных нажатиях. */
function solvePairs(round) {
  for (const id of [...group(round)].reverse()) round = matchPair(pickPair(round, id), id);
  return round;
}

describe('Чеченская орфография в сборке слова', () => {
  it('не разрывает кӀ', () => expect(tokenize('КӀант')).toEqual(['кӀ', 'а', 'н', 'т']));
  it('не разрывает кх', () => expect(tokenize('Кхор')).toEqual(['кх', 'о', 'р']));
  it('не разрывает къ и оь', () => expect(tokenize('Ткъайоьсна')).toEqual(['т', 'къ', 'а', 'й', 'оь', 'с', 'н', 'а']));
  it('не разрывает аь и оставляет две ц', () => expect(tokenize('Баьццара')).toEqual(['б', 'аь', 'ц', 'ц', 'а', 'р', 'а']));
  it('сохраняет две одинаковые буквы н и а', () => expect(movable('Нана')).toEqual(['н', 'а', 'н', 'а']));
  it('нормализует только настоящие кириллические варианты палочки', () => {
    expect(normalize('Кӏант')).toBe(normalize('КӀант'));
    expect(normalize('К1ант')).not.toBe(normalize('КӀант'));
  });
  it('автоматически ставит пробелы и дефисы', () => {
    expect(assemble('Ден нана', movable('Ден нана'))).toBe('ден нана');
    expect(assemble('а-б', ['а', 'б'])).toBe('а-б');
  });
  it('не принимает неполное слово', () => expect(spelled('Нана', ['н', 'а', 'н'])).toBe(false));
  it('не принимает лишнюю букву', () => expect(spelled('Нана', ['н', 'а', 'н', 'а', 'а'])).toBe(false));
  it('нормализует NFC и пробелы, а не меняет смысл букв', () => expect(normalize('  Ден   НАНА  ')).toBe('ден нана'));
});

describe('Сборка слова', () => {
  it('у младших в банке только нужные буквы', () => {
    const round = start('build');
    expect([...round.bank].sort()).toEqual([...movable(current(round).chechen)].sort());
  });
  it('у старших есть две дополнительные фишки', () => {
    const round = start('build', 'family-1', '9+');
    expect(round.bank.length).toBe(movable(current(round).chechen).length + 2);
  });
  it('одну физическую фишку нельзя использовать дважды', () => {
    const round = addTile(start('build'), 0);
    expect(addTile(round, 0)).toBe(round);
  });
  it('удаляет выбранную позицию, а не все одинаковые буквы', () => {
    let round = start('build'); round = addTile(addTile(round, 0), 1);
    expect(removeTile(round, 0).draft).toEqual([1]);
  });
  it('не принимает индексы вне банка', () => { const round = start('build'); expect(addTile(round, -1)).toBe(round); expect(addTile(round, 999)).toBe(round); });
  it('не проверяет недостроенное слово', () => { const round = addTile(start('build'), 0); expect(answer(round)).toBe(round); });
  it('записывает правильное слово как один ответ', () => {
    const round = solveWord(start('build'));
    expect(round.responses).toEqual([current(round).id]);
    expect(outcome(round).correct).toBe(1);
  });
  it('сохраняет неправильную сборку для разбора', () => {
    let round = start('build');
    const target = movable(current(round).chechen).reverse();
    for (const token of target) round = addTile(round, round.bank.findIndex((value, index) => value === token && !round.draft.includes(index)));
    round = answer(round);
    expect(round.responses).toEqual(['!wrong']);
    expect(outcome(round).correct).toBe(0);
  });
  it('после проверки фишки не меняются', () => {
    const round = solveWord(start('build'));
    expect(removeTile(round, 0)).toBe(round);
    expect(addTile(round, 0)).toBe(round);
    expect(answer(round)).toBe(round);
  });
  it('следующий вопрос получает свой банк и пустую сборку', () => {
    const round = advance(solveWord(start('build')), 5);
    expect(round.index).toBe(1); expect(round.draft).toEqual([]);
    expect([...round.bank].sort()).toEqual([...movable(current(round).chechen)].sort());
  });
  it('не даёт включить сборку отдельных букв алфавита', () => expect(start('build', 'alphabet-1')).toBe(null));
  it('восстанавливает незавершённую сборку и повторяющиеся фишки', () => {
    const round = addTile(addTile(start('build'), 0), 1);
    expect(validateRound(JSON.parse(JSON.stringify(round)), learned(), now)).toEqual(round);
  });
  it('отклоняет банк с пропущенной нужной буквой', () => {
    const round = start('build'); round.bank.pop();
    expect(validateRound(round, learned(), now)).toBe(null);
  });
  it('полный урок получает звёзды и сохраняет тип игры', () => {
    let round = start('build');
    while (round.phase !== 'result') round = advance(solveWord(round), 5);
    const profile = complete(learned(), outcome(round), now);
    expect(profile.xp).toBe(16);
    expect(profile.completed['family-1'].mode).toBe('build');
    expect(validate(profile, now).completed['family-1'].mode).toBe('build');
  });
});

describe('Картинка и слово', () => {
  it('разбивает четыре карточки младших на две пары и две пары', () => {
    const round = start('match');
    expect(group(round)).toHaveLength(2);
    expect(group(advance(solvePairs(round), 5))).toHaveLength(2);
  });
  it('старшим показывает сразу четыре пары', () => expect(group(start('match', 'family-1', '9+'))).toHaveLength(4));
  it('нельзя угадать слово, не выбрав картинку', () => { const round = start('match'); expect(matchPair(round, group(round)[0])).toBe(round); });
  it('не принимает пары из другой группы', () => { const round = start('match'); expect(pickPair(round, round.questions[3].answer)).toBe(round); });
  it('одна и та же пара не учитывается дважды', () => {
    let round = start('match'); const id = group(round)[0];
    round = matchPair(pickPair(round, id), id);
    expect(pickPair(round, id)).toBe(round);
    expect(round.matched).toEqual([id]);
  });
  it('неверное сопоставление можно исправить, но первая попытка остаётся неверной', () => {
    let round = start('match'); const [left, wrong] = group(round);
    round = matchPair(pickPair(round, left), wrong);
    expect(round.missed).toEqual([left]);
    round = solvePairs(round);
    expect(round.responses).toEqual(['!wrong', wrong]);
    expect(outcome(round).correct).toBe(1);
  });
  it('повторная ошибка одной картинки не размножает штраф', () => {
    let round = start('match'); const [left, wrong] = group(round);
    round = matchPair(pickPair(round, left), wrong); round = matchPair(round, wrong);
    expect(round.missed).toEqual([left]);
  });
  it('сохраняет порядок и уже найденную пару при перезагрузке', () => {
    let round = start('match'); const first = group(round)[0];
    round = matchPair(pickPair(round, first), first);
    expect(validateRound(JSON.parse(JSON.stringify(round)), learned(), now)).toEqual(round);
  });
  it('заканчивает страницу только после всех пар', () => {
    let round = start('match'); const [first] = group(round);
    round = matchPair(pickPair(round, first), first);
    expect(round.phase).toBe('question');
    round = solvePairs(round);
    expect(round.phase).toBe('feedback');
  });
  it('не принимает поддельный список найденных пар', () => {
    const round = start('match'); round.matched = ['unknown'];
    expect(validateRound(round, learned(), now)).toBe(null);
  });
  it('последняя жизнь останавливает пары без ложного прохождения', () => {
    let round = start('match', 'family-1', '9+');
    const [first, second] = group(round);
    round = matchPair(pickPair(round, first), first);
    round = abortPairs(matchPair(pickPair(round, second), group(round)[2]));
    expect(round.phase).toBe('result'); expect(outcome(round).finished).toBe(false);
    expect(outcome(round).correct).toBe(1);
    expect(validateRound(round, learned(), now)).toEqual(round);
  });
  it('полное сопоставление покрывает каждый элемент ровно один раз', () => {
    let round = start('match', 'numbers-1');
    while (round.phase !== 'result') round = advance(solvePairs(round), 5);
    expect(outcome(round)).toMatchObject({ total: 5, correct: 5, finished: true });
    expect(validateRound(round, learned(), now)).toEqual(round);
  });
});

describe('Добрая викторина с таймером', () => {
  it('включается только в свободной тренировке', () => expect(start('speed')).toBe(null));
  it('даёт 90 секунд младшим и 60 старшим', () => {
    expect(start('speed', 'numbers-1', '5-8', true).remainingMs).toBe(90000);
    expect(start('speed', 'numbers-1', '9+', true).remainingMs).toBe(60000);
  });
  it('не запускает время до начала активного вопроса', () => { const round = start('speed', 'numbers-1', '5-8', true); expect(tick(round, now + 10000)).toBe(round); });
  it('считает прошедшее время, а не количество кадров', () => {
    const round = resumeClock(start('speed', 'numbers-1', '5-8', true), now);
    expect(tick(round, now + 3500).remainingMs).toBe(86500);
  });
  it('пауза сохраняет остаток и не отнимает время в фоне', () => {
    const running = resumeClock(start('speed', 'numbers-1', '5-8', true), now);
    const paused = pauseClock(running, now + 2000);
    expect(paused.remainingMs).toBe(88000);
    expect(tick(paused, now + 30000)).toBe(paused);
    expect(tick(resumeClock(paused, now + 30000), now + 31000).remainingMs).toBe(87000);
  });
  it('разбор ответа не расходует таймер', () => {
    let round = resumeClock(start('speed', 'numbers-1', '5-8', true), now);
    round = pauseClock(round, now + 1000);
    round = answer(choose(round, current(round).id));
    expect(tick(round, now + 40000)).toBe(round);
    expect(round.remainingMs).toBe(89000);
  });
  it('не даёт времени стать отрицательным', () => {
    const round = tick(resumeClock(start('speed', 'numbers-1', '5-8', true), now), now + 999999);
    expect(round).toMatchObject({ remainingMs: 0, phase: 'result', timedOut: true });
  });
  it('не открывает урок и не отнимает жизнь при истечении времени', () => {
    const initial = start('speed', 'numbers-1', '5-8', true);
    const timed = tick(resumeClock(initial, now), now + 100000);
    const profile = complete(base(), outcome(timed), now);
    expect(profile.hearts).toBe(5); expect(profile.completed).toEqual({}); expect(profile.streak).toBe(0);
  });
  it('восстанавливает остаток без старого часовго якоря', () => {
    const round = tick(resumeClock(start('speed', 'numbers-1', '5-8', true), now), now + 1000);
    const restored = validateRound(round, learned(), now + 1000);
    expect(restored.tickAt).toBe(null); expect(restored.remainingMs).toBe(89000);
  });
  it('не принимает превышение лимита или ложный timedOut', () => {
    const round = start('speed', 'numbers-1', '5-8', true);
    expect(validateRound({ ...round, remainingMs: 100000 }, learned(), now)).toBe(null);
    expect(validateRound({ ...round, phase: 'result', timedOut: true }, learned(), now)).toBe(null);
  });
});

describe('Совместимость и доступность', () => {
  it('сохраняет XP, поколение профиля и обработанные раунды при миграции v2', () => {
    const previous = { ...base(), version: 2, xp: 72, rewardedRounds: ['round-12345678'], learned: ['a'] };
    const next = validate(previous, now);
    expect(next).toMatchObject({ version: 4, xp: 72, generation: previous.generation, rewardedRounds: ['round-12345678'], learned: ['a'] });
  });
  it('переносит временный раунд этапа 2 без удаления прогресса', () => {
    const round = create('alphabet-1', base(), { now });
    const previous = { version: 1, id: round.id, generation: round.generation, lessonId: round.lessonId, age: round.age, mode: round.mode, practice: round.practice, createdAt: now, questions: round.questions, index: 0, responses: [], selected: null, phase: 'question' };
    expect(validateRound(previous, base(), now)).toEqual(round);
  });
  it('показывает спокойные альтернативы таймеру', () => {
    expect(modes('numbers-1', true).map((mode) => mode.id)).toEqual(['visual', 'match', 'build', 'speed', 'audio']);
    expect(modes('numbers-1', false).some((mode) => mode.id === 'speed')).toBe(false);
  });
  it('считает прогресс темы отдельно', () => {
    expect(topicProgress('numbers', { 'alphabet-1': { stars: 3 }, 'numbers-1': { stars: 2 } })).toEqual({ total: 4, done: 1 });
  });
  it('для каждой темы есть полноценная визуальная тренировка', () => {
    for (const course of courses) expect(create(course.lessons[0].id, base(), { practice: true, now })).not.toBe(null);
  });
  it('для каждого возраста правила берутся из данных', () => {
    expect(difficulty('5-8').choices).toBe(3); expect(difficulty('9+').choices).toBe(4);
  });
  it('не теряет новую лексику после сохранения и повторного чтения', () => {
    const profile = { ...base(), learned: ['a', 'family-mother', 'food-apple', 'body-eye'] };
    expect(validate(JSON.parse(JSON.stringify(profile)), now).learned).toEqual(profile.learned);
  });
});