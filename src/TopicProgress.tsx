import { ArrowRight, Check, LockKeyhole } from 'lucide-react';
import { topicStats } from './statistics.js';
import { topicUnlocked } from './catalog.js';
import topics from '../data/topics.json';
import { TopicArt } from './Illustrations';
import { Progress } from './Components';
import type { Profile } from './types';

/** Разделяет продвижение по урокам и узнавание карточек в свободной игре. */
export function TopicProgress({ profile, onPractice, compact = false }: { profile: Profile; onPractice: (id: string) => void; compact?: boolean }) {
  return <section className={`topic-progress-section ${compact ? 'topic-progress-compact' : ''}`} aria-label="Прогресс по темам"><div className="section-heading"><div><h2>Открытия по темам</h2><p>Уроки показывают путь, карточки помогают знакомиться с материалом.</p></div></div><div className="topic-progress-list">{topicStats(profile).map((item) => {
    const topic = topics.find((topic) => topic.id === item.id)!;
    const open = topicUnlocked(item.id, profile.completed);
    return <button key={item.id} className={`topic-progress-row theme-${topic.color}`} onClick={() => onPractice(item.id)} aria-label={`${item.title}. Пройдено ${item.completed} из ${item.lessons} уроков, узнано ${item.known} из ${item.cards} карточек. Открыть тренировку`}><span className="topic-progress-art"><TopicArt variant={topic.art} /></span><span className="topic-progress-copy"><strong>{item.title}{item.completed === item.lessons ? <Check size={15} /> : !open ? <LockKeyhole size={13} /> : null}</strong><span>{item.completed} / {item.lessons} уроков · {item.known} / {item.cards} карточек</span><Progress value={item.completed} max={item.lessons} label={`Уроки: ${item.title}`} /></span><ArrowRight size={17} /></button>;
  })}</div><p className="content-note">«Узнано» означает верный ответ в игре, а не проверенное владение словом или произношением. Повторять можно любую готовую тему.</p></section>;
}