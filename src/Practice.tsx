import { useState } from 'react';
import { ArrowRight, BookOpen, Check, CircleHelp, Heart, Link2, Puzzle, Search, Timer } from 'lucide-react';
import { courses, course, letters, gameModes } from './catalog.js';
import { ContentArt } from './ContentArt';
import { Wolf } from './Illustrations';
import type { Content, GameMode, Profile } from './types';

/** Позволяет изучать все опубликованные темы без обхода основной карты прогресса. */
export function Practice({ profile, topicId, onTopic, onStart, onCard }: { profile: Profile; topicId: string; onTopic: (id: string) => void; onStart: (id: string, mode: GameMode) => void; onCard: (item: Content) => void }) {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const topic = course(topicId) || courses[0];
  const isAlphabet = topic.id === 'alphabet';
  const source = letters.filter((item) => item.topicId === topic.id && (item.ageGroup === 'all' || item.ageGroup === profile.age));
  const visible = source.filter((item) => (!isAlphabet || filter === 'all' || item.type === filter) && `${item.chechen} ${item.russian} ${item.number || ''}`.toLocaleLowerCase('ru').includes(search.toLocaleLowerCase('ru')));
  const games = gameModes.filter((item) => isAlphabet ? ['visual', 'speed'].includes(item.id) : ['match', 'build', 'speed'].includes(item.id));

  return <div className="page-enter">
    <div className="page-heading"><div><span className="eyebrow">ПОВТОРЯТЬ ЗНАЧИТ ЗАПОМИНАТЬ</span><h1>Мастерская знаний</h1><p>Выбери тему и открывай родной язык по-своему.</p></div><label className="practice-topic-select"><span>Тема</span><select value={topic.id} onChange={(event) => { onTopic(event.target.value); setSearch(''); setFilter('all'); }} aria-label="Тема тренировки">{courses.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label></div>
    <div className="practice-intro"><div className="practice-wolf"><Wolf /></div><div><h2>Здесь можно ошибаться</h2><p>Все темы доступны для знакомства. Сердечки не тратятся, а успешная тренировка возвращает одну жизнь.</p></div><Heart size={34} /></div>
    <section aria-labelledby="practice-games-title" className="practice-games-section"><div className="section-heading"><div><h2 id="practice-games-title">Во что сыграем?</h2><p>Один и тот же материал, разные маленькие открытия.</p></div></div><div className={`practice-games ${isAlphabet ? 'practice-games-two' : ''}`}>{games.map((game) => {
      const Icon = game.id === 'match' ? Link2 : game.id === 'build' ? Puzzle : game.id === 'speed' ? Timer : BookOpen;
      return <button key={game.id} className={`practice-game theme-${game.color}`} onClick={() => onStart(topic.lessons[0].id, game.id as GameMode)}><span className="practice-game-art"><Icon size={32} strokeWidth={1.7} /></span><h3>{isAlphabet && game.id === 'visual' ? 'Узнаём буквы' : game.title}</h3><p>{isAlphabet && game.id === 'visual' ? 'Большие и маленькие буквы вместе' : game.description}</p><span className="practice-game-link">Играть<ArrowRight size={17} /></span></button>;
    })}</div></section>
    <section aria-labelledby="dictionary-title"><div className="section-heading dictionary-heading"><div><h2 id="dictionary-title">{isAlphabet ? 'Твой алфавит' : 'Сначала познакомимся'}</h2><p>{source.length} {isAlphabet ? 'букв' : 'карточек'}. Нажми, чтобы узнать больше.</p></div><label className="search-input"><Search size={18} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={isAlphabet ? 'Найти букву' : 'Найти слово'} aria-label={isAlphabet ? 'Найти букву' : 'Найти слово'} /></label></div>
      {isAlphabet && <div className="filter-tabs dictionary-filters" role="group" aria-label="Фильтр букв">{[{ id: 'all', name: 'Все буквы' }, { id: 'vowel', name: 'Гласные' }, { id: 'consonant', name: 'Согласные' }, { id: 'special', name: 'Особые звуки' }].map((item) => <button key={item.id} className={filter === item.id ? 'selected' : ''} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>{item.name}</button>)}</div>}
      <div className={isAlphabet ? 'alphabet-grid' : 'vocabulary-grid'}>{visible.map((item) => isAlphabet ? <button key={item.id} className={`letter-tile ${item.type === 'vowel' ? 'letter-vowel' : item.type === 'special' ? 'letter-special' : ''}`} onClick={() => onCard(item)}><span lang="ce">{item.chechen}</span><small lang="ce">{item.lower}</small>{profile.learned.includes(item.id) && <Check size={14} />}</button> : <button key={item.id} className="vocabulary-card" onClick={() => onCard(item)} aria-label={`${item.russian}: ${item.chechen}. Открыть карточку`}><ContentArt item={item} /><strong lang="ce">{item.chechen}</strong><span>{item.russian}</span>{profile.learned.includes(item.id) && <Check className="vocabulary-learned" size={15} />}</button>)}</div>
      {!visible.length && <div className="empty-state"><Search size={32} /><h2>Пока ничего не нашлось</h2><p>Попробуй другое слово или сбрось поиск.</p><button className="text-button" onClick={() => { setSearch(''); setFilter('all'); }}>Показать все карточки<ArrowRight size={16} /></button></div>}
    </section>
    <p className="content-note"><CircleHelp size={17} />Материалы ожидают проверки носителем-преподавателем. Русские пояснения помогают читать, но не заменяют произношение. Тренировка не открывает уроки основной карты.</p>
  </div>;
}