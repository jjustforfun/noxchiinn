import { useEffect, useRef, useState } from 'react';
import { Check, Eye, RotateCcw } from 'lucide-react';
import { ContentArt } from './ContentArt';
import { entry } from './catalog.js';
import { group } from './round.js';
import { tokenize, separator, movable } from './spelling.js';
import type { Content, Round } from './types';

/** Две колонки настоящих пар: сначала картинка, затем слово; перетаскивание не требуется. */
export function MatchStage({ round, onPick, onMatch }: { round: Round; onPick: (id: string) => void; onMatch: (id: string) => void }) {
  const batch = group(round) as string[];
  const words = round.pairOrder.filter((id) => batch.includes(id));
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (round.phase === 'question' && round.matched.length) root.current?.querySelector<HTMLButtonElement>('.match-picture:not(:disabled)')?.focus({ preventScroll: true });
  }, [round.matched.length, round.phase]);
  return <div className="matching-stage" ref={root}>
    <div className="matching-labels"><span>Картинка</span><span>Слово</span></div>
    <div className="matching-columns">
      <div role="group" aria-label="Выбери картинку">{batch.map((id) => {
        const item = entry(id)!; const solved = round.matched.includes(id);
        return <button key={id} className={`match-picture ${round.selected === id ? 'selected' : ''} ${solved ? 'matched' : ''} ${round.mismatch && round.selected === id ? 'mismatch' : ''}`} aria-label={`Картинка: ${item.russian}${solved ? ', пара найдена' : ''}`} aria-pressed={round.selected === id} disabled={solved || round.phase !== 'question'} onClick={() => onPick(id)}><ContentArt item={item} caption />{solved && <Check size={19} />}</button>;
      })}</div>
      <div role="group" aria-label="Выбери чеченское слово">{words.map((id) => {
        const item = entry(id)!; const solved = round.matched.includes(id);
        return <button key={id} className={`match-word ${solved ? 'matched' : ''} ${round.mismatch === id ? 'mismatch' : ''}`} aria-label={`Слово: ${item.chechen}${solved ? ', пара найдена' : ''}`} disabled={solved || !round.selected || round.phase !== 'question'} onClick={() => onMatch(id)}><span lang="ce">{item.chechen}</span>{solved && <Check size={18} />}</button>;
      })}</div>
    </div>
    <p className={`matching-notice ${round.mismatch ? 'matching-error' : ''}`} aria-live="polite">{round.mismatch ? 'Эта пара не подходит. Выбери другое слово, всё получится!' : round.phase === 'feedback' ? 'Все пары на месте!' : round.selected ? 'Теперь найди слово справа.' : 'Нажми на картинку слева.'}</p>
  </div>;
}

/** Собирает слово из отдельных фишек, сохраняя диграфы и повторяющиеся буквы. */
export function BuildStage({ round, item, onAdd, onRemove, onClear }: { round: Round; item: Content; onAdd: (index: number) => void; onRemove: (position: number) => void; onClear: () => void }) {
  const [showHint, setShowHint] = useState(false);
  const checked = round.phase !== 'question';
  let position = -1;
  return <div className="spelling-stage">
    <div className="spelling-cue"><ContentArt item={item} caption /></div>
    <div className="word-slots" aria-label="Собираемое слово">{tokenize(item.chechen).map((token, index) => {
      if (separator(token)) return <span key={index} className="word-separator" aria-label={token === ' ' ? 'Пробел' : 'Дефис'}>{token === '-' ? '-' : ''}</span>;
      const currentPosition = ++position;
      const tile = round.draft[currentPosition];
      return <button key={index} className={`word-slot ${tile !== undefined ? 'filled' : ''}`} aria-label={tile === undefined ? `Пустое место ${currentPosition + 1}` : `Убрать букву ${round.bank[tile]}`} disabled={tile === undefined || checked} onClick={() => onRemove(currentPosition)}><span lang="ce">{tile === undefined ? '' : round.bank[tile]}</span></button>;
    })}</div>
    <div className="tile-bank" role="group" aria-label="Буквы для сборки">{round.bank.map((token, index) => <button key={index} className={round.draft.includes(index) ? 'tile-used' : ''} aria-label={`Добавить ${token}, фишка ${index + 1}`} disabled={checked || round.draft.includes(index) || round.draft.length >= movable(item.chechen).length} onClick={() => onAdd(index)}><span lang="ce">{token}</span></button>)}</div>
    <div className="spelling-tools"><button className="text-button" disabled={checked || !round.draft.length} onClick={onClear}><RotateCcw size={15} />Начать слово заново</button><button className="text-button" aria-expanded={showHint} onClick={() => setShowHint(!showHint)}><Eye size={15} />{showHint ? 'Скрыть образец' : 'Показать образец'}</button></div>
    {showHint && <p className="spelling-example" lang="ce">{item.chechen}</p>}
    {round.age === '5-8' && <p className="spelling-helper">Нажимай на буквы по порядку. КӀ, кх, аь и другие сочетания уже собраны в одну фишку.</p>}
  </div>;
}