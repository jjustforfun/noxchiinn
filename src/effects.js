import effects from '../data/effects.json';

/** Создаёт маленький проигрыватель неголосовых тонов без загрузок и доступа к микрофону. */
export function createEffects(factory = () => new AudioContext()) {
  let context = null;
  let generation = 0;
  let sleep = null;
  const active = new Set();

  /** Немедленно убирает все тоны, включая ожидающие разрешения на воспроизведение. */
  function cancel(suspend) {
    generation++;
    clearTimeout(sleep);
    for (const node of active) {
      try { node.oscillator.stop(); node.oscillator.disconnect(); node.gain.disconnect(); } catch { /* Уже завершённый тон безопасно игнорируется. */ }
    }
    active.clear();
    try { if (suspend && context?.state === 'running') Promise.resolve(context.suspend()).catch(() => undefined); } catch { /* Звук не должен ломать игру. */ }
  }

  /** Останавливает звук и освобождает аудиоустройство после пользовательского отключения. */
  function stop() { cancel(true); }

  /** Воспроизводит мягкий сигнал только из пользовательского действия и при включённом звуке. */
  async function play(kind, settings, hidden = false) {
    cancel(false);
    if (!settings?.effects || !Number.isFinite(settings.volume) || settings.volume <= 0 || hidden || !Object.hasOwn(effects, kind)) { stop(); return false; }
    const token = generation;
    try {
      if (!context || context.state === 'closed') context = factory();
      let timer;
      try { await Promise.race([context.resume(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('audio-timeout')), 1500); })]); }
      finally { clearTimeout(timer); }
      if (token !== generation || context.state !== 'running') return false;
      const effect = effects[kind];
      const volume = Math.max(0, Math.min(100, settings.volume)) / 100 * effect.volume;
      const start = context.currentTime + .01;
      for (const note of effect.notes) {
        const oscillator = context.createOscillator(); const gain = context.createGain();
        const node = { oscillator, gain }; active.add(node);
        oscillator.type = 'sine'; oscillator.frequency.setValueAtTime(note.hz, start + note.at);
        gain.gain.setValueAtTime(0, start + note.at);
        gain.gain.linearRampToValueAtTime(volume, start + note.at + .012);
        gain.gain.exponentialRampToValueAtTime(.0001, start + note.at + note.duration);
        oscillator.connect(gain); gain.connect(context.destination);
        oscillator.onended = () => { active.delete(node); oscillator.disconnect(); gain.disconnect(); };
        oscillator.start(start + note.at); oscillator.stop(start + note.at + note.duration + .01);
      }
      sleep = setTimeout(() => { if (token === generation) { try { Promise.resolve(context.suspend()).catch(() => undefined); } catch { /* Нет активного аудио. */ } } }, 1200);
      return true;
    } catch { if (token === generation) stop(); return false; }
  }

  return { play, stop };
}

const player = createEffects();

/** Включает неголосовой эффект; не читает и не синтезирует чеченский текст. */
export function playEffect(kind, settings) { return player.play(kind, settings, typeof document !== 'undefined' && document.hidden); }

/** Останавливает эффекты при выключении звука, паузе, речи или закрытии урока. */
export function stopEffects() { player.stop(); }