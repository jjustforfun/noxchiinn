import { course, lesson, letterIds, letters, material, recordings, unlocked, difficulty, entry, modes } from './catalog.js';
import { movable, spelled } from './spelling.js';
import alphabet from '../data/alphabet.json';
import { parseJSON, record, safeTree } from './input.js';

export const ROUND_KEY = 'nohchiin-mott:round';
const ROUND_VERSION = 2;
const MAX_AGE = 12 * 60 * 60 * 1000;
const WRONG = '!wrong';

/** Возвращает текущую небольшую группу пар без одиночной последней карточки. */
export function group(round) {
  const max = difficulty(round.age).pairs;
  const remaining = round.questions.length - round.index;
  const count = remaining > max && remaining - max === 1 ? max - 1 : Math.min(max, remaining);
  return round.questions.slice(round.index, round.index + count).map((question) => question.answer);
}

function extras(mode, age) {
  return { draft: [], bank: [], pairOrder: [], matched: [], missed: [], mismatch: null, remainingMs: mode === 'speed' ? difficulty(age).quizSeconds * 1000 : 0, tickAt: null, timedOut: false, aborted: false };
}

function bank(round, random = Math.random) {
  if (round.mode !== 'build') return [];
  const tokens = movable(current(round).chechen);
  const distractors = shuffle(alphabet.items.map((item) => movable(item.chechen)[0]).filter((token) => !tokens.includes(token)), random).slice(0, difficulty(round.age).distractors);
  return shuffle([...tokens, ...distractors], random);
}

/** Перемешивает копию массива алгоритмом Фишера-Йетса. */
export function shuffle(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const target = Math.min(index, Math.max(0, Math.floor(random() * (index + 1))));
    [copy[index], copy[target]] = [copy[target], copy[index]];
  }
  return copy;
}

