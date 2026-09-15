import { afterEach, describe, expect, it, vi } from 'vitest';
import { reminderDue, reserveReminder } from '../src/reminders.js';
import { day, defaults } from '../src/progress.js';
import { notificationOptions, notificationPermission, requestNotifications, showReminderNotification, closeReminderNotifications } from '../src/notifications.js';
import { openReminder } from '../src/notification-worker.js';

const now = new Date(2026, 8, 14, 18, 5).getTime();
const today = day(new Date(now));
function enabled() { const state = defaults(now); state.preferences.reminders = { ...state.preferences.reminders, enabled: true, consent: true, time: '18:00', days: [1] }; return state; }
function browser(permission = 'default') {
  const api = { permission, requestPermission: vi.fn().mockResolvedValue('granted') };
  const registration = { active: {}, showNotification: vi.fn().mockResolvedValue(undefined), getNotifications: vi.fn().mockResolvedValue([]) };
  const win = { Notification: api, isSecureContext: true }; win.self = win; win.top = win;
  vi.stubGlobal('window', win); vi.stubGlobal('Notification', api);
  vi.stubGlobal('navigator', { serviceWorker: { getRegistration: vi.fn().mockResolvedValue(registration) } });
  return { api, registration, win };
}
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Бережное расписание', () => {
  it('не напоминает по умолчанию', () => expect(reminderDue(defaults(now), now)).toBe(false));
  it('срабатывает в выбранный день после времени', () => expect(reminderDue(enabled(), now)).toBe(true));
  it('не срабатывает без явного согласия', () => { const state = enabled(); state.preferences.reminders.consent = false; expect(reminderDue(state, now)).toBe(false); });
  it('не мешает уроку или скрытой вкладке', () => expect(reminderDue(enabled(), now, false)).toBe(false));
  it('не срабатывает раньше расписания', () => expect(reminderDue(enabled(), new Date(2026, 8, 14, 17, 59).getTime())).toBe(false));
  it('не накапливает просроченные подсказки', () => expect(reminderDue(enabled(), new Date(2026, 8, 14, 20, 1).getTime())).toBe(false));
  it('не показывает ничего после 21:00', () => { const state = enabled(); state.preferences.reminders.time = '20:30'; expect(reminderDue(state, new Date(2026, 8, 14, 21).getTime())).toBe(false); });
  it('пропускает невыбранный день', () => expect(reminderDue(enabled(), now + 86400000)).toBe(false));
  it('не напоминает после занятия, даже без продления серии', () => { const state = enabled(); state.activity[today] = { rounds: 1 }; expect(reminderDue(state, now)).toBe(false); });
  it('не напоминает после старого успешного занятия того же дня', () => { const state = enabled(); state.lastPlayed = today; expect(reminderDue(state, now)).toBe(false); });
  it('не повторяет напоминание в тот же день', () => { const state = enabled(); state.preferences.reminders.lastDay = today; expect(reminderDue(state, now)).toBe(false); });
  it('соблюдает cooldown после смены часового пояса', () => { const state = enabled(); state.preferences.reminders.lastAt = now - 3600000; expect(reminderDue(state, now)).toBe(false); });
  it('сначала резервирует день в localStorage и не резервирует второй раз', () => {
    let stored = JSON.stringify(enabled());
    vi.stubGlobal('localStorage', { getItem: () => stored, setItem: (_, raw) => { stored = raw; } });
    const first = reserveReminder(enabled(), now);
    expect(first.preferences.reminders.lastDay).toBe(today);
    expect(reserveReminder(enabled(), now + 1000)).toBe(null);
  });
  it('не отправляет напоминание, если не удалось записать ограничитель', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(enabled()), setItem() { throw new Error('quota'); } });
    expect(reserveReminder(enabled(), now)).toBe(null);
  });
  it('не применяет запрос от сброшенного профиля', () => {
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify({ ...enabled(), generation: 'another' }), setItem: vi.fn() });
    expect(reserveReminder(enabled(), now)).toBe(null);
  });
});

