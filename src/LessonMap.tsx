import { useState } from 'react';
import { ArrowRight, BookOpen, Check, ChevronRight, Clock3, Headphones, Heart, LockKeyhole, Link2, Puzzle, Timer } from 'lucide-react';
import { Progress, Stars } from './Components';
import { course, lesson, material, recordings, unlocked, upcoming, modes, difficulty } from './catalog.js';
import { ContentArt } from './ContentArt';
import type { GameMode, Profile } from './types';

/** Показывает честные состояния карты: пройдено, доступно и сначала предыдущие уроки. */
export function LessonMap({ profile, onStart, topicId = 'alphabet' }: { profile: Profile; onStart: (id: string) => void; topicId?: string }) {
  const alphabet = course(topicId)!;
  const count = alphabet.lessons.filter((item) => Boolean(profile.completed[item.id])).length;
  const next = upcoming(profile.completed);
  const [notice, setNotice] = useState('');
  return <>
    <span className="modal-eyebrow"><BookOpen size={17} />{topicId === 'alphabet' ? 'ТВОЯ ПЕРВАЯ ВЕРШИНА' : 'ЕЩЁ БЛИЖЕ К РОДНОМУ ЯЗЫКУ'}</span>
    <h2>{topicId === 'alphabet' ? 'Знакомство с алфавитом' : alphabet.title}</h2>
    <p className="modal-lead">{alphabet.items.length} {topicId === 'alphabet' ? 'букв' : 'слов и выражений'}, {alphabet.lessons.length} коротких уроков. Двигаемся шаг за шагом.</p>
    <div className="map-overview"><span>{count} из {alphabet.lessons.length} уроков пройдено</span><strong>{Math.round(count / alphabet.lessons.length * 100)}%</strong></div>
    <Progress value={count} max={alphabet.lessons.length} label={`Прогресс темы ${alphabet.title}`} />
    <ol className="lesson-map" aria-label="Последовательность уроков">
      {alphabet.lessons.map((item, index) => {
        const done = profile.completed[item.id];
        const available = unlocked(item.id, profile.completed);
        const audio = recordings(material(item.id, profile.age));
        return <li key={item.id} className={done ? 'map-done' : available ? 'map-current' : 'map-locked'}>
          <button className={`lesson-row ${done ? 'done' : available ? 'available' : 'locked'}`} aria-label={`Урок ${index + 1}. ${item.title}. ${done ? `Пройден, ${done.stars} из 3 звёзд` : available ? 'Доступен' : 'Сначала пройди предыдущие уроки'}`} onClick={() => {
            if (available) onStart(item.id);
            else setNotice(`Сначала пройди урок «${next?.title || alphabet.lessons[0].title}». Всё получится, шаг за шагом!`);
          }}>
            <span className="lesson-number">{done ? <Check size={19} /> : available ? index + 1 : <LockKeyhole size={16} />}</span>
            <span className="lesson-row-text"><strong>{item.title}</strong><small>{item.description}</small><span className="map-lesson-meta"><Clock3 size={11} />{item.duration} мин<span>·</span>{audio.available ? <><Headphones size={11} />Со звуком</> : <><BookOpen size={11} />По буквам</>}</span></span>
            {done ? <Stars count={done.stars} size={14} /> : available ? <ChevronRight size={20} /> : null}
          </button>
        </li>;
      })}
    </ol>
    {notice && <p className="dialog-status" role="status">{notice}</p>}
    <p className="modal-note">Следующий урок открывается после полного раунда и не менее 60% верных ответов. Можно повторять уже пройденное.</p>
  </>;
}

/** Даёт осознанно выбрать чтение или доступные проверенные записи носителя. */
export function LessonSetup({ id, practice, profile, onLaunch, initialMode = 'visual', busy = false }: { id: string; practice: boolean; profile: Profile; onLaunch: (mode: GameMode) => void; initialMode?: GameMode; busy?: boolean }) {
  const current = lesson(id)!;
  const topic = course(current.topicId)!;
  const source = practice ? topic.items.filter((item) => item.ageGroup === 'all' || item.ageGroup === profile.age) : material(id, profile.age);
  const audio = recordings(source);
  const available = modes(id, practice);
  const [mode, setMode] = useState<GameMode>(available.some((item) => item.id === initialMode) ? initialMode : 'visual');
  const count = practice ? Math.min(source.length, difficulty(profile.age).practiceQuestions) : source.length;
  return <>
    <span className="modal-eyebrow"><BookOpen size={17} />{practice ? 'ТРЕНИРОВКА БЕЗ ПОТЕРЬ' : topic.title.toLocaleUpperCase('ru')}</span>
    <div className={`setup-letter ${current.topicId !== 'alphabet' ? 'setup-picture' : ''}`} aria-hidden="true">{mode === 'audio' ? <Headphones size={54} /> : current.topicId !== 'alphabet' ? <ContentArt item={source[0]} /> : <><span lang="ce">{source[0]?.chechen}</span><small lang="ce">{source[0]?.lower}</small></>}</div>
    <h2>{practice ? 'Повторим вместе?' : current.title}</h2>
    <p className="modal-lead">{practice ? `${topic.title}: новые маленькие победы, без потери сердечек.` : current.description}</p>
    <fieldset className="mode-picker"><legend>Как будем учиться?</legend>
      {available.map((item) => {
        const Icon = item.id === 'audio' ? Headphones : item.id === 'match' ? Link2 : item.id === 'build' ? Puzzle : item.id === 'speed' ? Timer : BookOpen;
        const unavailable = item.id === 'audio' && !audio.available;
        return <label key={item.id} className={`${mode === item.id ? 'mode-selected' : ''} ${unavailable ? 'mode-unavailable' : ''}`}><input type="radio" name="lesson-mode" value={item.id} checked={mode === item.id} disabled={unavailable} aria-describedby={unavailable ? 'audio-availability' : undefined} onChange={() => setMode(item.id as GameMode)} /><Icon size={23} /><span><strong>{item.id === 'visual' && topic.id === 'alphabet' ? item.alphabetTitle : item.title}</strong><small>{unavailable ? `Записи готовятся: ${audio.ready} из ${audio.total}` : item.id === 'visual' && topic.id === 'alphabet' ? 'Найди большую букву по маленькой' : item.description}</small></span>{unavailable ? <LockKeyhole size={16} /> : <Check size={17} className="mode-check" />}</label>;
      })}
    </fieldset>
    {!audio.available && <p id="audio-availability" className="setup-audio-note">Звуковой режим откроется, когда будут готовы все проверенные записи этого урока. Мы не заменяем родной язык синтезом речи.</p>}
    {mode === 'speed' && <p className="setup-audio-note">{difficulty(profile.age).quizSeconds} секунд на ответы. На паузе и во время разбора время не идёт. Можно выбрать любой режим без таймера.</p>}
    {mode === 'match' && <p className="setup-audio-note">Ошибочную пару можно исправить. XP и звёзды считаются по первым попыткам, так что не спеши.</p>}
    <div className="setup-summary"><span><Clock3 size={15} />{count} вопросов</span><span><Heart size={15} />{practice ? 'Ошибки без потерь' : `${profile.hearts} из 5 жизней`}</span></div>
    <button className="button button-primary full-width" disabled={busy} onClick={() => onLaunch(mode)}>Поехали!<ArrowRight size={19} /></button>
    <p className="modal-note setup-note">{practice ? 'Успешная тренировка возвращает одно сердечко.' : `За каждый верный ответ получишь 4 XP. В этом уроке до ${count * 4} XP.`}</p>
  </>;
}