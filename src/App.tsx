import { useEffect, useRef, useState } from 'react';
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Bell, BookOpen, Check,
  ChevronDown, ChevronRight, CircleHelp, CircleUserRound,
  Download, Flame, Footprints, Heart, Leaf, LockKeyhole, Menu,
  Mountain, Pause, Play, Puzzle, ShieldCheck, Smartphone,
  Sparkles, Star, Sun, Trophy, Volume2, WifiOff, X,
} from 'lucide-react';
import alphabet from '../data/alphabet.json';
import topics from '../data/topics.json';
import words from '../data/words.json';
import achievements from '../data/achievements.json';
import motivation from '../data/motivation.json';
import { Landscape } from './Landscape';
import { TargetArt, TopicArt, Wolf } from './Illustrations';
import { Avatar, Dialog, Progress } from './Components';
import { Lesson } from './Lesson';
import { LessonMap, LessonSetup } from './LessonMap';
import { Practice } from './Practice';
import { Profile as ProfileView } from './Profile';
import { Parents } from './Parents';
import { StreakCalendar } from './StreakCalendar';
import { ContentArt } from './ContentArt';
import { HeartTimer } from './HeartTimer';
import { PwaPanel, type PwaStatus } from './PwaPanel';
import { useProgress } from './useProgress';
import { useReminders } from './useReminders';
import { inspectImport, exportProfile } from './transfer.js';
import { closeReminderNotifications } from './notifications.js';
import { stopEffects } from './effects.js';
import { plural } from './calendar.js';
import type { Page, Letter, Topic, Profile, InstallEvent, GameMode, Round } from './types';
import { complete, defaults, mistake, refresh, day, STORAGE_KEY } from './progress.js';
import { create, restoreRound, storeRound, clearRound, identity, validateRound } from './round.js';
import { lesson, topicUnlocked, unlocked, upcoming, course, topicProgress, reference, alphabetIds, courses, lessons } from './catalog.js';
import { play, stop } from './audio.js';
import { register, watchPwa, lessonActive, applyUpdate } from './pwa.js';
import { PublicFaq, PublicPage, PublicNotFound } from './PublicContent.js';
import site from '../data/site.json' with { type: 'json' };

const navigation = [
  { id: 'learn', title: 'Учиться', icon: BookOpen },
  { id: 'practice', title: 'Тренировка', icon: Puzzle },
  { id: 'achievements', title: 'Достижения', icon: Trophy },
  { id: 'profile', title: 'Мой профиль', icon: CircleUserRound },
] as const;
const pages: Page[] = [...navigation.map((item) => item.id), 'parents'];

/** Отделяет публичную справку от игры: информационные страницы не читают профиль. */
export default function App() {
  const publicPage = site.pages.find((page) => page.id !== 'home' && page.path === window.location.pathname);
  useEffect(() => {
    if (publicPage) {
      document.title = publicPage.title;
      document.querySelector('meta[name="description"]')?.setAttribute('content', publicPage.description);
    }
  }, [publicPage]);
  return publicPage ? <PublicPage page={publicPage.id} /> : ['/', '/index.html'].includes(window.location.pathname) ? <LearningApp /> : <PublicNotFound />;
}

