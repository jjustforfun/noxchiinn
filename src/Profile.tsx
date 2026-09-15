import { useRef, useState } from 'react';
import { ArrowRight, BookOpen, CalendarDays, Check, Download, Flame, ShieldCheck, Sparkles, Star, Trophy, Upload } from 'lucide-react';
import { Avatar } from './Components';
import { alphabetIds, letterIds } from './catalog.js';
import { cleanName } from './progress.js';
import { TopicProgress } from './TopicProgress';
import { SoundSettings } from './SoundSettings';
import type { Profile as Player } from './types';

type Props = { profile: Player; onChange: (update: (state: Player) => Player) => void; onExport: () => void; onImport: (file?: File) => Promise<void>; onReset: () => void; onSaved: () => void; onCalendar: () => void; onPractice: (id: string) => void; onParents: () => void; importing?: boolean };

/** Сохраняет простые настройки и различает изученные буквы и новую лексику. */
export function Profile({ profile, onChange, onExport, onImport, onReset, onSaved, onCalendar, onPractice, onParents, importing }: Props) {
  const [name, setName] = useState(profile.name === 'друг' ? '' : profile.name);
  const input = useRef<HTMLInputElement>(null);
  const learnedLetters = profile.learned.filter((id) => alphabetIds.has(id)).length;
  const learnedWords = profile.learned.filter((id) => !alphabetIds.has(id) && letterIds.has(id)).length;
  return <div className="page-enter">
    <div className="page-heading"><div><span className="eyebrow">ЭТО ТВОЁ ПУТЕШЕСТВИЕ</span><h1>Мой профиль</h1><p>Немного о тебе и о твоих открытиях.</p></div><button className="button button-secondary" onClick={onCalendar}><CalendarDays size={19} />Календарь занятий</button></div>
    <div className="profile-layout">
      <form className="profile-form" onSubmit={(event) => { event.preventDefault(); const safe = cleanName(name); onChange((state) => ({ ...state, name: safe || 'друг' })); setName(safe); onSaved(); }}>
        <div className="profile-avatar-heading"><Avatar variant={profile.avatar} className="large-avatar" /><div><h2>Привет, {profile.name}!</h2><p>Уровень {Math.floor(profile.xp / 100) + 1} · {profile.xp} XP</p></div></div>
        <label className="field-label" htmlFor="player-name">Как тебя называть?</label><input id="player-name" className="text-input" value={name} onChange={(event) => setName(event.target.value)} maxLength={24} placeholder="Имя или прозвище" autoComplete="off" /><p className="field-note">Можно придумать прозвище. Настоящее имя не нужно.</p>
        <span className="field-label">Твой спутник</span><div className="avatar-choices" role="group" aria-label="Выбор аватара">{['wolf', 'sun', 'mountain'].map((variant, index) => <button key={variant} type="button" className={profile.avatar === variant ? 'selected' : ''} aria-label={['Серый волчонок', 'Золотой волчонок', 'Кавказские горы'][index]} aria-pressed={profile.avatar === variant} onClick={() => onChange((state) => ({ ...state, avatar: variant }))}><Avatar variant={variant} />{profile.avatar === variant && <Check size={15} />}</button>)}</div>
        <span className="field-label">Как тебе удобнее учиться?</span><div className="profile-age" role="group" aria-label="Возрастной режим">{[{ id: '5-8', title: '5-8 лет', description: 'Три варианта, простые фишки' }, { id: '9+', title: '9+ лет', description: 'Четыре варианта, больше задач' }].map((age) => <button key={age.id} type="button" className={profile.age === age.id ? 'selected' : ''} aria-pressed={profile.age === age.id} onClick={() => onChange((state) => ({ ...state, age: age.id }))}><strong>{age.title}</strong><span>{age.description}</span></button>)}</div>
        <button type="submit" className="button button-primary">Сохранить профиль<Check size={18} /></button>
        <p className="profile-goal-note"><Star size={16} />Твоя цель: {profile.preferences.dailyGoal} XP в день. Без штрафов за пропуски.</p>
      </form>
      <div className="profile-aside"><section className="profile-statistics"><h2>Уже в твоём рюкзаке</h2><dl><div><dt><BookOpen size={20} />Уроков пройдено</dt><dd>{Object.keys(profile.completed).length}</dd></div><div><dt><Sparkles size={20} />Букв узнано в игре</dt><dd>{learnedLetters}</dd></div><div><dt><BookOpen size={20} />Слов узнано в игре</dt><dd>{learnedWords}</dd></div><div><dt><Flame size={20} />Дней подряд</dt><dd>{profile.streak}</dd></div><div><dt><Trophy size={20} />Лучшая серия</dt><dd>{profile.bestStreak}</dd></div><div><dt><Star size={20} />Всего опыта</dt><dd>{profile.xp} XP</dd></div></dl></section>
        <section className="save-section"><ShieldCheck size={27} /><h2>Только на твоём устройстве</h2><p>Без аккаунтов, рекламы и передачи данных. Сохрани файл, чтобы перенести прогресс.</p><button className="text-button" onClick={onExport}><Download size={17} />Скачать прогресс</button><button className="text-button" disabled={importing} onClick={() => input.current?.click()}><Upload size={17} />{importing ? 'Проверяем файл...' : 'Загрузить сохранение'}</button><input ref={input} type="file" accept="application/json,.json" className="sr-only" aria-label="Файл сохранения" onChange={async (event) => { try { await onImport(event.target.files?.[0]); } finally { if (input.current) input.current.value = ''; } }} /><p className="import-explainer">Проверим JSON до 250 КБ. Замена только после подтверждения; напоминания из файла не включатся.</p><button className="reset-button" onClick={onReset}>Начать с чистого листа</button></section>
      </div>
    </div>
    <div className="profile-comfort"><SoundSettings preferences={profile.preferences} onChange={(patch) => onChange((state) => ({ ...state, preferences: { ...state.preferences, ...patch } }))} /><div><ShieldCheck size={24} /><h2>Удобный ритм для всей семьи</h2><p>Взрослый может настроить маленькую цель, посмотреть историю и выбрать ненавязчивые напоминания.</p><button className="text-button" onClick={onParents}>В родительский уголок<ArrowRight size={17} /></button></div></div>
    <TopicProgress profile={profile} onPractice={onPractice} compact />
  </div>;
}