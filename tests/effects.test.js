import { afterEach, describe, expect, it, vi } from 'vitest';
import { createEffects } from '../src/effects.js';
import effects from '../data/effects.json';

function context() {
  const oscillators = []; const gains = [];
  const ctx = {
    state: 'running', currentTime: 0, destination: {},
    resume: vi.fn(async () => { ctx.state = 'running'; }),
    suspend: vi.fn(async () => { ctx.state = 'suspended'; }),
    createOscillator: vi.fn(() => {
      const node = { type: '', frequency: { setValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null };
      oscillators.push(node); return node;
    }),
    createGain: vi.fn(() => {
      const node = { gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() };
      gains.push(node); return node;
    }),
  };
  return { ctx, oscillators, gains };
}
const settings = { effects: true, volume: 35 };
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('Неголосовые звуковые эффекты', () => {
  it('не создаёт AudioContext до первого действия', () => { const factory = vi.fn(); createEffects(factory); expect(factory).not.toHaveBeenCalled(); });
  it('не создаёт аудио при выключенном звуке', async () => { const factory = vi.fn(); const player = createEffects(factory); expect(await player.play('success', { ...settings, effects: false })).toBe(false); expect(factory).not.toHaveBeenCalled(); });
  it('не играет в скрытой вкладке', async () => { const factory = vi.fn(); expect(await createEffects(factory).play('success', settings, true)).toBe(false); expect(factory).not.toHaveBeenCalled(); });
  it('нулевая громкость действительно выключает звук', async () => { const factory = vi.fn(); expect(await createEffects(factory).play('retry', { ...settings, volume: 0 })).toBe(false); expect(factory).not.toHaveBeenCalled(); });
  it('не принимает неизвестные или унаследованные названия', async () => { const factory = vi.fn(); expect(await createEffects(factory).play('__proto__', settings)).toBe(false); expect(factory).not.toHaveBeenCalled(); });
  it('не принимает нечисловую громкость', async () => expect(await createEffects(vi.fn()).play('success', { effects: true, volume: NaN })).toBe(false));
  it('успех состоит из двух тихих синусоидальных тонов', async () => {
    vi.useFakeTimers(); const { ctx, oscillators, gains } = context(); const player = createEffects(() => ctx);
    expect(await player.play('success', settings)).toBe(true); expect(oscillators).toHaveLength(2);
    expect(oscillators.every((node) => node.type === 'sine')).toBe(true);
    expect(gains[0].gain.linearRampToValueAtTime.mock.calls[0][0]).toBeCloseTo(.035);
    player.stop();
  });
  it('остановка выключает узлы и освобождает устройство', async () => {
    vi.useFakeTimers(); const { ctx, oscillators, gains } = context(); const player = createEffects(() => ctx);
    await player.play('success', settings); player.stop();
    expect(oscillators[0].disconnect).toHaveBeenCalled(); expect(gains[0].disconnect).toHaveBeenCalled(); expect(ctx.suspend).toHaveBeenCalled();
  });
  it('по окончании тихого сигнала контекст засыпает', async () => {
    vi.useFakeTimers(); const { ctx } = context(); const player = createEffects(() => ctx);
    await player.play('success', settings); await vi.advanceTimersByTimeAsync(1300);
    expect(ctx.suspend).toHaveBeenCalledOnce(); player.stop();
  });
  it('не проигрывает отложенный тон после выключения', async () => {
    vi.useFakeTimers(); let resume;
    const { ctx } = context(); ctx.resume = vi.fn(() => new Promise((resolve) => { resume = resolve; }));
    const player = createEffects(() => ctx); const pending = player.play('success', settings);
    player.stop(); resume(); expect(await pending).toBe(false); expect(ctx.createOscillator).not.toHaveBeenCalled();
  });
  it('не ждёт бесконечно запрет автозапуска', async () => {
    vi.useFakeTimers(); const { ctx } = context(); ctx.resume = vi.fn(() => new Promise(() => undefined));
    const pending = createEffects(() => ctx).play('success', settings);
    await vi.advanceTimersByTimeAsync(1600); expect(await pending).toBe(false);
  });
  it('ошибка Web Audio не прерывает игру', async () => expect(await createEffects(() => { throw new Error('unsupported'); }).play('success', settings)).toBe(false));
  it('все сигналы короче секунды и не содержат речи', () => {
    for (const effect of Object.values(effects)) {
      expect(effect.volume).toBeLessThanOrEqual(.1);
      expect(effect.notes.every((note) => note.at + note.duration < 1 && note.hz >= 300 && note.hz <= 1000)).toBe(true);
      expect(effect).not.toHaveProperty('text'); expect(effect).not.toHaveProperty('audio');
    }
  });
});