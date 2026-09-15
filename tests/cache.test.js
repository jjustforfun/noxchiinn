import { describe, expect, it } from 'vitest';
import { audioPath, cacheable, digest, shellPath } from '../src/cache.js';

describe('Правила офлайн-кэша', () => {
  it('принимает только полный аудиоответ 200', () => expect(cacheable(new Response('sound', { headers: { 'content-type': 'audio/mpeg' } }), 'audio')).toBe(true));
  it('не кэширует HTML вместо отсутствующего MP3', () => expect(cacheable(new Response('<html></html>', { headers: { 'content-type': 'text/html' } }), 'audio')).toBe(false));
  it('не сохраняет частичный ответ Range как полный файл', () => expect(cacheable(new Response('partial', { status: 206, headers: { 'content-type': 'audio/mpeg' } }), 'audio')).toBe(false));
  it('не кэширует ответы с ошибкой сервера', () => expect(cacheable(new Response('error', { status: 500, headers: { 'content-type': 'text/html' } }), 'html')).toBe(false));
  it('проверяет MIME учебных данных', () => {
    expect(cacheable(new Response('{}', { headers: { 'content-type': 'application/json; charset=utf-8' } }), 'json')).toBe(true);
    expect(cacheable(new Response('html', { headers: { 'content-type': 'text/html' } }), 'json')).toBe(false);
  });
  it('не считает произвольный путь главной страницей', () => {
    expect(shellPath(new URL('https://app.example/?source=pwa'))).toBe(true);
    expect(shellPath(new URL('https://app.example/index.html'))).toBe(true);
    expect(shellPath(new URL('https://app.example/audio/missing.mp3'))).toBe(false);
  });
  it('не меняет путь записи без ревизии', () => expect(audioPath({ audio: '/audio/a.mp3' })).toBe('/audio/a.mp3'));
  it('кодирует ревизию, а не подставляет сырой query', () => expect(audioPath({ audio: '/audio/a.mp3', recording: { revision: '1&other=2' } })).toBe('/audio/a.mp3?v=1%26other%3D2'));
  it('использует настоящий SHA-256 для сравнения снимков', async () => {
    expect(await digest('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(await digest('new shell')).not.toBe(await digest('old shell'));
  });
});