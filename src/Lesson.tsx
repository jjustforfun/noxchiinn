import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { ArrowRight, BookOpen, Check, CheckCheck, CircleHelp, Headphones, Heart, LoaderCircle, Pause, Play, RotateCcw, Sparkles, Star, Volume2, VolumeX } from 'lucide-react';
import { Dialog, Progress, Stars } from './Components';
import { Wolf } from './Illustrations';
import { ContentArt } from './ContentArt';
import { MatchStage, BuildStage } from './GameStage';
import { course, lesson, letters, upcoming, difficulty, gameModes } from './catalog.js';
import { advance, answer, choose, current, outcome, storeRound, addTile, removeTile, pickPair, matchPair, group, tick, pauseClock, resumeClock, abortPairs } from './round.js';
import { movable } from './spelling.js';
import { score } from './progress.js';
import { play, stop, subscribeAudio } from './audio.js';
import { playEffect, stopEffects } from './effects.js';
import type { Profile, Result, Round, GameMode } from './types';

type Props = {
  initial: Round; profile: Profile; persistenceWarning?: string;
  saving?: boolean;
  onPause: (round: Round) => void; onClose: () => void;
  onMistake: (id: string) => void; onFinish: (result: Result) => void;
  onNext: (id: string, practice?: boolean, mode?: GameMode) => void;
  onSoundToggle: () => void;
};

