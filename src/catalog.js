import alphabet from '../data/alphabet.json';
import topics from '../data/topics.json';
import numbers from '../data/numbers.json';
import colors from '../data/colors.json';
import greetings from '../data/greetings.json';
import family from '../data/family.json';
import food from '../data/food.json';
import animals from '../data/animals.json';
import body from '../data/body.json';
import games from '../data/games.json';
import sources from './source-data.js';
import { audioLocation, record, sourceLocation } from './input.js';

/** @type {Array<import('./types').Course>} */
export const courses = [alphabet, numbers, colors, greetings, family, food, animals, body];
export const lessons = courses.flatMap((course) => course.lessons.map((lesson) => ({ ...lesson, topicId: course.id })));
export const letters = courses.flatMap((course) => course.items.map((item) => ({ ...item, topicId: course.id })));
export const letterIds = new Set(letters.map((item) => item.id));
export const alphabetIds = new Set(alphabet.items.map((item) => item.id));
export const gameModes = games.modes;

/** Находит любую карточку по уникальному ID, без привязки к типу игры. */
export function entry(id) { return letters.find((item) => item.id === id) || null; }

/** Возвращает настройки выбранной возрастной группы из JSON. */
export function difficulty(age) { return games.ages[age === '9+' ? '9+' : '5-8']; }

/** Выбирает первичный источник карточки и пояснение о необходимости проверки. */
export function reference(item) {
  const id = item.sourceId || course(item.topicId)?.sourceIds?.[0];
  const result = Object.hasOwn(sources, id) ? sources[id] : null;
  return result && sourceLocation(result.url) ? { ...result, url: sourceLocation(result.url) } : null;
}

/** Проверяет доступные механики без показа неработающих вариантов для алфавита. */
export function modes(id, practice = false) {
  const current = lesson(id);
  if (!current) return [];
  return games.modes.filter((mode) => (!mode.practiceOnly || practice) && (current.topicId !== 'alphabet' || !['build', 'match'].includes(mode.id)));
}

/** Считает прогресс только одной темы, а не всех уроков приложения. */
export function topicProgress(id, completed = {}) {
  const sequence = course(id)?.lessons || [];
  return { total: sequence.length, done: sequence.filter((item) => Boolean(completed[item.id]?.stars)).length };
}

/** Находит урок в каталоге, не подменяя неизвестный ID первым уроком. */
export function lesson(id) {
  return lessons.find((item) => item.id === id) || null;
}

/** Возвращает данные темы, когда её контент действительно подключён. */
export function course(id) {
  return courses.find((item) => item.id === id) || null;
}

/** Выбирает материал урока с учётом возрастной группы. */
export function material(id, age = '5-8') {
  const current = lesson(id);
  if (!current) return [];
  return letters.filter((item) => item.topicId === current.topicId && current.items.includes(item.id) && (item.ageGroup === 'all' || item.ageGroup === age));
}

/** Проверяет всю цепочку тем; цикл в JSON никогда не открывает доступ. */
export function topicUnlocked(id, completed = {}, visited = new Set()) {
  const topic = topics.find((item) => item.id === id);
  if (!topic || visited.has(id)) return false;
  if (!topic.prerequisite) return true;
  visited.add(id);
  const previous = course(topic.prerequisite);
  return Boolean(previous?.lessons.length && topicUnlocked(topic.prerequisite, completed, visited) && previous.lessons.every((item) => Boolean(completed[item.id]?.stars)));
}

/** Проверяет все предыдущие уроки, а не только ближайшего соседа. */
export function unlocked(id, completed = {}) {
  const current = lesson(id);
  if (!current || !topicUnlocked(current.topicId, completed)) return false;
  const sequence = course(current.topicId).lessons;
  return sequence.slice(0, sequence.findIndex((item) => item.id === id)).every((item) => Boolean(completed[item.id]?.stars));
}

/** Находит следующий доступный непройденный урок. */
export function upcoming(completed = {}) {
  return lessons.find((item) => !completed[item.id] && unlocked(item.id, completed)) || null;
}

/** Разрешает голос только с пометкой готовности и записью о согласии автора. */
export function recorded(item) {
  return Boolean(record(item) && item.audioStatus === 'ready' && audioLocation(item.audio) && record(item.recording) && item.recording.reviewed === true && typeof item.recording.permission === 'string' && item.recording.permission.trim().length >= 3 && item.recording.permission.length <= 500);
}

/** Считает готовые записи, не скрывая неполный комплект урока. */
export function recordings(items) {
  const ready = items.filter(recorded).length;
  return { ready, total: items.length, available: items.length >= 3 && ready === items.length };
}