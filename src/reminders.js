import motivation from '../data/motivation.json';
import { day, weekday } from './calendar.js';
import { validTime } from './preferences.js';
import { save, PROGRESS_LOCK, readProgress } from './progress.js';

/** Решает, уместна ли одна подсказка: только днём, без урока и до первого занятия за день. */
export function reminderDue(profile, now = Date.now(), available = true) {
  const settings = profile.preferences?.reminders;
  if (!available || !settings?.enabled || !settings.consent || !validTime(settings.time) || !Array.isArray(settings.days)) return false;
  const date = new Date(now); const today = day(date);
  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  const elapsed = date.getHours() * 60 + date.getMinutes() - Number(settings.time.slice(0, 2)) * 60 - Number(settings.time.slice(3));
  if (!settings.days.includes(weekday(today)) || clock < motivation.reminder.minimumTime || clock >= motivation.reminder.quietAfter || elapsed < 0 || elapsed >= motivation.reminder.windowMinutes) return false;
  if (profile.activity?.[today]?.rounds > 0 || profile.lastPlayed && profile.lastPlayed >= today) return false;
  if (settings.lastDay === today || settings.lastAt > 0 && now - settings.lastAt < motivation.reminder.cooldownHours * 3600000) return false;
  return true;
}

/** Резервирует дневную подсказку до показа, чтобы перезагрузка не повторяла её. */
export function reserveReminder(profile, now = Date.now(), available = true) {
  try {
    const snapshot = readProgress(now);
    if (snapshot.status !== 'ready') return null;
    const current = snapshot.profile;
    if (current.generation !== profile.generation || !reminderDue(current, now, available)) return null;
    const next = { ...current, updatedAt: Math.max(now, current.updatedAt + 1), preferences: { ...current.preferences, reminders: { ...current.preferences.reminders, lastDay: day(new Date(now)), lastAt: now } } };
    return save(next, snapshot.raw) ? next : null;
  } catch { return null; }
}

/** Согласует показ между вкладками через Web Locks, без сервера и персональных идентификаторов. */
export async function claimReminder(profile, available) {
  const reserve = () => reserveReminder(profile, Date.now(), available());
  try {
    if (navigator.locks?.request) return await navigator.locks.request(PROGRESS_LOCK, { ifAvailable: true }, (lock) => lock ? reserve() : null);
    // В старом браузере показываем только в единственной вкладке, имеющей фокус.
    return document.hasFocus() ? reserve() : null;
  } catch { return null; }
}

/** Перед доставкой повторно проверяет именно сохранённое согласие, а не старое состояние вкладки. */
export function deliveryAllowed(expected, now = Date.now()) {
  const snapshot = readProgress(now);
  if (snapshot.status !== 'ready' || snapshot.profile.generation !== expected.generation) return false;
  const current = snapshot.profile;
  const settings = current.preferences.reminders;
  if (settings.lastAt !== expected.preferences.reminders.lastAt || settings.lastDay !== expected.preferences.reminders.lastDay || settings.channel !== expected.preferences.reminders.channel) return false;
  return reminderDue({ ...current, preferences: { ...current.preferences, reminders: { ...settings, lastAt: 0, lastDay: null } } }, now, true);
}