/** Создаёт идентификатор раунда без имени, даты рождения и других данных ребёнка. */
export function identity() {
  return globalThis.crypto?.randomUUID?.() || `round-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Создаёт воспроизводимый раунд из JSON, сохраняя порядок вариантов до конца урока. */
export function create(id, profile, { practice = false, mode = 'visual', random = Math.random, now = Date.now() } = {}) {
  if (!modes(id, practice).some((item) => item.id === mode)) return null;
  const current = lesson(id);
  if (!current || (!practice && !unlocked(id, profile.completed))) return null;
  const source = practice ? letters.filter((item) => item.topicId === current.topicId && (item.ageGroup === 'all' || item.ageGroup === profile.age)) : material(id, profile.age);
  if (source.length < 3 || (mode === 'audio' && !recordings(source).available)) return null;
  const ordered = practice ? shuffle(source, random) : [...source.filter((item) => !profile.learned.includes(item.id)), ...source.filter((item) => profile.learned.includes(item.id))];
  const selected = practice ? ordered.slice(0, difficulty(profile.age).practiceQuestions) : ordered;
  const optionCount = difficulty(profile.age).choices;
  const round = {
    version: ROUND_VERSION, id: identity(), generation: profile.generation, lessonId: id, age: profile.age, mode, practice, createdAt: now,
    questions: selected.map((answer) => ({ answer: answer.id, options: shuffle([answer.id, ...shuffle(source.filter((item) => item.id !== answer.id), random).slice(0, optionCount - 1).map((item) => item.id)], random) })),
    index: 0, responses: [], selected: null, phase: 'question',
    ...extras(mode, profile.age),
  };
  round.bank = bank(round, random);
  round.pairOrder = mode === 'match' ? shuffle(selected.map((item) => item.id), random) : [];
  return round;
}

/** Проверяет структуру временного раунда перед восстановлением вкладки. */
export function validateRound(value, profile, now = Date.now()) {
  if (!record(value) || !safeTree(value)) return null;
  if (value?.version === 1 && ['visual', 'audio'].includes(value.mode)) value = { ...value, version: ROUND_VERSION, ...extras(value.mode, value.age) };
  if (!value || value.version !== ROUND_VERSION || typeof value.id !== 'string' || !/^[a-zA-Z0-9-]{8,90}$/.test(value.id)) return null;
  if (value.generation !== profile.generation) return null;
  if (!['question', 'feedback', 'result'].includes(value.phase) || typeof value.practice !== 'boolean' || !['5-8', '9+'].includes(value.age) || !modes(value.lessonId, value.practice).some((mode) => mode.id === value.mode)) return null;
  if (!Number.isFinite(value.createdAt) || value.createdAt > now || now - value.createdAt > MAX_AGE) return null;
  const current = lesson(value.lessonId);
  if (!current || (!value.practice && !unlocked(value.lessonId, profile.completed))) return null;
  const pool = value.practice ? course(current.topicId).items.filter((item) => item.ageGroup === 'all' || item.ageGroup === value.age) : material(value.lessonId, value.age);
  const validIds = new Set(pool.map((item) => item.id));
  if (!Array.isArray(value.questions) || value.questions.length < 1 || value.questions.length > 20 || new Set(value.questions.map((question) => question?.answer)).size !== value.questions.length) return null;
  for (const question of value.questions) {
    if (!question || !validIds.has(question.answer) || !Array.isArray(question.options) || question.options.length < 3 || question.options.length > 4 || !question.options.includes(question.answer) || new Set(question.options).size !== question.options.length || !question.options.every((id) => validIds.has(id))) return null;
  }
  if (!value.practice && (value.questions.length !== pool.length || !pool.every((item) => value.questions.some((question) => question.answer === item.id)))) return null;
  if (value.practice && value.questions.length !== Math.min(pool.length, difficulty(value.age).practiceQuestions)) return null;
  if (!Number.isInteger(value.index) || value.index < 0 || value.index >= value.questions.length || !Array.isArray(value.responses)) return null;
  const batch = group(value);
  if (value.mode === 'match') {
    let cursor = 0;
    while (cursor < value.index) cursor += group({ ...value, index: cursor }).length;
    if (cursor !== value.index) return null;
  }
  if (value.selected !== null && typeof value.selected !== 'string') return null;
  if (typeof value.aborted !== 'boolean' || (value.aborted && (value.mode !== 'match' || value.phase !== 'result'))) return null;
  if (typeof value.timedOut !== 'boolean' || (value.timedOut && (value.mode !== 'speed' || value.phase !== 'result'))) return null;
  const count = value.phase === 'question' || value.timedOut ? value.index : value.index + (value.mode === 'match' ? batch.length : 1);
  if (value.responses.length !== count || value.responses.some((response, index) => response !== WRONG && !value.questions[index]?.options.includes(response))) return null;
  if (value.responses.includes(WRONG) && !['build', 'match'].includes(value.mode)) return null;
  const options = value.questions[value.index].options;
  if (!['match', 'build'].includes(value.mode)) {
    if (value.selected !== null && !options.includes(value.selected)) return null;
    if (value.phase !== 'question' && !value.timedOut && value.selected !== value.responses[value.index]) return null;
  }
  const unique = (array) => Array.isArray(array) && new Set(array).size === array.length;
  if (!unique(value.draft) || !Array.isArray(value.bank) || value.bank.length > 80 || !value.bank.every((token) => typeof token === 'string' && token.length <= 2)) return null;
  if (value.draft.some((index) => !Number.isInteger(index) || index < 0 || index >= value.bank.length)) return null;
  if (value.mode === 'build') {
    const target = movable(entry(value.questions[value.index].answer).chechen);
    const copy = [...value.bank];
    for (const token of target) { const index = copy.indexOf(token); if (index < 0) return null; copy.splice(index, 1); }
    if (copy.length !== difficulty(value.age).distractors || value.draft.length > target.length || !copy.every((token) => alphabet.items.some((item) => movable(item.chechen)[0] === token))) return null;
    if (value.phase !== 'question' && (value.draft.length !== target.length || value.responses[value.index] !== (spelled(entry(value.questions[value.index].answer).chechen, value.draft.map((index) => value.bank[index])) ? value.questions[value.index].answer : WRONG))) return null;
  } else if (value.draft.length || value.bank.length) return null;
  if (!unique(value.matched) || !unique(value.missed) || !unique(value.pairOrder)) return null;
  if (value.mode === 'match') {
    if (value.pairOrder.length !== value.questions.length || !value.pairOrder.every((id) => value.questions.some((question) => question.answer === id))) return null;
    if (![...value.matched, ...value.missed].every((id) => batch.includes(id)) || (value.selected !== null && (!batch.includes(value.selected) || value.matched.includes(value.selected))) || (value.mismatch !== null && !batch.includes(value.mismatch))) return null;
    if ((value.phase !== 'question' && value.matched.length !== batch.length) || (value.phase === 'question' && value.matched.length === batch.length)) return null;
    if (value.phase !== 'question' && batch.some((id, index) => value.responses[value.index + index] !== (value.missed.includes(id) ? WRONG : id))) return null;
  } else if (value.matched.length || value.missed.length || value.pairOrder.length || value.mismatch !== null) return null;
  const limit = value.mode === 'speed' ? difficulty(value.age).quizSeconds * 1000 : 0;
  if (!Number.isFinite(value.remainingMs) || value.remainingMs < 0 || value.remainingMs > limit || (value.timedOut && value.remainingMs !== 0)) return null;
  return {
    version: ROUND_VERSION, id: value.id, generation: value.generation, lessonId: value.lessonId, age: value.age, mode: value.mode, practice: value.practice,
    createdAt: value.createdAt, questions: value.questions.map((question) => ({ answer: question.answer, options: [...question.options] })),
    index: value.index, responses: [...value.responses], selected: value.selected, phase: value.phase,
    draft: [...value.draft], bank: [...value.bank], pairOrder: [...value.pairOrder], matched: [...value.matched], missed: [...value.missed], mismatch: value.mismatch,
    remainingMs: value.remainingMs, tickAt: null, timedOut: value.timedOut, aborted: value.aborted,
  };
}

/** Выбирает ответ, не позволяя менять уже проверенную попытку. */
export function choose(round, id) {
  if (['match', 'build'].includes(round.mode)) return round;
  return round.phase === 'question' && round.questions[round.index].options.includes(id) ? { ...round, selected: id } : round;
}

/** Фиксирует одну попытку; повторное нажатие не изменяет результат. */
export function answer(round) {
  if (round.mode === 'match') return round;
  if (round.mode === 'build') {
    const word = current(round).chechen;
    if (round.phase !== 'question' || round.draft.length !== movable(word).length) return round;
    const verdict = spelled(word, round.draft.map((index) => round.bank[index])) ? current(round).id : WRONG;
    return { ...round, phase: 'feedback', selected: verdict === WRONG ? null : verdict, responses: [...round.responses, verdict], tickAt: null };
  }
  if (round.phase !== 'question' || !round.selected) return round;
  return { ...round, phase: 'feedback', responses: [...round.responses, round.selected], tickAt: null };
}

/** Продвигает раунд или останавливает его, если жизни закончились. */
export function advance(round, hearts) {
  if (round.phase !== 'feedback') return round;
  const nextIndex = round.index + (round.mode === 'match' ? group(round).length : 1);
  if (nextIndex >= round.questions.length || (!round.practice && hearts <= 0)) return { ...round, phase: 'result', tickAt: null };
  const next = { ...round, index: nextIndex, phase: 'question', selected: null, draft: [], matched: [], missed: [], mismatch: null, tickAt: null };
  return { ...next, bank: bank(next) };
}

/** Ставит конкретную фишку в слово; две одинаковые буквы имеют разные индексы. */
export function addTile(round, index) {
  if (round.mode !== 'build' || round.phase !== 'question' || !Number.isInteger(index) || index < 0 || index >= round.bank.length || round.draft.includes(index) || round.draft.length >= movable(current(round).chechen).length) return round;
  return { ...round, draft: [...round.draft, index] };
}

/** Убирает выбранную фишку, не меняя порядок остальных. */
export function removeTile(round, position) {
  if (round.mode !== 'build' || round.phase !== 'question' || !Number.isInteger(position) || position < 0 || position >= round.draft.length) return round;
  return { ...round, draft: round.draft.filter((_, index) => index !== position) };
}

/** Выбирает ещё не сопоставленную картинку. */
export function pickPair(round, id) {
  return round.mode === 'match' && round.phase === 'question' && group(round).includes(id) && !round.matched.includes(id) ? { ...round, selected: id, mismatch: null } : round;
}

/** Проверяет пару; исправить ошибку можно, но звезда отражает первую попытку. */
export function matchPair(round, id) {
  if (round.mode !== 'match' || round.phase !== 'question' || !round.selected || !group(round).includes(id) || round.matched.includes(id)) return round;
  if (round.selected !== id) return { ...round, missed: [...new Set([...round.missed, round.selected])], mismatch: id };
  const matched = [...round.matched, id];
  const batch = group(round);
  if (matched.length === batch.length) return { ...round, matched, selected: null, mismatch: null, phase: 'feedback', responses: [...round.responses, ...batch.map((id) => round.missed.includes(id) ? WRONG : id)] };
  return { ...round, matched, selected: null, mismatch: null };
}

/** Останавливает сопоставление при последней жизни, не выдавая незавершённый раунд за пройденный. */
export function abortPairs(round) {
  if (round.mode !== 'match' || round.phase !== 'question') return round;
  const batch = group(round);
  const missed = [...new Set([...round.missed, ...batch.filter((id) => !round.matched.includes(id))])];
  return { ...round, aborted: true, phase: 'result', matched: batch, missed, mismatch: null, selected: null, responses: [...round.responses, ...batch.map((id) => missed.includes(id) ? WRONG : id)] };
}

/** Вычитает реальное время активного вопроса, независимо от частоты браузерных таймеров. */
export function tick(round, now = Date.now()) {
  if (round.mode !== 'speed' || round.phase !== 'question' || round.tickAt === null) return round;
  const remainingMs = Math.max(0, round.remainingMs - Math.max(0, now - round.tickAt));
  return remainingMs === 0 ? { ...round, remainingMs, tickAt: null, phase: 'result', timedOut: true } : { ...round, remainingMs, tickAt: now };
}

/** Ставит секундомер на паузу; свёрнутая вкладка не отнимает время у ребёнка. */
export function pauseClock(round, now = Date.now()) { return { ...tick(round, now), tickAt: null }; }

/** Возобновляет только секундомер вопроса, не время чтения обратной связи. */
export function resumeClock(round, now = Date.now()) {
  return round.mode === 'speed' && round.phase === 'question' && round.tickAt === null ? { ...round, tickAt: now } : round;
}

/** Вычисляет результат по сохранённым ответам, не доверяя присланному счётчику. */
export function outcome(round) {
  const learned = round.responses.flatMap((response, index) => response === round.questions[index].answer ? [response] : []).filter((id) => letterIds.has(id));
  return { roundId: round.id, generation: round.generation, lessonId: round.lessonId, practice: round.practice, mode: round.mode, correct: learned.length, total: round.questions.length, answered: round.responses.length, finished: !round.aborted && round.responses.length === round.questions.length, learned };
}

/** Находит текущую карточку, не раскрывая её через скрытый текст звукового задания. */
export function current(round) {
  return letters.find((item) => item.id === round.questions[round.index].answer) || null;
}

/** Сохраняет текущий вопрос только в текущей вкладке. */
export function storeRound(round) {
  try { const text = JSON.stringify(round); if (new TextEncoder().encode(text).byteLength > 50000) return false; sessionStorage.setItem(ROUND_KEY, text); return true; } catch { return false; }
}

/** Восстанавливает раунд после перезагрузки, но не после завершённого занятия. */
export function restoreRound(profile) {
  try {
    const raw = sessionStorage.getItem(ROUND_KEY);
    if (raw && raw.length > 50000) { clearRound(); return null; }
    const restored = validateRound(parseJSON(raw || 'null', 50000), profile);
    if (!restored || profile.rewardedRounds?.includes(restored.id)) { clearRound(); return null; }
    return restored;
  } catch { clearRound(); return null; }
}

/** Удаляет только временный раунд, не затрагивая постоянный прогресс. */
export function clearRound() {
  try { sessionStorage.removeItem(ROUND_KEY); return true; } catch { return false; }
}