import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPlayer } from '../src/audio.js';

const recording = { id: 'a', audio: '/audio/alphabet-a.mp3', audioStatus: 'ready', recording: { reviewed: true, permission: 'test-fixture-only' } };

function fakeAudio(implementation = () => Promise.resolve()) {
  const listeners = new Map();
  return {
    src: '', preload: '',
    play: vi.fn(implementation), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(),
    addEventListener: vi.fn((name, handler) => listeners.set(name, handler)),
    removeEventListener: vi.fn((name) => listeners.delete(name)),
    fire(name) { listeners.get(name)?.(); },
    count() { return listeners.size; },
  };
}

afterEach(() => vi.useRealTimers());

describe('AudioPlayer без настоящих записей в тестах', () => {
  it('не создаёт аудио для pending', async () => {
    const factory = vi.fn();
    const player = createPlayer(factory);
    const result = await player.play({ ...recording, audioStatus: 'pending' });
    expect(result.code).toBe('pending');
    expect(factory).not.toHaveBeenCalled();
  });
  it('не играет файл без согласия и фонетической проверки', async () => {
    const factory = vi.fn(); const player = createPlayer(factory);
    expect((await player.play({ ...recording, recording: { reviewed: false, permission: '' } })).ok).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });
  it('не обращается к внешнему origin', async () => {
    const factory = vi.fn(); const player = createPlayer(factory);
    expect((await player.play({ ...recording, audio: '//example.org/voice.mp3' })).ok).toBe(false);
    expect(factory).not.toHaveBeenCalled();
  });
  it('различает загрузку, начало и окончание записи', async () => {
    const audio = fakeAudio(); const player = createPlayer(() => audio); const events = [];
    const unsubscribe = player.subscribe((event) => events.push(event.status));
    expect((await player.play(recording)).ok).toBe(true);
    expect(events).toContain('loading');
    expect(events.at(-1)).toBe('playing');
    audio.fire('ended');
    expect(events.at(-1)).toBe('ended');
    expect(audio.count()).toBe(0);
    unsubscribe();
  });
  it('возвращает понятную ошибку при запрете браузера', async () => {
    const audio = fakeAudio(() => Promise.reject({ name: 'NotAllowedError' }));
    const player = createPlayer(() => audio);
    expect((await player.play(recording)).code).toBe('blocked');
    expect(audio.pause).toHaveBeenCalled();
  });
  it('обрабатывает отсутствие или ошибку декодирования файла', async () => {
    const audio = fakeAudio(() => Promise.reject(new Error('missing')));
    const player = createPlayer(() => audio);
    const result = await player.play(recording);
    expect(result.code).toBe('network');
    expect(result.message).toContain('Жизни не тратятся');
  });
  it('не ждёт бесконечно зависшую загрузку', async () => {
    vi.useFakeTimers();
    const audio = fakeAudio(() => new Promise(() => undefined));
    const player = createPlayer(() => audio, 1000);
    const result = player.play(recording);
    await vi.advanceTimersByTimeAsync(1001);
    expect((await result).code).toBe('timeout');
    expect(audio.count()).toBe(0);
  });
  it('обрабатывает поздний обрыв после начала воспроизведения', async () => {
    const audio = fakeAudio(); const player = createPlayer(() => audio); const error = vi.fn();
    await player.play(recording, error);
    audio.fire('error');
    expect(error).toHaveBeenCalledOnce();
    expect(audio.count()).toBe(0);
  });
  it('останавливает ожидание при закрытии окна', async () => {
    const audio = fakeAudio(() => new Promise(() => undefined)); const player = createPlayer(() => audio);
    const pending = player.play(recording);
    player.stop();
    expect((await pending).code).toBe('cancelled');
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(audio.count()).toBe(0);
  });
  it('поздняя ошибка старого play не выключает новую запись', async () => {
    let rejectOld;
    const first = fakeAudio(() => new Promise((_, reject) => { rejectOld = reject; }));
    const second = fakeAudio();
    const factory = vi.fn().mockReturnValueOnce(first).mockReturnValueOnce(second);
    const player = createPlayer(factory);
    const old = player.play(recording);
    await player.play({ ...recording, id: 'b' });
    rejectOld(new Error('cancelled'));
    await Promise.resolve();
    expect((await old).code).toBe('cancelled');
    expect(second.pause).not.toHaveBeenCalled();
    player.stop();
  });
  it('добавляет версию записи к ключу кэша', async () => {
    const audio = fakeAudio(); const player = createPlayer(() => audio);
    await player.play({ ...recording, recording: { ...recording.recording, revision: 'recording-2' } });
    expect(audio.src).toBe('/audio/alphabet-a.mp3?v=recording-2');
    player.stop();
  });
  it('отписка прекращает уведомления интерфейса', () => {
    const listener = vi.fn(); const player = createPlayer(() => fakeAudio());
    const unsubscribe = player.subscribe(listener); unsubscribe(); player.stop();
    expect(listener).toHaveBeenCalledOnce();
  });
});