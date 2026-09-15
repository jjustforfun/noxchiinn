import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import Ajv2020 from 'ajv/dist/2020.js';
import { courses, lessons, letters, alphabetIds, recorded, reference } from '../src/catalog.js';
import schema from '../data/lesson.schema.json';
import sources from '../data/sources.json';
import topics from '../data/topics.json';
import { assemble, movable, normalize } from '../src/spelling.js';

const validate = new Ajv2020({ allErrors: true }).compile(schema);
const sprite = readFileSync(new URL('../public/images/vocabulary.svg', import.meta.url), 'utf8');

describe('Новые данные этапа 3', () => {
  it('добавляет 68 карточек к 49 буквам', () => { expect(letters.length).toBe(117); expect(alphabetIds.size).toBe(49); });
  it('подключает восемь тем и 24 урока', () => { expect(courses).toHaveLength(8); expect(lessons).toHaveLength(24); });
  it('каждый ID уникален между темами', () => {
    expect(new Set(letters.map((item) => item.id)).size).toBe(letters.length);
    expect(new Set(lessons.map((item) => item.id)).size).toBe(lessons.length);
  });
  it('проверяет все учебные файлы по JSON Schema', () => {
    for (const course of courses) expect(validate(course), `${course.id}: ${JSON.stringify(validate.errors)}`).toBe(true);
  });
  it('покрывает каждую карточку ровно одним уроком своей темы', () => {
    for (const course of courses) expect(course.lessons.flatMap((lesson) => lesson.items).sort()).toEqual(course.items.map((item) => item.id).sort());
  });
  it('объявляет числа от 1 до 20 без пробелов', () => expect(letters.filter((item) => item.topicId === 'numbers').map((item) => item.number)).toEqual(Array.from({ length: 20 }, (_, index) => index + 1)));
  it('даёт восемь различимых названий цветов и swatch', () => {
    const colors = letters.filter((item) => item.topicId === 'colors');
    expect(colors).toHaveLength(8); expect(new Set(colors.map((item) => item.swatch)).size).toBe(8);
    expect(colors.every((item) => Boolean(item.russian))).toBe(true);
  });
  it('каждый названный источник существует в реестре', () => {
    for (const course of courses.filter((item) => item.id !== 'alphabet')) {
      for (const id of course.sourceIds) expect(sources[id]).toBeDefined();
      for (const item of course.items) expect(reference({ ...item, topicId: course.id })?.url).toMatch(/^https:\/\//);
    }
  });
  it('все ссылки иллюстраций указывают на существующие символы SVG', () => {
    for (const item of letters.filter((item) => item.image)) {
      expect(item.image).toMatch(/^\/images\/vocabulary\.svg#[a-z-]+$/);
      expect(sprite).toContain(`id="${item.image.split('#')[1]}"`);
    }
  });
  it('не подменяет палочку латиницей или цифрой в чеченском тексте', () => {
    for (const item of letters) expect(item.chechen).not.toMatch(/[a-zA-Z0-9І]/);
  });
  it('не объявляет черновое произношение проверенным', () => {
    expect(courses.every((course) => course.reviewStatus === 'native-review-needed')).toBe(true);
    expect(letters.some(recorded)).toBe(false);
  });
  it('все слова восстанавливаются из своих фишек', () => {
    for (const item of letters.filter((item) => item.type === 'word')) expect(assemble(item.chechen, movable(item.chechen))).toBe(normalize(item.chechen));
  });
  it('количество уроков на карте совпадает с данными', () => {
    for (const course of courses) expect(topics.find((topic) => topic.id === course.id).lessons).toBe(course.lessons.length);
  });
  it('не выдаёт природу за уже готовую тему', () => expect(topics.find((topic) => topic.id === 'nature').ready).toBe(false));
});