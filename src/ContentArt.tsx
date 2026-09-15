import type { Content } from './types';
import { vocabulary } from './assets.js';
import { BookOpen } from 'lucide-react';

/** Рисует карточку из данных: число, цвет или локальную иллюстрацию. */
export function ContentArt({ item, className = '', caption = false }: { item: Content; className?: string; caption?: boolean }) {
  return <span className={`content-art ${className}`}>
    {typeof item.number === 'number' ? <span className="number-art" aria-hidden="true"><strong>{item.number}</strong>{item.number <= 10 && <span className="counting-dots">{Array.from({ length: item.number }, (_, index) => <i key={index} />)}</span>}</span>
      : item.swatch ? <svg viewBox="0 0 160 140" aria-hidden="true"><ellipse cx="80" cy="118" rx="43" ry="7" fill="#dfdece" /><path d="M81 17c-8 17-46 51-46 72 0 53 90 53 90 0 0-23-35-55-44-72Z" fill={item.swatch} stroke="#879578" strokeWidth="1.5" /><path d="M49 87q-4 20 15 27" stroke="#ffffff70" strokeWidth="7" strokeLinecap="round" fill="none" /></svg>
      : item.image ? <svg viewBox="0 0 160 140" aria-hidden="true"><use href={item.image.replace('/images/vocabulary.svg', vocabulary)} /></svg>
      : item.type === 'word' ? <BookOpen size={65} aria-hidden="true" /> : <span className="letter-art" lang="ce" aria-hidden="true">{item.lower || item.chechen}</span>}
    {caption && <span className="art-caption">{item.russian}</span>}
  </span>;
}