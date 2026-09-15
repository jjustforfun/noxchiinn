import { recorded } from './catalog.js';
import { audioPath } from './cache.js';
import { stopEffects } from './effects.js';

const MESSAGES = {
  pending: 'Запись носителя ещё готовится. Пока можно учиться по буквам.',
  permission: 'Эта запись пока не прошла проверку и согласование. Выбери режим с буквами.',
  blocked: 'Браузер не разрешил звук. Нажми «Послушать» ещё раз.',
  timeout: 'Звук загружается слишком долго. Попробуй снова или продолжи по буквам.',
  network: 'Не получилось включить запись. Попробуй снова или продолжи по буквам. Жизни не тратятся.',
};

/** Создаёт один тестируемый проигрыватель с отменой, тайм-аутом и событиями состояния. */
export function createPlayer(factory = () => new Audio(), timeout = 10000) {
  let active = null;
  let state = { status: 'idle', id: null, message: '' };
  const listeners = new Set();

  function publish(status, id = null, message = '') {
    state = { status, id, message };
    for (const listener of listeners) listener(state);
  }

  function release(session) {
    clearTimeout(session.timer);
    for (const [name, handler] of session.events) session.audio.removeEventListener(name, handler);
    try { session.audio.pause(); session.audio.removeAttribute('src'); session.audio.load(); } catch { /* Освобождение не должно мешать закрытию окна. */ }
  }

  /** Останавливает запись и разрешает незавершённое ожидание без ложной ошибки. */
  function stop() {
    const previous = active;
    active = null;
    if (previous) { release(previous); previous.resolve?.({ ok: false, code: 'cancelled', message: '' }); }
    publish('idle');
  }

  /** Воспроизводит только согласованный локальный файл, без TTS и автозапуска. */
  function play(item, onError) {
    stop();
    const code = item?.audioStatus !== 'ready' ? 'pending' : !recorded(item) ? 'permission' : null;
    if (code) {
      publish('error', item?.id, MESSAGES[code]);
      return Promise.resolve({ ok: false, code, message: MESSAGES[code] });
    }
    return new Promise((resolve) => {
      let audio;
      try { audio = factory(); } catch { publish('error', item.id, MESSAGES.network); resolve({ ok: false, code: 'network', message: MESSAGES.network }); return; }
      const session = { audio, resolve, events: [], timer: null };
      active = session;

      function fail(reason) {
        if (active !== session) return;
        active = null;
        release(session);
        const message = MESSAGES[reason];
        publish('error', item.id, message);
        resolve({ ok: false, code: reason, message });
        onError?.(message);
      }
      function wait() {
        if (active !== session) return;
        clearTimeout(session.timer);
        session.timer = setTimeout(() => fail('timeout'), timeout);
        publish('loading', item.id);
      }
      function started() {
        if (active !== session) return;
        clearTimeout(session.timer);
        publish('playing', item.id);
        resolve({ ok: true, code: 'playing', message: '' });
      }
      function ended() {
        if (active !== session) return;
        active = null;
        release(session);
        publish('ended', item.id);
        resolve({ ok: true, code: 'ended', message: '' });
      }
      session.events = [['playing', started], ['ended', ended], ['error', () => fail('network')], ['waiting', wait], ['stalled', wait]];
      for (const [name, handler] of session.events) audio.addEventListener(name, handler);
      audio.preload = 'auto';
      audio.src = audioPath(item);
      wait();
      try { Promise.resolve(audio.play()).then(started).catch((error) => fail(error?.name === 'NotAllowedError' ? 'blocked' : 'network')); }
      catch { fail('network'); }
    });
  }

  /** Подписывает интерфейс на реальное состояние записи, возвращает отписку. */
  function subscribe(listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  }

  return { play, stop, subscribe };
}

const player = createPlayer();

/**
 * Воспроизводит запись через общий для приложения проигрыватель.
 * @param {object} item Карточка из JSON.
 * @param {(message: string) => void} [onError] Подсказка о поздней ошибке.
 */
export function play(item, onError = undefined) { stopEffects(); return player.play(item, onError); }

/** Останавливает общую запись при переходе или паузе. */
export function stop() { player.stop(); }

/** Подключает индикатор загрузки и завершения воспроизведения. */
export function subscribeAudio(listener) { return player.subscribe(listener); }