import { useEffect, useState } from 'react';
import { Clock3 } from 'lucide-react';
import { remaining } from './progress.js';
import type { Profile } from './types';

/** Показывает живой таймер, не записывая localStorage каждую секунду. */
export function HeartTimer({ profile }: { profile: Profile }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const seconds = Math.ceil(remaining(profile, now) / 1000);
  return <p className="recovery-time" role="timer" aria-label={`До следующей жизни ${Math.floor(seconds / 60)} минут ${seconds % 60} секунд`}><Clock3 size={18} />Следующее через {String(Math.floor(seconds / 60)).padStart(2, '0')}:{String(seconds % 60).padStart(2, '0')}</p>;
}