describe('Настоящее разрешение браузера', () => {
  it('чтение состояния не запрашивает разрешение', () => { const { api } = browser(); expect(notificationPermission()).toBe('default'); expect(api.requestPermission).not.toHaveBeenCalled(); });
  it('без согласия не вызывает requestPermission', async () => { const { api } = browser(); expect((await requestNotifications(false)).ok).toBe(false); expect(api.requestPermission).not.toHaveBeenCalled(); });
  it('не спрашивает повторно после отказа', async () => { const { api } = browser('denied'); expect((await requestNotifications(true)).ok).toBe(false); expect(api.requestPermission).not.toHaveBeenCalled(); });
  it('спрашивает после согласия и обрабатывает granted', async () => { const { api } = browser(); expect((await requestNotifications(true)).ok).toBe(true); expect(api.requestPermission).toHaveBeenCalledOnce(); });
  it('обрабатывает закрытие окна разрешения без granted', async () => { const { api } = browser(); api.requestPermission.mockResolvedValue('default'); expect((await requestNotifications(true)).ok).toBe(false); });
  it('обрабатывает встроенный предпросмотр без попытки запроса', async () => { const { win, api } = browser(); win.top = {}; expect((await requestNotifications(true)).permission).toBe('embedded'); expect(api.requestPermission).not.toHaveBeenCalled(); });
  it('использует ServiceWorkerRegistration, не Notification-конструктор', async () => {
    const { registration } = browser('granted');
    expect((await showReminderNotification(true)).ok).toBe(true);
    expect(registration.showNotification).toHaveBeenCalledOnce();
  });
  it('не зависает на serviceWorker.ready без активного worker', async () => {
    browser('granted'); navigator.serviceWorker.getRegistration.mockResolvedValue(undefined);
    expect((await showReminderNotification(true)).ok).toBe(false);
  });
  it('не отправляет после отзыва согласия во время ожидания', async () => {
    const { registration } = browser('granted');
    expect((await showReminderNotification(true, false, () => false)).ok).toBe(false);
    expect(registration.showNotification).not.toHaveBeenCalled();
  });
  it('обрабатывает исключение API без падения', async () => {
    const { registration } = browser('granted'); registration.showNotification.mockRejectedValue(new Error('blocked'));
    expect((await showReminderNotification(true)).ok).toBe(false);
  });
  it('payload не содержит имя, очки, расписание или историю ребёнка', () => {
    const options = notificationOptions();
    expect(options.data).toEqual({ kind: 'study-reminder' }); expect(options.silent).toBe(true); expect(options.renotify).toBe(false);
    expect(JSON.stringify(options)).not.toMatch(/profile|streak|xp|name|endpoint|subscription/);
  });
  it('выключение закрывает только уведомления игры', async () => {
    const { registration } = browser('granted'); const own = { tag: 'nohchiin-mott-study', close: vi.fn() }; const other = { tag: 'another-feature', close: vi.fn() };
    registration.getNotifications.mockResolvedValue([own, other]); await closeReminderNotifications();
    expect(own.close).toHaveBeenCalledOnce(); expect(other.close).not.toHaveBeenCalled();
  });
});

describe('Нажатие системного уведомления', () => {
  it('фокусирует игру, не перезагружая текущий урок', async () => {
    const client = { url: 'https://game.example/#practice', focus: vi.fn(), postMessage: vi.fn(), navigate: vi.fn() };
    const clients = { matchAll: vi.fn().mockResolvedValue([client]), openWindow: vi.fn() };
    const event = { notification: { tag: 'nohchiin-mott-study', close: vi.fn() } };
    expect(await openReminder(event, clients, 'https://game.example')).toBe(true);
    expect(client.focus).toHaveBeenCalledOnce(); expect(client.navigate).not.toHaveBeenCalled(); expect(clients.openWindow).not.toHaveBeenCalled();
  });
  it('не открывает произвольный URL из payload', async () => {
    const clients = { matchAll: vi.fn().mockResolvedValue([]), openWindow: vi.fn() };
    await openReminder({ notification: { tag: 'nohchiin-mott-study', data: { url: 'https://evil.example' }, close: vi.fn() } }, clients, 'https://game.example');
    expect(clients.openWindow).toHaveBeenCalledWith('https://game.example/#learn');
  });
  it('игнорирует уведомления другого типа', async () => {
    const clients = { matchAll: vi.fn(), openWindow: vi.fn() };
    expect(await openReminder({ notification: { tag: 'other' } }, clients, 'https://game.example')).toBe(false); expect(clients.matchAll).not.toHaveBeenCalled();
  });
});