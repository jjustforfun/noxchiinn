const DAY_MS = 86400000;

/** Возвращает календарный день устройства, а не обрезанную UTC-дату. */
export function day(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Проверяет реальное существование даты без автоматического переноса 31 февраля. */
export function validDay(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, date] = value.split('-').map(Number);
  if (year < 1900 || year > 2200) return false;
  const parsed = new Date(Date.UTC(year, month - 1, date));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === date;
}

/** Преобразует дату без времени в порядковый день, устойчивый к переходам летнего времени. */
export function ordinal(value) {
  if (!validDay(value)) return NaN;
  const [year, month, date] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, date) / DAY_MS;
}

/** Сдвигает календарную дату на дни, не прибавляя 24 часа к местной полуночи. */
export function shift(value, amount) {
  if (!validDay(value) || !Number.isFinite(amount)) return '';
  return new Date((ordinal(value) + Math.trunc(amount)) * DAY_MS).toISOString().slice(0, 10);
}

/** Возвращает день недели: понедельник 1, воскресенье 7. */
export function weekday(value) { return validDay(value) ? ((ordinal(value) + 3) % 7 + 7) % 7 + 1 : 0; }

/** Создаёт сетку месяца из шести недель с понедельника. */
export function monthDays(month) {
  const first = `${month}-01`;
  if (!validDay(first)) return [];
  const start = shift(first, 1 - weekday(first));
  return Array.from({ length: 42 }, (_, index) => shift(start, index));
}

/** Переключает месяц без ошибки на 29-31 числе. */
export function monthShift(month, offset) {
  if (!validDay(`${month}-01`)) return '';
  const [year, number] = month.split('-').map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

/** Даёт русскую подпись календарной дате без сдвига часового пояса. */
export function dateLabel(value, monthOnly = false) {
  const date = monthOnly ? `${value}-01` : value;
  if (!validDay(date)) return '';
  return new Intl.DateTimeFormat('ru-RU', { timeZone: 'UTC', year: 'numeric', month: 'long', ...(monthOnly ? {} : { day: 'numeric' }) }).format(new Date(ordinal(date) * DAY_MS));
}

/** Считает лучшую серию только по реально отмеченным дням. */
export function longest(days) {
  const ordered = [...new Set((Array.isArray(days) ? days : []).filter(validDay))].sort();
  let best = 0; let run = 0; let previous = null;
  for (const value of ordered) { run = previous && shift(previous, 1) === value ? run + 1 : 1; best = Math.max(best, run); previous = value; }
  return best;
}

/** Склоняет русское слово по числу, включая 11-14 и 21. */
export function plural(count, forms = ['день', 'дня', 'дней']) {
  const value = Math.abs(Math.trunc(count));
  return value % 100 >= 11 && value % 100 <= 14 ? forms[2] : value % 10 === 1 ? forms[0] : value % 10 >= 2 && value % 10 <= 4 ? forms[1] : forms[2];
}