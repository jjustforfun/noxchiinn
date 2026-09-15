import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { defaults, readProgress, refresh, STORAGE_KEY } from './progress.js';
import { writeProgress } from './store.js';
import type { Profile } from './types';

const warnings: Record<string, string> = {
  future: 'Формат или размер сохранения не поддерживается этой версией. Мы его не изменяем. Обнови приложение перед продолжением.',
  memory: 'Браузер не разрешил запись. Прогресс пока только в этой вкладке. Скачай сохранение в профиле и не закрывай игру.',
  changed: 'Профиль изменился в другой вкладке. Мы сохранили более свежие данные. Повтори действие.',
  recovered: 'Сохранение было повреждено. Игра восстановлена, исходная копия оставлена на устройстве.',
  busy: 'Другая вкладка сейчас сохраняет прогресс. Подожди немного и повтори действие.',
  invalid: 'Не получилось применить изменение. Сохранённый прогресс не удалён.',
};
type Commit = { ok: boolean; status: string; profile: Profile };
type Controls = { pending: boolean; readOnly: boolean; replace: (profile: Profile) => Promise<boolean>; retry: () => void };

/** Согласует изменения вкладок, не подменяя будущую схему пустым профилем. */
export function useProgress(): [Profile, Dispatch<SetStateAction<Profile>>, string, Controls] {
  const [initial] = useState(() => readProgress());
  const [profile, setProfile] = useState<Profile>(initial.profile as Profile);
  const [warning, setWarning] = useState(initial.status === 'future' ? warnings.future : initial.status === 'corrupt' ? warnings.recovered : initial.status === 'unavailable' ? warnings.memory : '');
  const [pending, setPending] = useState(0);
  const [readOnly, setReadOnly] = useState(initial.status === 'future');
  const current = useRef(profile);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const mounted = useRef(true);

  const enqueue = useCallback((action: SetStateAction<Profile>, replace = false, initialize = false) => {
    const generation = current.current.generation;
    setPending((count) => count + 1);
    const task = queue.current.then(async () => {
      const result = await writeProgress(current.current, action, { expectedGeneration: generation, replace, initialize }) as Commit;
      current.current = result.profile;
      if (mounted.current) { setProfile(result.profile); setReadOnly(result.status === 'future'); setWarning(warnings[result.status] || ''); }
      return result.ok;
    }).catch(() => { if (mounted.current) setWarning(warnings.invalid); return false; }).finally(() => { if (mounted.current) setPending((count) => Math.max(0, count - 1)); });
    queue.current = task;
    return task;
  }, []);

  const update: Dispatch<SetStateAction<Profile>> = useCallback((action) => { void enqueue(action); }, [enqueue]);
  const replace = useCallback((next: Profile) => enqueue(next, true), [enqueue]);

  useEffect(() => {
    mounted.current = true;
    void enqueue((state) => state, false, true);
    function sync(event?: StorageEvent) {
      if (event && event.key !== STORAGE_KEY && event.key !== null) return;
      const snapshot = readProgress();
      if (snapshot.status === 'future') { setReadOnly(true); setWarning(warnings.future); return; }
      if (snapshot.status === 'ready') {
        const next = snapshot.profile as Profile;
        if (next.generation !== current.current.generation || next.updatedAt >= current.current.updatedAt) { current.current = next; setProfile(next); }
        setReadOnly(false);
      }
      else if (snapshot.status === 'empty' && event) { current.current = defaults() as Profile; setProfile(current.current); setWarning('Данные удалены в другой вкладке. Начинаем новый профиль.'); }
      else if (snapshot.status !== 'empty') setWarning(snapshot.status === 'corrupt' ? warnings.recovered : warnings.memory);
    }
    function tick() {
      const before = current.current; const next = refresh(before) as Profile;
      if (next.hearts !== before.hearts || next.streak !== before.streak || next.bestStreak !== before.bestStreak || next.dailyDate !== before.dailyDate || next.lastLogin !== before.lastLogin || next.heartUpdated < before.heartUpdated) update((latest) => refresh(latest) as Profile);
    }
    const onFocus = () => { sync(); tick(); };
    const timer = setInterval(tick, 1000);
    window.addEventListener('storage', sync); window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', tick);
    return () => { mounted.current = false; clearInterval(timer); window.removeEventListener('storage', sync); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', tick); };
  }, [enqueue, update]);

  return [profile, update, warning, { pending: pending > 0, readOnly, replace, retry: () => { void enqueue((state) => state, false, true); } }];
}