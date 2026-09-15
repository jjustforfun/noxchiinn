import { describe, expect, it } from 'vitest';
import Ajv2020 from 'ajv/dist/2020.js';
import alphabet from '../data/alphabet.json';
import schema from '../data/lesson.schema.json';

const validate = new Ajv2020({ allErrors: true }).compile(schema);

describe('Полная JSON Schema 2020-12', () => {
  it('проверяет текущий учебный JSON целиком', () => expect(validate(alphabet), JSON.stringify(validate.errors)).toBe(true));
  it('запрещает ready без сведений о разрешении', () => {
    const data = structuredClone(alphabet);
    data.items[0].audioStatus = 'ready';
    expect(validate(data)).toBe(false);
  });
  it('разрешает структурированную запись после согласования', () => {
    const data = structuredClone(alphabet);
    data.items[0].audioStatus = 'ready';
    data.items[0].recording = { reviewed: true, permission: 'fixture-consent-01' };
    expect(validate(data), JSON.stringify(validate.errors)).toBe(true);
  });
  it('отклоняет внешний путь аудио и неизвестную возрастную группу', () => {
    const data = structuredClone(alphabet);
    data.items[0].audio = 'https://example.org/sound.mp3';
    data.items[0].ageGroup = 'unknown';
    expect(validate(data)).toBe(false);
  });
});