/** Проводит раунд с явными состояниями и сохраняет каждый шаг в текущей вкладке. */
export function Lesson({ initial, profile, persistenceWarning, saving, onPause, onClose, onMistake, onFinish, onNext, onSoundToggle }: Props) {
  const [round, setRound] = useState<Round>(initial);
  const roundRef = useRef(round);
  const [paused, setPaused] = useState(false);
  const [audioState, setAudioState] = useState('idle');
  const [audioNotice, setAudioNotice] = useState('');
  const [heard, setHeard] = useState(false);
  const [sessionWarning, setSessionWarning] = useState(false);
  const resultRef = useRef(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const activeLesson = lesson(round.lessonId)!;
  const topic = course(activeLesson.topicId)!;
  const card = current(round)!;
  const question = round.questions[round.index];
  const checked = round.phase !== 'question';
  const right = round.mode === 'match' ? round.missed.length === 0 : round.responses[round.index] === card.id;
  const result = outcome(round) as Result;
  const reward = score(result.correct, result.total);
  const passed = reward.passed && result.finished;
  const canAnswer = round.mode !== 'audio' || heard;
  const isWord = topic.id !== 'alphabet';
  const filled = round.mode === 'build' ? round.draft.length === movable(card.chechen).length : Boolean(round.selected);
  const progress = round.responses.length + (round.mode === 'match' && !checked ? round.matched.length : 0);
  const lastPage = round.index + (round.mode === 'match' ? group(round).length : 1) >= round.questions.length;

  function change(next: Round) {
    if (next === roundRef.current) return;
    roundRef.current = next;
    if (!storeRound(next)) setSessionWarning(true);
    setRound(next);
  }

  useEffect(() => {
    if (!storeRound(initial)) setSessionWarning(true);
    return () => { stop(); stopEffects(); };
  }, []);

  useEffect(() => {
    stop(); setAudioNotice(''); setAudioState('idle'); setHeard(false);
    const unsubscribe = subscribeAudio((state: { status: string; id: string | null; message: string }) => {
      if (state.id !== card.id && state.status !== 'idle') return;
      setAudioState(state.status);
      if (state.status === 'ended') setHeard(true);
      if (state.status === 'error') { setAudioNotice(state.message); setHeard(false); }
    });
    headingRef.current?.focus({ preventScroll: true });
    return () => { unsubscribe(); stop(); };
  }, [round.index, round.mode]);

  useEffect(() => {
    if (round.phase === 'feedback') continueRef.current?.focus({ preventScroll: true });
    if (round.phase === 'result' && !resultRef.current) {
      resultRef.current = true;
      onFinish(outcome(round) as Result);
      headingRef.current?.focus({ preventScroll: true });
    }
  }, [round.phase]);

  useEffect(() => { if (paused) headingRef.current?.focus({ preventScroll: true }); }, [paused]);

  useEffect(() => {
    if (round.mode !== 'speed' || round.phase !== 'question' || paused) return;
    change(resumeClock(roundRef.current) as Round);
    const timer = setInterval(() => change(tick(roundRef.current) as Round), 250);
    function hidden() { if (document.hidden) { change(pauseClock(roundRef.current) as Round); setPaused(true); } }
    document.addEventListener('visibilitychange', hidden);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hidden); };
  }, [round.mode, round.phase, round.index, paused]);

  function requestPause() {
    stop(); stopEffects();
    if (roundRef.current.mode === 'speed') change(pauseClock(roundRef.current) as Round);
    if (roundRef.current.phase === 'result') onClose();
    else if (paused) onPause(roundRef.current);
    else setPaused(true);
  }

  function check() {
    if (saving) return;
    const previous = roundRef.current;
    if (!canAnswer || previous.phase !== 'question' || !filled || previous.mode === 'match') return;
    if (!previous.practice && profile.hearts <= 0) { setPaused(true); return; }
    const measured = pauseClock(previous) as Round;
    if (measured.phase === 'result') { change(measured); return; }
    const next = answer(measured) as Round;
    // Метка попытки делает списание идемпотентным при двойном клике и перезагрузке.
    if (!previous.practice && next.responses[previous.index] !== previous.questions[previous.index].answer) onMistake(`${previous.id}:${previous.index}`);
    stop(); change(next);
    void playEffect(next.responses[previous.index] === previous.questions[previous.index].answer ? 'success' : 'retry', profile.preferences);
  }

  function next() {
    if (saving) return;
    stop();
    const nextRound = advance(roundRef.current, profile.hearts) as Round;
    change(nextRound);
    if (nextRound.phase === 'result') {
      const result = outcome(nextRound);
      if (result.finished && score(result.correct, result.total).passed) void playEffect('complete', profile.preferences);
    }
  }

  function chooseOption(id: string) {
    if (!canAnswer) return;
    change(choose(roundRef.current, id) as Round);
  }

  function match(id: string) {
    if (saving) return;
    const previous = roundRef.current;
    const next = matchPair(previous, id) as Round;
    if (next === previous) return;
    if (previous.selected === id || !previous.missed.includes(previous.selected!)) void playEffect(previous.selected === id ? 'success' : 'retry', profile.preferences);
    if (!previous.practice && previous.selected && previous.selected !== id && !previous.missed.includes(previous.selected)) {
      const questionIndex = previous.questions.findIndex((question) => question.answer === previous.selected);
      onMistake(`${previous.id}:${questionIndex}`);
      if (profile.hearts <= 1) { change(abortPairs(next) as Round); return; }
    }
    change(next);
  }

  function onKey(event: KeyboardEvent) {
    if (paused || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
    if (!['match', 'build'].includes(round.mode) && round.phase === 'question' && /^[1-4]$/.test(event.key)) {
      const option = question.options[Number(event.key) - 1];
      if (option) { event.preventDefault(); chooseOption(option); }
    }
  }

  return <Dialog title={round.phase === 'result' ? 'Результат урока' : activeLesson.title} onClose={requestPause} wide={round.phase !== 'result'} className={round.phase === 'result' ? 'result-dialog' : `lesson-dialog ${round.age === '5-8' ? 'junior-lesson' : ''}`}>
    {persistenceWarning && <p className="audio-notice" role="status">Браузер не разрешил сохранить прогресс. Пока не закрывай эту вкладку. В профиле можно скачать сохранение.</p>}
    {paused ? <div className="centered-modal pause-screen">
      <div className="modal-feature-icon install-feature"><Pause size={38} /></div>
      <h2 ref={headingRef} tabIndex={-1}>Сделаем маленькую паузу?</h2>
      <p>Вопрос {round.index + 1} из {round.questions.length} останется в этой вкладке. XP получишь, когда закончишь раунд. Потраченные сердечки уже сохранены.</p>
      {profile.hearts === 0 && !round.practice && <p className="audio-notice">Сердечки закончились. Можно вернуться к раунду после восстановления или выбрать тренировку без потери жизней.</p>}
      <button className="button button-primary full-width" onClick={() => setPaused(false)}>Остаться в уроке<Play size={18} /></button>
      <button className="button button-secondary full-width" onClick={() => { storeRound(round); onPause(round); }}>Сохранить паузу и выйти<Pause size={18} /></button>
      {sessionWarning && <p className="audio-notice">Браузер не разрешил временное сохранение. После закрытия или перезагрузки вкладки вопрос может не восстановиться.</p>}
    </div> : round.phase === 'result' ? <>
      <div className="result-wolf"><Wolf /></div>
      <Stars count={passed ? reward.stars : 0} size={43} />
      <h2 ref={headingRef} tabIndex={-1}>{round.timedOut ? 'Время вышло. Ты молодец!' : passed ? 'У тебя получилось!' : !result.finished ? 'Отдохнём и попробуем ещё!' : 'Ошибки тоже помогают учиться'}</h2>
      <p>{round.timedOut ? 'XP за верные ответы остаётся с тобой. Можно повторить без таймера и не спешить.' : passed ? 'Ещё один маленький шаг к языку твоей семьи.' : !result.finished ? 'Сердечки закончились. XP за верные ответы твои, а урок можно пройти заново.' : 'Давай спокойно повторим вместе. Волчонок верит в тебя!'}</p>
      <div className="result-numbers">
        <div><Star size={23} /><strong>+{reward.xp} XP</strong><span>За верные ответы</span></div>
        <div><CheckCheck size={25} /><strong>{result.correct} из {result.total}</strong><span>Верных ответов</span></div>
        {round.practice && passed && <div><Heart size={24} /><strong>+1 жизнь</strong><span>Не больше пяти</span></div>}
      </div>
      <p className="result-mode"><span>{round.mode === 'audio' ? <Headphones size={15} /> : <BookOpen size={15} />}{gameModes.find((mode) => mode.id === round.mode)?.title}</span>{passed && !round.practice && <span><Check size={15} />Урок пройден</span>}</p>
      <button className="button button-primary full-width" disabled={saving} onClick={() => {
        const following = upcoming(profile.completed);
        if (profile.hearts === 0 || round.practice || (passed && !following)) onNext(round.lessonId, true, round.mode);
        else onNext(passed && following ? following.id : round.lessonId, false);
      }}>{profile.hearts === 0 || round.practice || (passed && !upcoming(profile.completed)) ? 'Тренировка без потерь' : passed ? 'Следующий урок' : 'Попробовать ещё раз'}<ArrowRight size={19} /></button>
      <button className="text-button result-back" onClick={onClose}>К моему путешествию</button>
      {round.mode === 'speed' && <button className="text-button result-back" onClick={() => onNext(round.lessonId, true, 'visual')}>Повторить без таймера</button>}
    </> : <div onKeyDown={onKey}>
      <div className="lesson-topline"><span><BookOpen size={17} />{round.practice ? 'Тренировка' : `Урок ${topic.lessons.findIndex((item) => item.id === round.lessonId) + 1}`}<span className="dot-separator">·</span>{topic.title}</span><span className="lesson-hearts"><Heart size={20} fill="currentColor" />{round.practice ? 'Без потерь' : `${profile.hearts} / 5`}</span></div>
      <Progress value={progress} max={round.questions.length} label="Прогресс урока" />
      {round.mode === 'speed' && <div className={`quiz-clock ${round.remainingMs < 15000 ? 'quiz-clock-short' : ''}`}><span>Время на ответы</span><strong role="timer" aria-label={`Осталось ${Math.ceil(round.remainingMs / 1000)} секунд`}>{String(Math.floor(Math.ceil(round.remainingMs / 1000) / 60)).padStart(2, '0')}:{String(Math.ceil(round.remainingMs / 1000) % 60).padStart(2, '0')}</strong><Progress value={round.remainingMs} max={difficulty(round.age).quizSeconds * 1000} label="Оставшееся время" /></div>}
      <div className="question-heading"><span className="eyebrow">{round.mode === 'match' ? `НАЙДЕНО ${progress} ИЗ ${round.questions.length} ПАР` : `ВОПРОС ${round.index + 1} ИЗ ${round.questions.length}`}</span><h2 ref={headingRef} tabIndex={-1}>{round.mode === 'match' ? 'Найди родные пары' : round.mode === 'build' ? 'Собери слово из букв' : round.mode === 'audio' ? isWord ? 'Какое слово звучит?' : 'Какая буква звучит?' : isWord ? 'Как это по-чеченски?' : 'Найди большую букву'}</h2><p>{round.mode === 'match' ? 'Сначала картинка, потом слово. Просто нажимай!' : round.mode === 'build' ? 'Нажимай на фишки, чтобы собрать слово.' : round.mode === 'audio' ? 'Нажми на звук, дослушай и выбери ответ.' : isWord ? 'Посмотри на картинку и выбери чеченское слово.' : 'Посмотри на маленькую букву и выбери её пару.'}</p></div>
      {round.mode === 'match' ? <MatchStage round={round} onPick={(id) => change(pickPair(roundRef.current, id) as Round)} onMatch={match} />
        : round.mode === 'build' ? <BuildStage key={card.id} round={round} item={card} onAdd={(index) => change(addTile(roundRef.current, index) as Round)} onRemove={(position) => change(removeTile(roundRef.current, position) as Round)} onClear={() => change({ ...roundRef.current, draft: [] })} />
        : round.mode === 'audio' ? <div className="sound-question">
        <button className={`listen-button ${audioState === 'playing' ? 'is-playing' : ''}`} aria-label={audioState === 'playing' ? 'Повторить запись' : 'Послушать запись носителя'} aria-busy={audioState === 'loading'} onClick={() => { setAudioNotice(''); void play(card); }}>
          {audioState === 'loading' ? <LoaderCircle className="spinner" size={42} /> : <Volume2 size={46} />}
          <span>{audioState === 'loading' ? 'Загружаем...' : audioState === 'playing' ? 'Слушаем...' : heard ? 'Послушать ещё' : 'Послушать'}</span>
        </button>
        <span className="listening-status" aria-live="polite">{heard ? 'Теперь выбери букву' : 'Запись можно повторять сколько угодно'}</span>
      </div> : isWord ? <div className="word-question-cue"><ContentArt item={card} caption /></div> : <div className="question-letter" key={card.id}><span lang="ce">{card.lower}</span><button className="audio-button" aria-label={`Послушать букву ${card.chechen}`} onClick={() => void play(card)}><Volume2 size={24} /></button></div>}
      {audioNotice && <div className="audio-recovery" role="status"><p><CircleHelp size={18} />{audioNotice}</p>{round.mode === 'audio' && <div><button className="text-button" onClick={() => void play(card)}><RotateCcw size={16} />Повторить</button><button className="text-button" onClick={() => { stop(); change({ ...roundRef.current, mode: 'visual' }); }}><BookOpen size={16} />Продолжить по буквам</button></div>}</div>}
      {!['match', 'build'].includes(round.mode) && <div className={`answer-grid ${isWord ? 'word-answers' : ''}`} data-choices={question.options.length} role="group" aria-label="Варианты ответа">
        {question.options.map((id, index) => {
          const option = letters.find((item) => item.id === id)!;
          return <button key={id} className={`answer-option ${round.selected === id ? 'selected' : ''} ${checked && id === card.id ? 'correct' : ''} ${checked && round.selected === id && !right ? 'incorrect' : ''}`} aria-label={`${isWord ? 'Слово' : 'Буква'} ${option.chechen}`} aria-pressed={round.selected === id} disabled={checked || !canAnswer} onClick={() => chooseOption(id)}><span lang="ce">{option.chechen}</span><small>{index + 1}</small>{checked && id === card.id && <Check size={20} />}</button>;
        })}
      </div>}
      <div className={`lesson-feedback ${checked ? right ? 'feedback-correct' : 'feedback-incorrect' : ''}`} aria-live="polite">{checked ? <><span className={`feedback-mascot ${right ? 'mascot-happy' : 'mascot-kind'}`}><Wolf /></span><div><strong>{round.mode === 'match' ? 'Пары найдены! Отличная работа!' : right ? 'Отлично! Так держать!' : 'Ничего страшного, мы учимся!'}</strong><p>{round.mode === 'match' ? `${group(round).length - round.missed.length} из ${group(round).length} с первой попытки` : right ? 'В конце раунда получишь 4 XP за этот ответ' : `Правильный ответ: ${card.chechen}. ${round.practice ? 'Сердечки на месте.' : 'Попробуем следующий вопрос.'}`}</p></div></> : <span className="lesson-hint"><Sparkles size={17} />{canAnswer ? 'У тебя всё получится!' : 'Сначала послушай запись до конца.'}</span>}</div>
      {(round.mode !== 'match' || checked) && <button ref={continueRef} className="button button-primary full-width" disabled={saving || !checked && (!filled || !canAnswer)} onClick={checked ? next : check}>{saving ? 'Сохраняем...' : checked ? lastPage || (!round.practice && profile.hearts === 0) ? 'Посмотреть результат' : 'Дальше' : 'Проверить'}<ArrowRight size={19} /></button>}
      <p className="lesson-mode-note">{round.mode === 'audio' ? 'Настоящая запись носителя. Ошибка загрузки не забирает жизнь.' : round.mode === 'speed' ? 'Таймер останавливается на паузе и во время разбора ответа.' : round.mode === 'match' ? 'XP и звёзды считаются по парам, найденным с первой попытки.' : 'Визуальная практика не заменяет произношение носителя.'}</p>
      <button className="text-button lesson-sound-control" role="switch" aria-checked={profile.preferences.effects} aria-label="Звуки в уроке" onClick={onSoundToggle}>{profile.preferences.effects ? <Volume2 size={15} /> : <VolumeX size={15} />}{profile.preferences.effects ? 'Звуки включены' : 'Играем тихо'}</button>
      {sessionWarning && <p className="audio-notice">Не удалось сохранить текущий вопрос. Не закрывай вкладку до конца раунда.</p>}
    </div>}
  </Dialog>;
}