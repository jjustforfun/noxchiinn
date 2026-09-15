import workerUrl from './service.js?worker&url';

const listeners = new Set();
let registration = null;
let pending = null;
let busy = false;
let checking = false;
const watched = new WeakSet();
let observingController = false;
let preparing = false;
let applying = false;
let status = { state: 'loading', message: 'Готовим приложение для дороги...', updateAvailable: false, audioReady: 0, audioTotal: 0, lastChecked: null };

function publish(patch) {
  status = { ...status, ...patch };
  for (const listener of listeners) listener(status);
}

/** Подписывает экран установки на проверенное состояние офлайн-кэша. */
export function watchPwa(listener) {
  listeners.add(listener); listener(status);
  return () => { listeners.delete(listener); };
}

/** Сообщает менеджеру обновления, что урок нельзя перезагружать. */
export function lessonActive(value) { busy = value; }

/** Отправляет worker короткий запрос с ограниченным временем ожидания. */
function message(worker, type, timeout = 12000) {
  return new Promise((resolve, reject) => {
    if (!worker) { reject(new Error('worker-not-ready')); return; }
    const channel = new MessageChannel();
    const timer = setTimeout(() => { channel.port1.close(); reject(new Error('worker-timeout')); }, timeout);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer); channel.port1.close();
      if (event.data?.protocol !== 2 || event.data.error || typeof event.data !== 'object') reject(new Error('worker-response'));
      else resolve(event.data);
    };
    try { worker.postMessage({ type }, [channel.port2]); }
    catch (error) { clearTimeout(timer); channel.port1.close(); reject(error); }
  });
}

function receive(value) {
  if (typeof value.ready !== 'boolean' || !Number.isInteger(value.audioReady) || !Number.isInteger(value.audioTotal) || value.audioReady < 0 || value.audioReady > value.audioTotal || value.audioTotal > 600) throw new Error('worker-status');
  publish({ state: value.ready ? 'ready' : 'error', message: value.ready ? 'Темы, картинки и интерфейс сохранены для офлайн-игры.' : 'Часть файлов ещё не сохранена. Подключись к сети и попробуй снова.', audioReady: value.audioReady, audioTotal: value.audioTotal });
}

/** Проверяет кэш после активации, не перезагружая никакую вкладку автоматически. */
async function probe() {
  try { receive(await message(registration?.active || navigator.serviceWorker.controller, 'STATUS')); }
  catch { publish({ state: 'error', message: 'Не удалось подтвердить офлайн-подготовку. Можно повторить проверку.' }); }
}

/** Регистрирует Workbox только в production и позволяет повторить неудачную установку. */
export function register() {
  if (!import.meta.env.PROD) { publish({ state: 'development', message: 'В режиме разработки кэш отключён. Офлайн-проверка доступна в production preview или на HTTPS-хостинге.' }); return Promise.resolve(false); }
  if (!window.isSecureContext || !('serviceWorker' in navigator)) { publish({ state: 'unsupported', message: 'Для установки и офлайн-режима нужен HTTPS и браузер с поддержкой Service Worker.' }); return Promise.resolve(false); }
  if (pending) return pending;
  publish({ state: 'loading', message: 'Сохраняем темы, картинки и интерфейс...' });
  pending = navigator.serviceWorker.register(`/sw.js?module=${encodeURIComponent(workerUrl)}`, { scope: '/', updateViaCache: 'none' }).then(async (result) => {
    registration = result;
    function inspect() {
      if (result.waiting && navigator.serviceWorker.controller) publish({ updateAvailable: true });
      if (result.active) void probe();
    }
    function watchInstalling() {
      const installing = result.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' || installing.state === 'activated') inspect();
        if (installing.state === 'redundant') publish({ state: 'error', message: 'Не удалось сохранить все файлы. Подключись к сети и повтори подготовку.' });
      });
    }
    if (!watched.has(result)) {
      watched.add(result);
      result.addEventListener('updatefound', watchInstalling);
      watchInstalling();
    }
    inspect();
    if (!observingController) {
      observingController = true;
      navigator.serviceWorker.addEventListener('controllerchange', () => { void probe(); });
    }
    return Boolean(result.active);
  }).catch(() => { publish({ state: 'error', message: 'Офлайн-подготовка не завершилась. Игра в открытой вкладке остаётся доступной.' }); return false; }).finally(() => { pending = null; });
  return pending;
}

/** По запросу проверяет свежий снимок, не прерывая текущую игру. */
export async function checkUpdate() {
  if (checking) return;
  if (!registration) { await register(); return; }
  checking = true;
  try {
    await limited(registration.update(), 12000);
    const value = await message(registration.active, 'CHECK_UPDATE');
    receive(value);
    publish({ updateAvailable: status.updateAvailable || Boolean(value.changed) || Boolean(registration.waiting), lastChecked: Date.now(), message: value.changed || registration.waiting ? 'Новая версия подготовлена. Обновимся после урока.' : 'Офлайн-кэш проверен. У тебя актуальная версия.' });
  } catch { publish({ message: 'Сейчас не удалось проверить обновление. Сохранённые уроки не удалены.' }); }
  finally { checking = false; }
}

/** Повторяет загрузку разрешённых записей, если отдельные файлы были недоступны. */
export async function prepareOffline() {
  if (preparing) return;
  if (!registration?.active) { await register(); return; }
  preparing = true;
  publish({ state: 'loading', message: 'Проверяем сохранённые файлы...' });
  try { receive(await message(registration.active, 'PREPARE_AUDIO', 60000)); }
  catch { publish({ state: 'error', message: 'Подготовка не завершилась. Попробуй ещё раз с устойчивым интернетом.' }); }
  finally { preparing = false; }
}

/** Ограничивает браузерную операцию, которую нельзя отменить стандартным AbortSignal. */
async function limited(promise, milliseconds) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), milliseconds); })]); }
  finally { clearTimeout(timer); }
}

/** Применяет обновление только по нажатию пользователя и вне урока. */
export async function applyUpdate() {
  if (applying || busy) { publish({ message: 'Сначала закончи урок или сохрани паузу. Обновление подождёт.' }); return; }
  if (registration?.installing && !registration.waiting) { publish({ message: 'Файлы ещё готовятся. Попробуй применить обновление немного позже.' }); return; }
  applying = true;
  const waiting = registration?.waiting;
  try {
    if (waiting) {
      const changed = await new Promise((resolve, reject) => {
        let done = false;
        function cleanup() { clearTimeout(timer); navigator.serviceWorker.removeEventListener('controllerchange', finish); }
        function finish() { if (done) return; done = true; cleanup(); resolve(true); }
        const timer = setTimeout(() => { if (done) return; done = true; cleanup(); reject(new Error('activation-timeout')); }, 10000);
        navigator.serviceWorker.addEventListener('controllerchange', finish);
        message(waiting, 'SKIP_WAITING', 6000).then((reply) => {
          if (reply.blocked && !done) { done = true; cleanup(); resolve(false); }
        }).catch((error) => { if (!done) { done = true; cleanup(); reject(error); } });
      });
      if (!changed) { publish({ message: 'Закрой другие вкладки игры перед обновлением, чтобы не прервать чужой раунд.' }); return; }
    }
    if (!busy) window.location.reload();
  } catch { publish({ message: 'Обновление не подтвердилось. Текущая игра не перезагружена. Попробуй позже.' }); }
  finally { applying = false; }
}