/** Собирает главный экран, навигацию и локальное состояние приложения. */
function LearningApp() {
  const [profile, setProfile, storageIssue, storage] = useProgress();
  const [imported, setImported] = useState<Profile | null>(null);
  const [importing, setImporting] = useState(false);
  const importRequest = useRef(0);
  const [page, setPage] = useState<Page>(() => pages.includes(window.location.hash.slice(1) as Page) ? window.location.hash.slice(1) as Page : 'learn');
  const [modal, setModal] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<Topic>(topics[0]);
  const [selectedLetter, setSelectedLetter] = useState<Letter>(alphabet.items[0]);
  const [selectedAchievement, setSelectedAchievement] = useState(achievements[0]);
  const [game, setGame] = useState<Round | null>(null);
  const [resume, setResume] = useState<Round | null>(() => restoreRound(profile) as Round | null);
  const [pending, setPending] = useState<{ id: string; practice: boolean; mode: GameMode }>({ id: alphabet.lessons[0].id, practice: false, mode: 'visual' });
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [practiceTopic, setPracticeTopic] = useState('numbers');
  const [online, setOnline] = useState(navigator.onLine);
  const [pwa, setPwa] = useState<PwaStatus>({ state: 'loading', message: 'Готовим приложение...', updateAvailable: false, audioReady: 0, audioTotal: 0, lastChecked: null });
  const offlineReady = pwa.state === 'ready';
  const [installPrompt, setInstallPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(window.matchMedia('(display-mode: standalone)').matches);
  const [audioNotice, setAudioNotice] = useState('');
  const completedCount = Object.keys(profile.completed).length;
  const currentLesson = upcoming(profile.completed) || alphabet.lessons[0];
  const level = Math.floor(profile.xp / 100) + 1;
  const currentXP = profile.xp % 100;
  const cardSource = reference(selectedLetter);
  const reminder = useReminders(profile, setProfile, Boolean(game || modal || mobileMenu || storage.readOnly || storage.pending || page === 'parents'));
  const dailyGoal = profile.preferences.dailyGoal;

  useEffect(() => { if (storageIssue) setToast(storageIssue); }, [storageIssue]);
  useEffect(() => () => { importRequest.current++; }, []);
  useEffect(() => {
    if ((game && game.generation !== profile.generation) || (resume && resume.generation !== profile.generation)) {
      setGame(null); setResume(null); clearRound(); setToast('Профиль изменился в другой вкладке. Продолжим с актуальным прогрессом.');
    }
  }, [profile.generation]);

  useEffect(() => {
    const onOnline = () => setOnline(navigator.onLine);
    const onHash = () => { const id = window.location.hash.slice(1); if (pages.includes(id as Page)) setPage(id as Page); };
    const onInstall = (event: Event) => { event.preventDefault(); setInstallPrompt(event as InstallEvent); };
    const onInstalled = () => { setInstalled(true); setInstallPrompt(null); setModal(null); setToast('Приложение установлено. До встречи на главном экране!'); };
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOnline);
    window.addEventListener('hashchange', onHash);
    window.addEventListener('beforeinstallprompt', onInstall);
    window.addEventListener('appinstalled', onInstalled);
    const unsubscribe = watchPwa((status: PwaStatus) => setPwa(status));
    void register();
    return () => { unsubscribe(); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOnline); window.removeEventListener('hashchange', onHash); window.removeEventListener('beforeinstallprompt', onInstall); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 6500); return () => clearTimeout(timer); }, [toast]);
  useEffect(() => { setAudioNotice(''); stop(); }, [modal]);
  useEffect(() => { lessonActive(Boolean(game)); return () => lessonActive(false); }, [game]);
  useEffect(() => { if (!profile.preferences.effects || profile.preferences.volume === 0) stopEffects(); }, [profile.preferences.effects, profile.preferences.volume]);
  useEffect(() => {
    const quiet = () => { if (document.hidden) { stopEffects(); stop(); } };
    document.addEventListener('visibilitychange', quiet);
    return () => { document.removeEventListener('visibilitychange', quiet); stopEffects(); };
  }, []);
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    function notificationClick(event: MessageEvent) {
      if (event.source !== navigator.serviceWorker.controller || event.data?.type !== 'OPEN_STUDY') return;
      if (!game) { setModal(null); navigate('learn'); }
    }
    navigator.serviceWorker.addEventListener('message', notificationClick);
    return () => navigator.serviceWorker.removeEventListener('message', notificationClick);
  }, [game]);
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }); }, [page]);
  useEffect(() => {
    if (!mobileMenu) return;
    const previous = document.activeElement as HTMLElement | null;
    const wasLocked = document.body.classList.contains('menu-scroll-lock');
    const elements = Array.from(document.querySelectorAll<HTMLElement>('.sidebar a, .sidebar button'));
    document.body.classList.add('menu-scroll-lock');
    elements[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobileMenu(false); return; }
      if (event.key !== 'Tab') return;
      const first = elements[0]; const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const onResize = () => { if (window.innerWidth > 768) setMobileMenu(false); };
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => { if (!wasLocked) document.body.classList.remove('menu-scroll-lock'); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', onResize); previous?.focus(); };
  }, [mobileMenu]);

  function navigate(nextPage: Page) { stop(); stopEffects(); setPage(nextPage); window.location.hash = nextPage; setMobileMenu(false); }
  function practice(id: string) { setPracticeTopic(id); setModal(null); navigate('practice'); }
  function open(nextModal: string) { setModal(nextModal); setMobileMenu(false); }
  function start(id = currentLesson.id, practice = false, mode: GameMode = 'visual') {
    if (storage.readOnly) { setToast('Сначала обнови приложение: формат сохранения не поддерживается.'); return; }
    const fresh = refresh(profile) as Profile;
    setProfile((state) => refresh(state) as Profile);
    if (!lesson(id) || (!practice && !unlocked(id, fresh.completed))) { setToast('Сначала пройди предыдущие уроки. Путешествуем шаг за шагом!'); return; }
    setPending({ id, practice, mode });
    if (!practice && fresh.hearts === 0) { setGame(null); open('hearts'); return; }
    setGame(null);
    open(resume ? 'resume' : 'setup');
  }
  function launch(mode: GameMode) {
    if (storage.readOnly || storage.pending) return;
    const fresh = refresh(profile) as Profile;
    if (!pending.practice && fresh.hearts === 0) { open('hearts'); return; }
    const round = create(pending.id, fresh, { practice: pending.practice, mode }) as Round | null;
    if (!round) { setToast('Этот режим пока недоступен. Выбери визуальную игру.'); return; }
    setResume(null); setModal(null); storeRound(round); setGame(round);
  }
  function resumeGame() {
    if (storage.readOnly || storage.pending) return;
    const restored = (resume ? validateRound(resume, profile) : restoreRound(profile)) as Round | null;
    if (!restored) { setResume(null); setModal(null); setToast('Сохранённый раунд устарел. Постоянный прогресс на месте, можно начать новый урок.'); return; }
    if (profile.rewardedRounds.includes(restored.id)) { clearRound(); setResume(null); setModal(null); setToast('Этот раунд уже завершён. Награда сохранена, можно двигаться дальше.'); return; }
    if (!restored.practice && profile.hearts === 0 && restored.phase === 'question') { open('hearts'); return; }
    setResume(null); setModal(null); setGame(restored);
  }
  function openTopic(topic: Topic) { setSelectedTopic(topic); open(course(topic.id) && topicUnlocked(topic.id, profile.completed) ? 'lessons' : 'locked'); }
  function achievementValue(id: string) { return id === 'streak' ? profile.bestStreak : id === 'xp' ? profile.xp : id === 'alphabet' ? topicProgress('alphabet', profile.completed).done : completedCount; }
  async function audio(item: typeof words.daily | Letter) { const result = await play(item, setAudioNotice); setAudioNotice(result.message); if (!modal && result.message) setToast(result.message); }
  function exportProgress() {
    if (storage.readOnly) { setToast('Эта версия не может безопасно экспортировать исходное сохранение. Обнови приложение; данные на устройстве не изменены.'); return; }
    try {
      const url = URL.createObjectURL(new Blob([exportProfile(profile)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = `nohchiin-mott-${day()}.json`; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000); setToast('Файл с прогрессом готов. Храни его в надёжном месте.');
    } catch { setToast('Не удалось подготовить файл. Текущий прогресс не удалён.'); }
  }
  async function importProgress(file?: File) {
    if (!file) return;
    if (storage.readOnly) { setToast('Сначала обнови приложение, чтобы не потерять сохранение новой версии.'); return; }
    const request = ++importRequest.current;
    setImporting(true);
    try {
      const next = await inspectImport(file) as Profile;
      if (request !== importRequest.current) return;
      setImported(next); open('import');
    } catch { if (request === importRequest.current) setToast('Файл не подходит: нужен JSON-снимок игры до 250 КБ без повреждённых или небезопасных полей. Текущий прогресс не изменился.'); }
    finally { if (request === importRequest.current) setImporting(false); }
  }
  async function confirmImport() {
    if (!imported || storage.readOnly || storage.pending) return;
    const saved = await storage.replace(imported);
    if (!saved) { setToast('Не удалось сохранить замену. Старый прогресс не удалён.'); return; }
    void closeReminderNotifications(); clearRound(); setResume(null); setImported(null); setModal(null); setToast('Твоё путешествие восстановлено. Напоминания выключены до нового согласия.');
  }
  async function resetProgress() {
    if (storage.readOnly || storage.pending) return;
    const saved = await storage.replace({ ...defaults(), generation: identity() } as Profile);
    if (!saved) { setToast('Не удалось сбросить профиль. Данные на устройстве не удалялись.'); return; }
    try { localStorage.removeItem(`${STORAGE_KEY}:recovery`); } catch { /* Не мешаем уже сохранённому чистому профилю. */ }
    void closeReminderNotifications(); clearRound(); setResume(null); setModal(null); setToast('Начинаем с чистого листа. Впереди много открытий!');
  }

  function topicCard(topic: Topic, index: number) {
    const progress = topicProgress(topic.id, profile.completed);
    const active = Boolean(course(topic.id)) && topicUnlocked(topic.id, profile.completed);
    const previous = topics.find((item) => item.id === topic.prerequisite);
    return <button key={topic.id} className={`topic-card ${active ? 'topic-active' : ''} theme-${topic.color}`} data-order={index} onClick={() => openTopic(topic)} aria-label={`${topic.title}. ${active ? `${progress.done} из ${progress.total} уроков пройдено` : `Откроется после темы ${previous?.title}`}`}>
      <div className="topic-picture"><TopicArt variant={topic.art} />{active ? <span className="topic-label">{progress.done === progress.total ? 'Пройдено' : progress.done ? 'Продолжай' : topic.id === 'alphabet' ? 'Начни здесь' : 'Можно начинать'}</span> : <LockKeyhole size={17} className="topic-lock" />}</div>
      <div className="topic-content"><h3>{topic.title}<ChevronRight size={18} /></h3><p>{topic.subtitle}</p>{active ? <><Progress value={progress.done} max={progress.total} label={`Прогресс темы ${topic.title}`} /><span className="topic-bottom"><span>{progress.done} из {progress.total} уроков</span><span>{Math.round(progress.done / progress.total * 100)}%</span></span></> : <span className="topic-locked-label"><LockKeyhole size={12} />{topic.ready ? `После темы «${previous?.title}»` : 'Новые открытия впереди'}</span>}</div>
    </button>;
  }

  return <div className={`app age-${profile.age === '5-8' ? 'junior' : 'senior'}`}>
    <a href="#main-content" className="skip-link">Перейти к содержимому</a>
    {mobileMenu && <button className="sidebar-backdrop" aria-label="Закрыть меню" onClick={() => setMobileMenu(false)} />}
    <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`} aria-label="Навигация по приложению" role={mobileMenu ? 'dialog' : undefined} aria-modal={mobileMenu ? true : undefined}>
      <a className="brand" href="#learn" onClick={() => navigate('learn')} aria-label="Нохчийн Мотт, главный экран"><Wolf className="brand-wolf" /><span>Нохчийн<span>Мотт<span className="brand-dot">.</span></span></span></a>
      <p className="brand-caption">Родной язык. Близкие корни.</p>
      <nav className="side-nav" aria-label="Основная навигация">{navigation.map((item) => <a key={item.id} className={`nav-item ${page === item.id ? 'active' : ''}`} href={`#${item.id}`} aria-current={page === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><item.icon size={23} strokeWidth={page === item.id ? 2.3 : 1.85} /><span>{item.title}</span>{page === item.id && <span className="nav-dot" />}</a>)}</nav>
      <div className="sidebar-bottom"><button className={`parent-nav ${page === 'parents' ? 'parent-nav-active' : ''}`} aria-current={page === 'parents' ? 'page' : undefined} onClick={() => navigate('parents')}><ShieldCheck size={22} />Родителям<ChevronRight size={16} /></button>
        <div className="install-box"><span className="install-illustration"><Smartphone size={35} strokeWidth={1.7} /><span><ArrowDownToLine size={12} /></span></span><h3>Всегда рядом</h3><p>Родной язык в кармане.<br />Учись, где бы ты ни был.</p><button onClick={() => open('install')}>{installed ? 'Приложение установлено' : 'Установить приложение'}{installed ? <Check size={15} /> : <Download size={15} />}</button></div>
        <span className="sidebar-footnote"><Leaf size={13} />С любовью к родному языку</span>
      </div>
    </aside>

    <div className="main-shell" inert={mobileMenu}>
      <header className="topbar"><div className="topbar-left"><button className="icon-button menu-button" aria-label="Открыть меню" aria-expanded={mobileMenu} onClick={() => setMobileMenu(!mobileMenu)}><Menu size={23} /></button><span className="topbar-message"><span className="tiny-sun"><Sun size={18} /></span>Маленькие шаги. Большие открытия.</span><span className="mobile-brand">Нохчийн Мотт<span>.</span></span></div>
        <div className="topbar-stats"><button className="stat-button streak-stat" onClick={() => open('streak')} aria-label={`Серия: ${profile.streak} ${plural(profile.streak)}`}><Flame size={25} fill="#ffbf68" stroke="#e69439" /><strong>{profile.streak}</strong><span>{plural(profile.streak)}</span></button><button className="stat-button xp-stat" onClick={() => open('level')} aria-label={`${profile.xp} очков опыта`}><Star size={24} fill="#f6ce64" stroke="#dcae36" /><strong>{profile.xp}</strong><span>XP</span></button><button className="stat-button heart-stat" onClick={() => open('hearts')} aria-label={`${profile.hearts} из 5 жизней`}><Heart size={24} fill="#ec888a" stroke="#df777e" /><strong>{profile.hearts}</strong></button><span className="header-divider" /><button className="profile-button" onClick={() => navigate('profile')} aria-label="Открыть мой профиль"><Avatar variant={profile.avatar} /><ChevronDown size={15} /></button></div>
      </header>

      <main id="main-content" className="main-content">
        {storageIssue && <div className="storage-notice" role="status"><ShieldCheck size={20} /><p>{storageIssue}</p><button className="text-button" disabled={storage.pending} onClick={storage.retry}>Проверить снова</button></div>}
        {!online && <div className="offline-notice" role="status"><WifiOff size={18} />{offlineReady ? 'Ты не в сети. Загруженные уроки и прогресс остаются с тобой.' : 'Ты не в сети. Играй в открытой вкладке, прогресс сохраняется на устройстве.'}</div>}
        {pwa.updateAvailable && <div className="update-notice" role="status"><Sparkles size={19} /><span>Новая версия готова. Твой прогресс останется с тобой.</span><button className="text-button" disabled={Boolean(game)} onClick={() => { void applyUpdate().catch(() => setToast('Обновление подождёт. Попробуй ещё раз позже.')); }}>Обновить<ArrowRight size={16} /></button></div>}
        {page === 'learn' && <div className="page-enter">
          <div className="page-heading"><div><h1>Рады видеть тебя, {profile.name}!<span className="greeting-spark"><Sparkles size={25} /></span></h1><p>Сегодня отличный день для маленького открытия.</p></div><div className="age-switch" role="group" aria-label="Возрастной режим"><button className={profile.age === '5-8' ? 'selected' : ''} aria-pressed={profile.age === '5-8'} onClick={() => setProfile((state) => ({ ...state, age: '5-8' }))}>5-8 лет</button><button className={profile.age === '9+' ? 'selected' : ''} aria-pressed={profile.age === '9+'} onClick={() => setProfile((state) => ({ ...state, age: '9+' }))}>9+ лет</button></div></div>

          <section className="welcome-hero" aria-labelledby="hero-heading"><Landscape /><div className="hero-copy"><span className="hero-eyebrow">УЧИМ ЧЕЧЕНСКИЙ ВМЕСТЕ</span><h2 id="hero-heading"><span lang="ce">Нохчийн мотт.</span><br />Язык твоей семьи.</h2><p>Играй, открывай новое и становись<br className="desktop-break" /> ближе к своим корням.</p><button className="button button-primary hero-cta" onClick={() => start()}>{completedCount ? 'Продолжить учиться' : 'Начать путешествие'}<ArrowRight size={19} /></button></div></section>

          {resume && <div className="resume-strip"><span className="resume-symbol"><Pause size={21} /></span><div><strong>Твой урок ждёт тебя</strong><p>{lesson(resume.lessonId)?.title} · вопрос {resume.index + 1} из {resume.questions.length}</p></div><button className="text-button" onClick={resumeGame}>Продолжить<ArrowRight size={17} /></button></div>}
          <section className="journey-section" aria-labelledby="journey-heading"><div className="section-heading"><div><h2 id="journey-heading">Твоё путешествие</h2><p>От первых букв к первым разговорам.</p></div><button className="text-button" onClick={() => open('topics')}>Все темы<ArrowRight size={17} /></button></div><div className="topic-grid">{topics.slice(0, 4).map(topicCard)}</div></section>

          <div className="discovery-grid"><section className="daily-goal" aria-labelledby="goal-heading"><TargetArt className="target-art" /><div className="goal-content"><span className="eyebrow">ПО ЧУТЬ-ЧУТЬ КАЖДЫЙ ДЕНЬ</span><h2 id="goal-heading">{profile.dailyXP >= dailyGoal ? 'Маленькая цель достигнута!' : 'Твоя маленькая цель'}</h2><p>{profile.dailyXP >= dailyGoal ? 'На сегодня уже достаточно. Ты молодец!' : `Заработай ${dailyGoal} XP сегодня. Без спешки!`}</p><div className="goal-progress"><Progress value={profile.dailyXP} max={dailyGoal} label="Ежедневная цель" color="purple" /><span>{Math.min(profile.dailyXP, dailyGoal)} / {dailyGoal} XP</span></div></div><button className="goal-action" aria-label="Начать урок для ежедневной цели" onClick={() => start()}>{profile.dailyXP >= dailyGoal ? <Check size={21} /> : <ArrowRight size={21} />}</button></section>
            <section className="word-day" aria-labelledby="word-heading"><div><span className="eyebrow">СЛОВО ДНЯ</span><h2 id="word-heading" lang="ce">{words.daily.chechen}<span>{words.daily.russian}</span></h2><p>{words.daily.description}</p></div><button className="word-audio" aria-label={`Узнать слово ${words.daily.chechen}`} onClick={() => open('word')}><Volume2 size={26} /></button><span className="word-decoration" aria-hidden="true"><Heart size={27} strokeWidth={1.4} /></span></section></div>
          <section className="play-discovery"><div><span className="eyebrow">СЛОВА ОЖИВАЮТ В ИГРЕ</span><h2>Каждый раз по-новому</h2><p>Находи пары, собирай слова и пробуй короткую викторину.</p></div><button className="button button-secondary" onClick={() => navigate('practice')}>В мастерскую<Puzzle size={19} /></button></section>
          <PublicFaq compact />
        </div>}

        {page === 'practice' && <Practice profile={profile} topicId={practiceTopic} onTopic={setPracticeTopic} onStart={(id, mode) => start(id, true, mode)} onCard={(item) => { setSelectedLetter(item); open('letter'); }} />}

        {page === 'achievements' && <div className="page-enter"><div className="page-heading"><div><span className="eyebrow">КАЖДЫЙ ШАГ ВАЖЕН</span><h1>Твои маленькие победы</h1><p>Собирай знания, а награды найдут тебя сами.</p></div><Trophy size={43} className="heading-trophy" /></div><div className="achievement-summary"><div className="achievement-level"><Star size={38} fill="currentColor" /><div><strong>Уровень {level}</strong><span>{level === 1 ? 'Любопытный исследователь' : 'Смелый путешественник'}</span></div></div><div><div className="summary-progress-label"><span>До следующего уровня</span><strong>{currentXP} / 100 XP</strong></div><Progress value={currentXP} label="Прогресс уровня" /></div></div><div className="achievement-grid">{achievements.map((item) => {
            const value = achievementValue(item.id); const earned = value >= item.goal; const Icon = item.icon === 'flame' ? Flame : item.icon === 'star' ? Star : item.icon === 'book' ? BookOpen : Footprints;
            return <button key={item.id} className={`achievement-card theme-${item.color} ${earned ? 'achievement-earned' : ''}`} onClick={() => { setSelectedAchievement(item); open('achievement'); }}><span className="achievement-art"><Icon size={43} strokeWidth={1.5} /></span><span className="achievement-status">{earned ? <><Check size={14} />Получено</> : <><LockKeyhole size={13} />Всё впереди</>}</span><h2>{item.title}</h2><p>{item.description}</p><Progress value={value} max={item.goal} label={item.title} /><span className="achievement-counter">{Math.min(value, item.goal)} / {item.goal} {item.unit}</span></button>;
          })}</div><div className="encouragement"><Leaf size={21} /><p>Сравнивай себя только с собой вчерашним. Волчонок уже гордится тобой.</p></div></div>}

        {page === 'profile' && <ProfileView key={profile.generation} profile={profile} onChange={setProfile} onExport={exportProgress} onImport={importProgress} onReset={() => open('reset')} onSaved={() => setToast('Сохраняем настройки профиля. Если запись недоступна, появится сообщение.')} onCalendar={() => open('streak')} onPractice={practice} onParents={() => navigate('parents')} importing={importing} />}
        {page === 'parents' && <Parents key={profile.generation} profile={profile} workerReady={offlineReady} onChange={setProfile} onBack={() => navigate('learn')} onPractice={practice} onProfile={() => navigate('profile')} />}
        <footer className="main-footer"><span><Heart size={13} />С заботой о языке. С любовью к детям.</span><div><a href="/about.html">О проекте</a><span>·</span><a href="/privacy.html">Приватность</a><span>·</span><button onClick={() => open('help')}>Нужна помощь?</button></div></footer>
      </main>
    </div>

    {game && <Lesson key={game.id} initial={game} profile={profile} persistenceWarning={storageIssue} saving={storage.pending || storage.readOnly}
      onSoundToggle={() => { stopEffects(); setProfile((state) => ({ ...state, preferences: { ...state.preferences, effects: !state.preferences.effects } })); }}
      onClose={() => { clearRound(); setGame(null); setResume(null); }}
      onPause={(round) => { setResume(round); setGame(null); }}
      onMistake={(attemptId) => setProfile((state) => state.generation === game.generation ? mistake(state, Date.now(), attemptId) as Profile : state)}
      onFinish={(result) => setProfile((state) => complete(state, result) as Profile)}
      onNext={(id, practice, mode) => { clearRound(); setResume(null); start(id, practice, mode); }} />}
    {modal && !game && <Dialog key={modal} title={modal === 'lessons' ? `Уроки: ${selectedTopic.title}` : modal === 'streak' ? 'Календарь занятий и ежедневная серия' : 'Нохчийн Мотт: информация и помощь'} onClose={() => setModal(null)} wide={modal === 'topics' || modal === 'about'}>
      {modal === 'lessons' && <LessonMap topicId={selectedTopic.id} profile={profile} onStart={(id) => start(id)} />}
      {modal === 'setup' && <LessonSetup id={pending.id} practice={pending.practice} profile={profile} onLaunch={launch} initialMode={pending.mode} busy={storage.pending || storage.readOnly} />}
      {modal === 'import' && imported && <div className="centered-modal"><div className="modal-feature-icon install-feature"><ShieldCheck size={38} /></div><h2>Продолжить другое путешествие?</h2><p>Файл проверен, но пока ничего не заменено. Импорт перезапишет профиль и историю на этом устройстве.</p><dl className="import-comparison"><div><dt>Сейчас</dt><dd>{profile.xp} XP<span>{Object.keys(profile.completed).length} уроков</span></dd></div><div><dt>В сохранении</dt><dd>{imported.xp} XP<span>{Object.keys(imported.completed).length} уроков</span></dd></div></dl><p className="modal-note">Напоминания из файла не включаются. Для них потребуется новое согласие взрослого. Исходные ответы и файлы никуда не отправляются.</p><button className="button button-secondary full-width" onClick={exportProgress}><Download size={17} />Скачать текущий прогресс</button><button className="button button-primary full-width" disabled={storage.pending || storage.readOnly} onClick={() => void confirmImport()}>Заменить прогресс<Check size={17} /></button><button className="text-button result-back" onClick={() => { setImported(null); setModal(null); }}>Оставить мой профиль</button></div>}
      {modal === 'resume' && resume && <div className="centered-modal"><div className="modal-feature-icon install-feature"><Pause size={38} /></div><h2>У нас осталось маленькое дело</h2><p>Урок «{lesson(resume.lessonId)?.title}» на паузе. Продолжим с вопроса {resume.index + 1}?</p><button className="button button-primary full-width" onClick={resumeGame}>Продолжить сохранённый урок<Play size={18} /></button><button className="button button-secondary full-width" onClick={() => { clearRound(); setResume(null); open('setup'); }}>Начать выбранный урок заново</button><p className="modal-note">Новый раунд заменит незавершённый. Уже сохранённые XP и уроки останутся, потраченные жизни не вернутся.</p></div>}

      {modal === 'topics' && <><span className="modal-eyebrow"><Mountain size={19} />КАРТА ОТКРЫТИЙ</span><h2>Целый мир родных слов</h2><p className="modal-lead">{courses.length} тем и {lessons.length} коротких урока. На карте идём по порядку, в тренировке можно познакомиться с любой темой.</p><div className="all-topics-grid">{topics.map(topicCard)}</div><p className="modal-note">Природа готовится к следующему обновлению. Учебные слова и пояснения пока ожидают проверки преподавателем.</p></>}

      {modal === 'locked' && <div className="centered-modal"><div className={`locked-art theme-${selectedTopic.color}`}><TopicArt variant={selectedTopic.art} /></div><span className="modal-eyebrow">ЕЩЁ ОДНА ВЕРШИНА ВПЕРЕДИ</span><h2>{selectedTopic.title}</h2><p>{!selectedTopic.ready ? 'Эту тему мы ещё готовим. Пока столько других открытий рядом!' : `Чтобы открыть уроки, пройди тему «${topics.find((item) => item.id === selectedTopic.prerequisite)?.title}».`}</p><button className="button button-primary full-width" onClick={() => start()}>Продолжить мой путь<ArrowRight size={18} /></button>{selectedTopic.ready && <button className="button button-secondary full-width" onClick={() => { setPracticeTopic(selectedTopic.id); setModal(null); navigate('practice'); }}>Познакомиться в тренировке<Puzzle size={18} /></button>}<p className="modal-note">Свободная тренировка даёт XP, но не открывает уроки карты и не отнимает сердечки.</p></div>}

      {modal === 'hearts' && <div className="centered-modal"><div className="modal-feature-icon hearts-feature"><Heart size={46} fill="currentColor" /></div><h2>{profile.hearts === 5 ? 'Полон сил и готов к открытиям!' : profile.hearts === 0 ? 'Немного отдыха или повторение?' : 'Сердечки помогают не спешить'}</h2><div className="heart-display" aria-label={`${profile.hearts} из 5 жизней`}>{[1, 2, 3, 4, 5].map((n) => <Heart key={n} size={35} className={n <= profile.hearts ? 'full' : ''} fill="currentColor" />)}</div><p>За ошибку в уроке уходит одно сердечко. Каждые 30 минут одно восстанавливается.</p>{profile.hearts < 5 && <HeartTimer profile={profile} />}<div className="modal-tip"><Puzzle size={25} /><p>Успешная тренировка возвращает одну жизнь. И никаких потерь за ошибки!</p></div><button className="button button-primary full-width" onClick={() => start(currentLesson.id, true)}>Повторить буквы<ArrowRight size={18} /></button></div>}

      {modal === 'streak' && <StreakCalendar profile={profile} onStart={() => start()} />}

      {modal === 'level' && <div className="centered-modal"><div className="modal-feature-icon star-feature"><Star size={47} fill="currentColor" /></div><span className="modal-eyebrow">ЛЮБОПЫТНЫЙ ИССЛЕДОВАТЕЛЬ</span><h2>Уровень {level}</h2><p>Каждый правильный ответ приносит 4 XP. Каждые 100 XP открывают новый уровень.</p><div className="level-progress"><Progress value={currentXP} label="Опыт до следующего уровня" /><span>{currentXP} / 100 XP</span></div><button className="button button-primary full-width" onClick={() => start()}>За новыми знаниями<ArrowRight size={18} /></button></div>}

      {modal === 'letter' && <div className="centered-modal"><span className="modal-eyebrow">{course(selectedLetter.topicId || 'alphabet')?.title.toLocaleUpperCase('ru')}</span>{selectedLetter.type === 'word' ? <><div className="word-detail-art"><ContentArt item={selectedLetter} /></div><h2 className="word-detail-name" lang="ce">{selectedLetter.chechen}</h2><p className="word-detail-translation">{selectedLetter.russian}</p></> : <><div className="letter-detail" lang="ce">{selectedLetter.chechen}<span>{selectedLetter.lower}</span></div><h2>{selectedLetter.russian}</h2></>}<p>{selectedLetter.transcription}</p><button className="button button-secondary full-width" onClick={() => audio(selectedLetter)}><Volume2 size={20} />Послушать произношение</button>{audioNotice && <p className="audio-notice" role="status">{audioNotice}</p>}<p className="modal-note">Пояснение по-русски не заменяет живое произношение. Материал ожидает проверки преподавателем.</p>{cardSource && <a className="content-source" href={cardSource.url} target="_blank" rel="noreferrer">Источник: {cardSource.title}</a>}</div>}

      {modal === 'word' && <div className="centered-modal"><div className="modal-feature-icon hearts-feature"><Heart size={44} /></div><span className="modal-eyebrow">СЛОВО ДНЯ</span><h2 className="daily-word-title" lang="ce">{words.daily.chechen}</h2><p className="daily-word-translation">{words.daily.russian}</p><p>{words.daily.description}</p><button className="button button-secondary full-width" onClick={() => audio(words.daily)}><Volume2 size={20} />Послушать слово</button>{audioNotice && <p className="audio-notice" role="status">{audioNotice}</p>}<p className="modal-note">Попробуй спросить у близких, как это слово звучит в вашей семье.</p></div>}

      {modal === 'achievement' && <div className="centered-modal"><div className={`modal-feature-icon theme-${selectedAchievement.color}`}><Trophy size={46} /></div><span className="modal-eyebrow">{achievementValue(selectedAchievement.id) >= selectedAchievement.goal ? 'ТВОЯ ЗАСЛУЖЕННАЯ НАГРАДА' : 'НОВАЯ ВЕРШИНА ВПЕРЕДИ'}</span><h2>{selectedAchievement.title}</h2><p>{selectedAchievement.description}</p><div className="level-progress"><Progress value={achievementValue(selectedAchievement.id)} max={selectedAchievement.goal} label={selectedAchievement.title} /><span>{Math.min(achievementValue(selectedAchievement.id), selectedAchievement.goal)} / {selectedAchievement.goal} {selectedAchievement.unit}</span></div><button className="button button-primary full-width" onClick={() => start()}>Сделать маленький шаг<ArrowRight size={18} /></button></div>}

      {modal === 'install' && <PwaPanel status={pwa} installed={installed} canInstall={Boolean(installPrompt)} onInstall={async () => { if (!installPrompt) return; try { await installPrompt.prompt(); const choice = await installPrompt.userChoice; if (choice.outcome === 'accepted') setToast('Браузер устанавливает приложение.'); setInstallPrompt(null); } catch { setToast('Установку можно попробовать снова через меню браузера.'); } }} />}

      {modal === 'about' && <>
        <span className="modal-eyebrow"><ShieldCheck size={19} />О ПРОЕКТЕ</span>
        <h2>Сохраняем язык. Вместе.</h2>
        <p className="modal-lead">«Нохчийн Мотт» помогает детям познакомиться с чеченским языком через маленькие игровые открытия. Для семей в Чечне, России, Франции и по всей диаспоре.</p>
        <div className="parent-summary"><div><strong>{completedCount}</strong><span>уроков пройдено</span></div><div><strong>{profile.learned.filter((id) => alphabetIds.has(id)).length}</strong><span>букв узнано в игре</span></div><div><strong>{profile.learned.filter((id) => !alphabetIds.has(id)).length}</strong><span>слов узнано в игре</span></div></div>
        <div className="parent-info">
          <h3><Heart size={19} />Безопасное место для учёбы</h3><p>Нет аккаунтов, рекламы, чатов, платежей и аналитики. Прозвище и прогресс хранятся на устройстве. Текущий вопрос дополнительно сохраняется в этой вкладке, чтобы его можно было продолжить после перезагрузки. Резервную копию прогресса можно скачать в профиле.</p>
          <h3><Volume2 size={19} />Настоящий язык, не синтез речи</h3><p>Звуковая игра подключается только к записям с разрешением на публикацию и отметкой проверки носителем. Пока таких записей нет, доступно узнавание букв. Ошибка загрузки звука никогда не отнимает сердечко.</p>
          <h3><BookOpen size={19} />Маленькие, но полные открытия</h3><p>Каждый урок охватывает всю группу карточек. В новых играх можно соединять пары и собирать слова из чеченских букв. Сочетания кӀ, кх и аь не разрываются. Для младших вариантов меньше, викторина даёт 90 секунд; для 9+ есть дополнительные буквы и 60 секунд. Таймер всегда можно заменить спокойной игрой.</p>
        </div>
        <details className="faq-item"><summary>На каком этапе находится проект?</summary><p>Шестой этап: публичные страницы, ответы для семей, SEO-разметка и подготовка статического выпуска со строгой CSP. Уже есть 49 букв, 68 слов и выражений, восемь тем и 24 урока. Голосовые записи, домен и окончательная приёмка пока не готовы. Backend, аналитика и фоновый push не подключены. Это не финальный публичный релиз.</p></details>
        <details className="faq-item"><summary>Какие источники использованы?</summary><p>Состав алфавита сверялся с <a href="https://govzalla.com/dosh/" target="_blank" rel="noreferrer">учебными материалами Govzalla</a> и <a href="https://nasha-shkola.info/index.php/home/obshchestvo/4653-kak-formirovalas-chechenskaya-pismennost" target="_blank" rel="noreferrer">статьёй газеты «Наша школа»</a>. Чужие аудиозаписи не копировались. Иллюстрация волчонка создана для прототипа с помощью ИИ.</p></details>
        <button className="button button-secondary parent-profile-button" onClick={() => { setModal(null); navigate('parents'); }}>Открыть родительский уголок<ArrowRight size={18} /></button>
      </>}

      {modal === 'help' && <><span className="modal-eyebrow"><CircleHelp size={19} />МЫ РЯДОМ</span><h2>Маленькие подсказки</h2><div className="help-list"><details className="faq-item" open><summary>Где найти новые игры?</summary><p>Открой «Тренировка», выбери тему и игру: пары, сборка слова или викторина. В тренировке открыты все готовые темы и не тратятся сердечки.</p></details><details className="faq-item"><summary>Как собрать слово?</summary><p>Нажимай на фишки по порядку. Повторяющиеся буквы отдельные, а кӀ, кх и аь находятся на одной фишке. Пробелы уже стоят. Можно убрать букву, начать заново или посмотреть образец.</p></details><details className="faq-item"><summary>Почему нет звука?</summary><p>Записи носителя ещё готовятся. Мы не используем неточное синтезированное произношение. Визуальные игры работают без аудио.</p></details><details className="faq-item"><summary>Я не люблю торопиться</summary><p>Викторина на время необязательна. Выбери пары, сборку или обычный урок. Таймер ставится на паузу вместе с игрой, а при разборе ответа не идёт.</p></details><details className="faq-item"><summary>Как открыть следующую тему?</summary><p>На карте пройди все уроки предыдущей темы. Урок считается пройденным после полного раунда и не менее 60% верных первых попыток. Свободная тренировка даёт XP, но не обходит карту.</p></details><details className="faq-item"><summary>Как сохранить мои открытия?</summary><p>Прогресс хранится на устройстве. Пауза сохраняется только в текущей вкладке. В профиле можно скачать файл прогресса и перенести его на другое устройство.</p></details></div><button className="button button-primary full-width" onClick={() => { setModal(null); navigate('practice'); }}>В мастерскую<Puzzle size={18} /></button></>}

      {modal === 'reset' && <div className="centered-modal"><div className="modal-feature-icon hearts-feature"><ArrowLeft size={40} /></div><h2>Начать новое путешествие?</h2><p>Все уроки, звёзды и XP будут заменены чистым профилем. Сначала можно скачать сохранение.</p><button className="button button-secondary full-width" onClick={exportProgress}><Download size={18} />Сначала сохранить прогресс</button><button className="button button-danger full-width" disabled={storage.pending || storage.readOnly} onClick={() => void resetProgress()}>Да, начать заново</button><button className="text-button result-back" onClick={() => setModal(null)}>Нет, продолжу своё путешествие</button></div>}
      {toast && <p className="dialog-status" role="status">{toast}</p>}
    </Dialog>}
    {reminder.visible && <section className="study-reminder" role="status" aria-label="Напоминание о занятии"><span className="reminder-symbol"><Bell size={23} /></span><div><h2>{motivation.reminder.title}</h2><p>{motivation.reminder.body}</p><div><button className="text-button" onClick={() => { reminder.dismiss(); start(); }}>Сделать шаг<ArrowRight size={15} /></button><button className="text-button muted" onClick={reminder.dismiss}>Не сегодня</button></div></div><button className="icon-button" aria-label="Скрыть напоминание" onClick={reminder.dismiss}><X size={17} /></button></section>}
    {toast && !modal && !game && !reminder.visible && <div className="toast" role="status"><span><CircleHelp size={21} />{toast}</span><button aria-label="Скрыть сообщение" onClick={() => setToast('')}><X size={18} /></button></div>}
  </div>;
}
