import motivation from '../data/motivation.json';

export const REMINDER_TAG = 'nohchiin-mott-study';
export const TEST_TAG = 'nohchiin-mott-study-test';
let lastTest = 0;
let deliveryEpoch = 0;
let testPending = false;

/** Читает разрешение браузера, не запрашивая его автоматически и не записывая в профиль. */
export function notificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  if (!window.isSecureContext) return 'insecure';
  if (window.top !== window.self) return 'embedded';
  return Notification.permission;
}

/** Запрашивает разрешение только после явного действия подтвердившего согласие взрослого. */
export async function requestNotifications(consent) {
  if (consent !== true) return { ok: false, permission: notificationPermission(), message: 'Сначала подтвердите, что вы взрослый и согласны на напоминания.' };
  const state = notificationPermission();
  if (state === 'granted') return { ok: true, permission: state, message: 'Системные уведомления уже разрешены. Сохраните настройки, чтобы включить напоминания.' };
  if (state === 'denied') return { ok: false, permission: state, message: 'Браузер запретил уведомления. Разрешение меняется в настройках сайта, повторно спрашивать не будем.' };
  if (state !== 'default') return { ok: false, permission: state, message: state === 'embedded' ? 'Откройте приложение отдельной вкладкой. Встроенный предпросмотр не может запрашивать уведомления.' : 'Для системных уведомлений нужен поддерживаемый браузер и HTTPS. Напоминание внутри игры доступно без них.' };
  try {
    // До вызова requestPermission нет await: сохраняем прямое пользовательское действие.
    const permission = await Notification.requestPermission();
    return { ok: permission === 'granted', permission, message: permission === 'granted' ? 'Разрешение получено. Сохраните настройки, чтобы включить напоминания.' : 'Разрешение не получено. Можно оставить подсказку только внутри игры.' };
  } catch { return { ok: false, permission: notificationPermission(), message: 'Браузер не смог запросить разрешение. Напоминания внутри игры не требуют этого доступа.' }; }
}

/** Формирует нейтральное уведомление без имени ребёнка, XP или истории занятий. */
export function notificationOptions(test = false) {
  return { body: test ? 'Это проверка. Регулярные подсказки работают только при открытой игре.' : motivation.reminder.body, icon: '/icons/icon.svg', tag: test ? TEST_TAG : REMINDER_TAG, lang: 'ru', silent: true, renotify: false, requireInteraction: false, data: { kind: 'study-reminder' } };
}

/** Ограничивает ожидание браузерного API, не зависая на serviceWorker.ready. */
async function timed(promise, limit = 5000) {
  let timer;
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), limit); })]); }
  finally { clearTimeout(timer); }
}

/** Показывает локальное системное уведомление через активный worker, не через Push API. */
export async function showReminderNotification(consent, test = false, allowed = () => true) {
  if (consent !== true || notificationPermission() !== 'granted') return { ok: false, message: 'Системное уведомление не разрешено. Покажем обычную подсказку в игре.' };
  if (test && (testPending || Date.now() - lastTest < 15000)) return { ok: false, message: 'Проверка уже отправлена. Подождите несколько секунд, прежде чем повторять.' };
  const epoch = deliveryEpoch;
  if (test) testPending = true;
  try {
    const registration = await timed(navigator.serviceWorker.getRegistration('/'));
    if (!registration?.active || typeof registration.showNotification !== 'function') return { ok: false, message: 'Service Worker ещё не активен. Откройте опубликованную HTTPS-сборку и дождитесь офлайн-подготовки.' };
    if (registration.installing || registration.waiting) return { ok: false, message: 'Сначала примените обновление приложения. Пока напоминание останется внутри игры.' };
    if (epoch !== deliveryEpoch || !allowed() || notificationPermission() !== 'granted') return { ok: false, message: 'Напоминание отменено. Настройки или состояние приложения изменились.' };
    if (test) lastTest = Date.now();
    let expired = false;
    const sent = Promise.resolve(registration.showNotification(test ? 'Проверка Нохчийн Мотт' : motivation.reminder.title, notificationOptions(test)));
    void sent.then(async () => {
      if (expired || epoch !== deliveryEpoch || !allowed()) {
        const messages = await registration.getNotifications?.({ tag: test ? TEST_TAG : REMINDER_TAG });
        messages?.forEach((notification) => notification.close());
      }
    }).catch(() => undefined);
    try { await timed(sent); } catch (error) { expired = true; throw error; }
    if (epoch !== deliveryEpoch || !allowed()) return { ok: false, message: 'Напоминание отменено после изменения настроек.' };
    return { ok: true, message: 'Браузер принял уведомление. Его показ зависит от режима «Не беспокоить» и настроек устройства.' };
  } catch { return { ok: false, message: 'Не удалось показать системное уведомление. Можно пользоваться подсказкой внутри игры.' }; }
  finally { if (test) testPending = false; }
}

/** Закрывает только уведомления этой игры; разрешение браузера остаётся под контролем пользователя. */
export async function closeReminderNotifications() {
  deliveryEpoch++;
  try {
    if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
    const registration = await timed(navigator.serviceWorker.getRegistration('/'));
    if (!registration?.getNotifications) return;
    const notifications = await timed(registration.getNotifications());
    notifications.filter((notification) => [REMINDER_TAG, TEST_TAG].includes(notification.tag)).forEach((notification) => notification.close());
  } catch { /* Неуспешное закрытие не включает напоминания обратно. */ }
}