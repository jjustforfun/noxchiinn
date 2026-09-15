import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, Check, ChevronLeft, ChevronRight, Flame, Leaf, Trophy } from 'lucide-react';
import motivation from '../data/motivation.json';
import { day, dateLabel, monthDays, monthShift, plural, shift, weekday } from './calendar.js';
import type { Profile } from './types';

/** Показывает календарь фактических занятий с клавиатурой и подробностями выбранного дня. */
export function StreakCalendar({ profile, onStart, compact = false }: { profile: Profile; onStart?: () => void; compact?: boolean }) {
  const today = profile.dailyDate || day();
  const [month, setMonth] = useState(today.slice(0, 7));
  const [selected, setSelected] = useState(today);
  const table = useRef<HTMLTableElement>(null);
  const focusRequested = useRef(false);
  const earliest = monthShift(today.slice(0, 7), -11);
  const latest = today.slice(0, 7);
  const dates = monthDays(month);
  const practiced = new Set(profile.practiceDays);
  const stats = profile.activity[selected];
  const success = practiced.has(selected);
  const activeDays = dates.filter((date) => date.startsWith(month) && (practiced.has(date) || profile.activity[date]?.rounds > 0)).length;

  useEffect(() => {
    if (!focusRequested.current) return;
    table.current?.querySelector<HTMLButtonElement>(`button[data-day="${selected}"]`)?.focus();
    focusRequested.current = false;
  }, [selected, month]);

  function moveMonth(offset: number) {
    const next = monthShift(month, offset);
    if (next < earliest || next > latest) return;
    setMonth(next); setSelected(next === latest ? today : `${next}-01`);
  }

  function keyboard(event: KeyboardEvent, date: string) {
    let next = '';
    if (event.key === 'ArrowRight') next = shift(date, 1);
    if (event.key === 'ArrowLeft') next = shift(date, -1);
    if (event.key === 'ArrowDown') next = shift(date, 7);
    if (event.key === 'ArrowUp') next = shift(date, -7);
    if (event.key === 'Home') next = shift(date, 1 - weekday(date));
    if (event.key === 'End') next = shift(date, 7 - weekday(date));
    if (event.key === 'PageUp') next = `${monthShift(month, -1)}-01`;
    if (event.key === 'PageDown') next = `${monthShift(month, 1)}-01`;
    if (!next) return;
    event.preventDefault();
    if (next < `${earliest}-01`) next = `${earliest}-01`;
    if (next > today) next = today;
    focusRequested.current = true; setMonth(next.slice(0, 7)); setSelected(next);
  }

  return <section className={`streak-calendar ${compact ? 'calendar-compact' : ''}`} aria-label="Календарь занятий">
    {!compact && <div className="calendar-intro"><span className="calendar-flame"><Flame size={31} fill="currentColor" /></span><div><h2>{profile.streak ? `${profile.streak} ${plural(profile.streak)} с родным языком` : 'Каждый день можно начать'}</h2><p>{practiced.has(today) ? 'Сегодняшний шаг уже сделан. Можно просто порадоваться.' : 'Один успешный урок или тренировка продолжает серию.'}</p></div></div>}
    <div className="calendar-toolbar"><button className="icon-button" aria-label="Предыдущий месяц" disabled={month <= earliest} onClick={() => moveMonth(-1)}><ChevronLeft size={20} /></button><h3 aria-live="polite">{dateLabel(month, true)}</h3><button className="icon-button" aria-label="Следующий месяц" disabled={month >= latest} onClick={() => moveMonth(1)}><ChevronRight size={20} /></button></div>
    <table className="calendar-grid" ref={table} aria-label={dateLabel(month, true)}><thead><tr>{motivation.weekdays.map((date) => <th key={date.id} scope="col"><abbr title={date.name}>{date.short}</abbr></th>)}</tr></thead><tbody key={month}>{Array.from({ length: 6 }, (_, week) => <tr key={week}>{dates.slice(week * 7, week * 7 + 7).map((date) => {
      const done = practiced.has(date); const attempted = Boolean(profile.activity[date]?.rounds); const other = !date.startsWith(month);
      const future = date > today && !done && !attempted;
      return <td key={date}><button data-day={date} className={`calendar-day ${done ? 'day-success' : attempted ? 'day-attempt' : ''} ${date === today ? 'day-today' : ''} ${other ? 'day-other' : ''} ${selected === date ? 'day-selected' : ''}`} tabIndex={selected === date ? 0 : -1} disabled={future || date < `${earliest}-01` || date.slice(0, 7) > latest} aria-pressed={selected === date} aria-current={date === today ? 'date' : undefined} aria-label={`${dateLabel(date)}. ${done ? 'Серия продолжена' : attempted ? 'Было занятие' : future ? 'Ещё впереди' : 'Нет сохранённых занятий'}${profile.activity[date] ? `. ${profile.activity[date].xp} XP` : ''}`} onClick={() => { setSelected(date); setMonth(date.slice(0, 7)); }} onKeyDown={(event) => keyboard(event, date)}><span>{Number(date.slice(-2))}</span>{done ? <Check size={10} /> : attempted ? <i /> : null}</button></td>;
    })}</tr>)}</tbody></table>
    <div className="calendar-legend"><span><i className="legend-success" />Серия</span><span><i className="legend-attempt" />Попытка</span><span><i className="legend-today" />Сегодня</span></div>
    <div className="calendar-day-detail" aria-live="polite"><strong>{selected === today ? 'Сегодня' : dateLabel(selected)}</strong>{stats?.rounds ? <p>{stats.rounds} {plural(stats.rounds, ['занятие', 'занятия', 'занятий'])}, {stats.xp} XP. {success ? 'Этот день засчитан в серию.' : 'Каждая попытка важна. К серии можно вернуться после успешного раунда.'}</p> : success ? <p>Этот день засчитан в серию. Подробности старых занятий ещё не записывались.</p> : <p>{selected === today ? 'Твоё маленькое открытие ещё впереди. Пять минут вместе уже хороший старт.' : 'Сохранённых занятий за этот день нет. Отдых тоже нужен.'}</p>}</div>
    <div className="calendar-bottom"><span><Leaf size={16} />{activeDays} {plural(activeDays)} занятий в этом месяце</span><span><Trophy size={16} />Лучшая серия: {profile.bestStreak}</span></div>
    {onStart && <button className="button button-primary full-width calendar-start" onClick={onStart}>{practiced.has(today) ? 'Ещё одно открытие' : 'Сделать маленький шаг'}<ArrowRight size={18} /></button>}
    <p className="calendar-footnote">Даты считаются по местному календарю устройства. Старые записи не переносятся при смене часового пояса. Пропуск не удаляет знания.</p>
  </section>;
}