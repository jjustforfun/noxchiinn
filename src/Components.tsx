import { useEffect, useRef, type ReactNode } from 'react';
import { Mountain, Star, X } from 'lucide-react';
import { Wolf } from './Illustrations';
import { stop } from './audio.js';

/** Показывает доступную модалку с ловушкой фокуса и закрытием по Escape. */
export function Dialog({ title, children, onClose, wide = false, className = '' }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement as HTMLElement | null;
    const wasLocked = document.body.classList.contains('dialog-scroll-lock');
    dialog?.showModal();
    document.body.classList.add('dialog-scroll-lock');
    return () => { dialog?.close(); if (!wasLocked) document.body.classList.remove('dialog-scroll-lock'); stop(); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); };
  }, []);
  return <dialog ref={ref} aria-label={title} className={`dialog ${wide ? 'dialog-wide' : ''} ${className}`} onCancel={(event) => { event.preventDefault(); onClose(); }} onClick={(event) => { if (event.target === ref.current) onClose(); }}>
    <div className="dialog-inner"><button className="icon-button dialog-close" aria-label="Закрыть окно" onClick={onClose}><X size={22} /></button>{children}</div>
  </dialog>;
}

/** Отображает прогресс с доступным числовым значением. */
export function Progress({ value, max = 100, label, color = '' }: { value: number; max?: number; label: string; color?: string }) {
  const safeMax = Math.max(1, Number.isFinite(max) ? max : 100);
  const safeValue = Math.max(0, Math.min(Number.isFinite(value) ? value : 0, safeMax));
  return <progress className={`progress-track ${color}`} max={safeMax} value={safeValue} aria-label={label}>{Math.round(safeValue / safeMax * 100)}%</progress>;
}

/** Показывает заработанные звёзды, не полагаясь только на цвет. */
export function Stars({ count, size = 19 }: { count: number; size?: number }) {
  return <span className="stars" role="img" aria-label={`${count} из 3 звёзд`}>{[1, 2, 3].map((n) => <Star key={n} size={size} className={n <= count ? 'earned' : ''} aria-hidden="true" />)}</span>;
}

/** Отображает локальный аватар без фотографий ребёнка. */
export function Avatar({ variant, className = '' }: { variant: string; className?: string }) {
  return <span className={`avatar ${className} avatar-${variant}`}>{variant === 'mountain' ? <Mountain size={32} strokeWidth={1.7} /> : <Wolf variant={variant} />}</span>;
}