import motivation from '../data/motivation.json';
import { day, shift, validDay } from './calendar.js';
import { record } from './input.js';

/** Создаёт безопасные настройки: никаких напоминаний до согласия взрослого. */
export function preferenceDefaults() {
  return { dailyGoal: 20, effects: true, volume: 35, reminders: { enabled: false, consent: false, channel: 'in-app', time: '18:00', days: [1, 2, 3, 4, 5, 6, 7], lastDay: null, lastAt: 0 } };
}

/** Проверяет время в дневном диапазоне; ночные напоминания запрещены. */
export function validTime(value) {
  return typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value) && value >= motivation.reminder.minimumTime && value <= motivation.reminder.maximumTime;
}

/** Фильтрует настройки из файла или localStorage, не доверяя импортированному согласию. */
export function cleanPreferences(value, now = Date.now()) {
  const base = preferenceDefaults();
  if (!record(value)) return base;
  const raw = record(value.reminders) ? value.reminders : {};
  const days = Array.isArray(raw.days) ? [...new Set(raw.days.filter((value) => Number.isInteger(value) && value >= 1 && value <= 7))].sort() : base.reminders.days;
  return {
    dailyGoal: motivation.goals.some((goal) => goal.xp === value.dailyGoal) ? value.dailyGoal : base.dailyGoal,
    effects: typeof value.effects === 'boolean' ? value.effects : base.effects,
    volume: typeof value.volume === 'number' && Number.isFinite(value.volume) ? Math.max(0, Math.min(100, Math.round(value.volume))) : base.volume,
    reminders: {
      enabled: raw.enabled === true && raw.consent === true && validTime(raw.time) && days.length > 0,
      consent: raw.consent === true, channel: raw.channel === 'system' ? 'system' : 'in-app', time: validTime(raw.time) ? raw.time : base.reminders.time, days,
      lastDay: validDay(raw.lastDay) && raw.lastDay <= shift(day(new Date(now)), 1) ? raw.lastDay : null,
      lastAt: typeof raw.lastAt === 'number' && Number.isFinite(raw.lastAt) ? Math.max(0, Math.min(now + 86400000, Math.floor(raw.lastAt))) : 0,
    },
  };
}

/** При переносе прогресса на другое устройство согласие на напоминания запрашивается заново. */
export function importedPreferences(value, now = Date.now()) {
  const clean = cleanPreferences(value, now);
  return { ...clean, reminders: { ...clean.reminders, enabled: false, consent: false, channel: 'in-app', lastDay: null, lastAt: 0 } };
}