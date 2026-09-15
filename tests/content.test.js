import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import alphabet from '../data/alphabet.json';
import topics from '../data/topics.json';
import schema from '../data/lesson.schema.json';
import { play } from '../src/audio.js';

describe('Контент алфавита', () => {
  it('содержит 49 уникальных букв', () => {
    expect(alphabet.items).toHaveLength(49);
    expect(new Set(alphabet.items.map((item) => item.id)).size).toBe(49);
    expect(new Set(alphabet.items.map((item) => item.chechen)).size).toBe(49);
  });
  it('распределяет каждую букву ровно в один из 8 уроков', () => {
    expect(alphabet.lessons).toHaveLength(8);
    expect(alphabet.lessons.flatMap((lesson) => lesson.items).sort()).toEqual(alphabet.items.map((item) => item.id).sort());
    expect(alphabet.lessons.every((lesson) => lesson.items.length >= 4)).toBe(true);
  });
  it('содержит все обязательные поля схемы', () => {
    for (const key of schema.required) expect(alphabet).toHaveProperty(key);
    for (const item of alphabet.items) {
      for (const key of schema.properties.items.items.required) expect(item).toHaveProperty(key);
      expect(item.audio).toMatch(/^\/audio\/[a-z0-9-]+\.mp3$/);
      expect(item.audioStatus).toBe('pending');
      expect(item.transcription.length).toBeGreaterThan(0);
    }
  });
  it('не заменяет палочку цифрой один или латинской I', () => {
    expect(alphabet.items.find((item) => item.id === 'pal').chechen).toBe('\u04c0');
    expect(alphabet.items.every((item) => !/[I1]/.test(item.chechen))).toBe(true);
  });
  it('не выдаёт черновую фонетику за проверенную', () => expect(alphabet.reviewStatus).toBe('native-review-needed'));
  it('сохраняет последовательность открытия тем', () => {
    expect(topics[0].prerequisite).toBe(null);
    topics.slice(1).forEach((topic, index) => expect(topic.prerequisite).toBe(topics[index].id));
  });
});

describe('Аудио без синтеза речи', () => {
  it('показывает объяснение при отсутствующей записи', async () => {
    const result = await play(alphabet.items[0]);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Запись носителя');
  });
  it('не загружает внешние или произвольные аудиоадреса', async () => {
    const result = await play({ audioStatus: 'ready', audio: 'https://untrusted.example/voice.mp3' });
    expect(result.ok).toBe(false);
  });
});

describe('PWA и безопасный загрузчик', () => {
  const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8');
  it('объявляет самостоятельный режим и необходимые размеры иконок', () => {
    const manifest = JSON.parse(readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
    expect(manifest.display).toBe('standalone');
    expect(manifest.icons.some((item) => item.sizes === '192x192')).toBe(true);
    expect(manifest.icons.some((item) => item.sizes === '512x512')).toBe(true);
    expect(manifest.icons.some((item) => item.purpose === 'maskable')).toBe(true);
  });
  it('принимает корневой путь worker из одностраничной сборки', () => {
    const importScripts = vi.fn();
    runInNewContext(source, { URL, importScripts, self: { __NOHCHI_RELEASE__: null, location: { href: 'https://app.example/sw.js?module=%2Fservice-Abc-123.js', origin: 'https://app.example' } } });
    expect(importScripts).toHaveBeenCalledWith('/release.js');
    expect(importScripts).toHaveBeenCalledWith('https://app.example/service-Abc-123.js');
  });
  it('не исполняет worker с чужого origin', () => {
    expect(() => runInNewContext(source, { URL, importScripts: vi.fn(), self: { location: { href: 'https://app.example/sw.js?module=https%3A%2F%2Fevil.example%2Fservice-Abc.js', origin: 'https://app.example' } } })).toThrow();
  });
  it('не исполняет произвольный скрипт с собственного origin', () => {
    expect(() => runInNewContext(source, { URL, importScripts: vi.fn(), self: { location: { href: 'https://app.example/sw.js?module=%2Farbitrary.js', origin: 'https://app.example' } } })).toThrow();
  });
  it('не принимает credentials или fragment в адресе worker', () => {
    for (const module of ['https://name@app.example/service-Abc.js', 'https://app.example/service-Abc.js#suffix']) {
      expect(() => runInNewContext(source, { URL, importScripts: vi.fn(), self: { location: { href: `https://app.example/sw.js?module=${encodeURIComponent(module)}`, origin: 'https://app.example' } } })).toThrow();
    }
  });
  it('не активирует неполный worker после ошибки импорта', () => {
    const addEventListener = vi.fn();
    expect(() => runInNewContext(source, { URL, importScripts() { throw new Error('missing bundle'); }, self: { addEventListener, location: { href: 'https://app.example/sw.js?module=%2Fservice-Old.js', origin: 'https://app.example' } } })).toThrow();
    expect(addEventListener).not.toHaveBeenCalled();
  });
});