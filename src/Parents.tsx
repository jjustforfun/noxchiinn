import { useState, type KeyboardEvent } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, Check, ChevronDown, Flame, Heart, Leaf, Settings2, ShieldCheck, Star } from 'lucide-react';
import { StreakCalendar } from './StreakCalendar';
import { TopicProgress } from './TopicProgress';
import { ReminderSettings } from './ReminderSettings';
import { SoundSettings } from './SoundSettings';
import { period } from './statistics.js';
import { dateLabel, plural } from './calendar.js';
import { lesson, course, gameModes } from './catalog.js';
import motivation from '../data/motivation.json';
import { Wolf } from './Illustrations';
import type { Preferences, Profile } from './types';

type Props = { profile: Profile; workerReady: boolean; onChange: (update: (state: Profile) => Profile) => void; onBack: () => void; onPractice: (id: string) => void; onProfile: () => void };
const tabs = [{ id: 'overview', title: 'Как идут дела', icon: CalendarDays }, { id: 'topics', title: 'Темы и открытия', icon: BookOpen }, { id: 'settings', title: 'Семейные настройки', icon: Settings2 }];

/** Собирает локальный родительский экран без аккаунтов, оценок способностей и отправки данных. */
export function Parents({ profile, workerReady, onChange, onBack, onPractice, onProfile }: Props) {
  const [tab, setTab] = useState('overview');
  const [range, setRange] = useState(7);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const stats = period(profile, range, profile.dailyDate);
  const records = [...profile.history].reverse().filter((record) => record.date >= stats.start && record.date <= stats.end);
  const repeat = records.find((record) => record.finished && record.correct / record.total < .7);
  const recommendation = motivation.parentTips.find((tip) => tip.id === (!profile.sessions ? 'first' : repeat ? 'repeat' : 'steady'))!;

  function update(patch: Partial<Preferences>) { onChange((state) => ({ ...state, preferences: { ...state.preferences, ...patch } })); }
  function keyboard(event: KeyboardEvent, index: number) {
    const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length : -1;
    if (next < 0) return;
    event.preventDefault(); setTab(tabs[next].id); document.getElementById(`parent-tab-${tabs[next].id}`)?.focus();
  }

  return <div className="parents-page page-enter">
    <button className="text-button parent-back" onClick={onBack}><ArrowLeft size={15} />Вернуться к игре</button>
    <div className="page-heading"><div><span className="eyebrow">РОДИТЕЛЬСКИЙ УГОЛОК</span><h1>Растём вместе с родным языком</h1><p>Замечаем маленькие шаги. Поддерживаем, а не сравниваем.</p></div><span className="parent-heading-icon"><ShieldCheck size={31} /></span></div>
    <div className="parent-tabs" role="tablist" aria-label="Разделы для родителей">{tabs.map((item, index) => <button key={item.id} id={`parent-tab-${item.id}`} role="tab" aria-selected={tab === item.id} aria-controls={`parent-panel-${item.id}`} tabIndex={tab === item.id ? 0 : -1} className={tab === item.id ? 'selected' : ''} onClick={() => setTab(item.id)} onKeyDown={(event) => keyboard(event, index)}><item.icon size={17} />{item.title}</button>)}</div>

    {tab === 'overview' && <div id="parent-panel-overview" role="tabpanel" aria-labelledby="parent-tab-overview" className="parent-panel">
      <div className="parent-period-heading"><div><h2>{range === 7 ? 'Последние семь дней' : 'Последние тридцать дней'}</h2><p>{dateLabel(stats.start)} - {dateLabel(stats.end)}</p></div><label><span className="sr-only">Период статистики</span><select value={range} onChange={(event) => { setRange(Number(event.target.value)); setShowAll(false); }} aria-label="Период статистики"><option value={7}>За 7 дней</option><option value={30}>За 30 дней</option></select></label></div>
      <dl className="parent-metrics"><div><dt><BookOpen size={19} />Занятий</dt><dd>{stats.rounds}<em>{stats.days} {plural(stats.days)} с игрой</em></dd></div><div><dt><Star size={19} />Нового опыта</dt><dd>{stats.xp}<small> XP</small><em>За правильные ответы</em></dd></div><div><dt><Check size={19} />Верных ответов</dt><dd>{stats.accuracy === null ? 'Нет данных' : `${stats.accuracy}%`}<em>Только в полных раундах</em></dd></div></dl>
      <div className="parent-calendar-layout"><div className="parent-calendar-area"><div className="section-heading"><div><h2>Календарь маленьких шагов</h2><p>Нажмите на день, чтобы посмотреть подробности.</p></div></div><StreakCalendar profile={profile} compact /></div>
        <aside className="parent-support"><div className="parent-support-wolf"><Wolf /></div><span className="eyebrow">ПОДДЕРЖКА ВАЖНЕЕ РЕКОРДОВ</span><h2>{recommendation.title}</h2><p>{recommendation.text}</p>{repeat && <button className="text-button" onClick={() => onPractice(lesson(repeat.lessonId)!.topicId)}>Повторить тему «{course(lesson(repeat.lessonId)!.topicId)?.title}»<ArrowRight size={16} /></button>}<div className="parent-streak-note"><Flame size={22} /><div><strong>{profile.streak} {plural(profile.streak)} подряд</strong><p>Лучшая серия: {profile.bestStreak}. Пропуск не стирает знания и награды.</p></div></div><p className="parent-data-note"><ShieldCheck size={16} />Эти сведения видны только на вашем устройстве. Это не оценка владения языком.</p></aside>
      </div>
      <section className="history-section" aria-label="Последние занятия"><div className="section-heading"><div><h2>Что мы открывали</h2><p>Последние раунды выбранного периода.</p></div></div>{records.length ? <ol className="history-list">{records.slice(0, showAll ? 20 : 5).map((record) => {
        const current = lesson(record.lessonId)!; const open = expanded === record.id;
        return <li key={record.id}><button className="history-row" aria-expanded={open} onClick={() => setExpanded(open ? null : record.id)}><span className={`history-symbol ${record.passed ? 'passed' : ''}`}>{record.passed ? <Check size={18} /> : <Leaf size={18} />}</span><span className="history-copy"><strong>{current.title}</strong><span>{record.date === profile.dailyDate ? 'Сегодня' : dateLabel(record.date)} · {record.practice ? 'Тренировка' : 'Урок'}</span></span><span className="history-xp">+{record.xp} XP</span><ChevronDown size={17} className={open ? 'rotated' : ''} /></button>{open && <div className="history-details"><p>{gameModes.find((mode) => mode.id === record.mode)?.title}. {record.finished ? `${record.correct} из ${record.total} с первой попытки.` : 'Раунд завершён досрочно; точность в общую сводку не включена.'}</p><p>{record.passed ? 'Успешный раунд засчитан в ежедневную серию.' : 'XP за верные ответы сохранён. Можно вернуться к материалу без спешки.'}</p><button className="text-button" onClick={() => onPractice(current.topicId)}>Повторить в мастерской<ArrowRight size={15} /></button></div>}</li>;
      })}</ol> : <div className="history-empty"><BookOpen size={27} /><div><h3>Здесь появятся настоящие открытия</h3><p>После следующего раунда покажем тему, формат игры и результат. Прошлые занятия не придумываем.</p></div></div>}{records.length > 5 && <button className="text-button" onClick={() => setShowAll(!showAll)}>{showAll ? 'Показать меньше' : 'Показать ещё'}<ChevronDown size={15} /></button>}<p className="content-note">{profile.historySince ? `Подробная статистика записывается с ${dateLabel(profile.historySince)}.` : 'Подробная статистика начнётся со следующего раунда.'} Сводки хранятся за последние 366 дат, журнал за последние 80 раундов. Старые XP и серия сохранены, но подробностей ранних занятий нет.</p></section>
    </div>}

    {tab === 'topics' && <div id="parent-panel-topics" role="tabpanel" aria-labelledby="parent-tab-topics" className="parent-panel"><TopicProgress profile={profile} onPractice={onPractice} /><div className="parent-reading-note"><Heart size={22} /><p>Попробуйте выбрать одну знакомую карточку и поговорить о ней дома. Живой разговор с близкими дополняет игру лучше любой статистики.</p></div></div>}

    {tab === 'settings' && <div id="parent-panel-settings" role="tabpanel" aria-labelledby="parent-tab-settings" className="parent-panel parent-settings-layout">
      <div><section className="goal-settings" aria-labelledby="family-goal-title"><div className="settings-section-heading"><span className="settings-symbol"><Star size={24} /></span><div><h2 id="family-goal-title">Своя маленькая цель</h2><p>Выберите комфортный ритм, его можно менять.</p></div></div><fieldset className="daily-goal-options"><legend className="sr-only">Ежедневная цель XP</legend>{motivation.goals.map((goal) => <label key={goal.xp} className={preferencesGoal(profile) === goal.xp ? 'selected' : ''}><input type="radio" name="daily-goal" checked={preferencesGoal(profile) === goal.xp} onChange={() => update({ dailyGoal: goal.xp })} /><strong>{goal.xp} XP</strong><span>{goal.title}</span><small>{goal.description}</small></label>)}</fieldset><p className="field-note">Для серии достаточно одного успешного урока или тренировки. Цель XP необязательна: за её пропуск нет штрафа.</p></section><SoundSettings preferences={profile.preferences} onChange={update} /><section className="parent-storage"><ShieldCheck size={25} /><div><h3>Сохранения остаются у вас</h3><p>Нет аккаунта, рекламы или внешней аналитики. В профиле можно скачать прогресс, перенести его и начать заново.</p><button className="text-button" onClick={onProfile}>Открыть профиль и сохранения<ArrowRight size={16} /></button></div></section></div>
      <ReminderSettings preferences={profile.preferences} workerReady={workerReady} onChange={update} />
    </div>}
  </div>;
}

function preferencesGoal(profile: Profile) { return profile.preferences.dailyGoal; }