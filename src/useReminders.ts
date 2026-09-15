import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { claimReminder, reminderDue, deliveryAllowed as storedDeliveryAllowed } from './reminders.js';
import { closeReminderNotifications, showReminderNotification } from './notifications.js';
import type { Profile } from './types';

/** Запускает только локальную проверку видимой вкладки, никогда не обещая фоновую доставку. */
export function useReminders(profile: Profile, onChange: Dispatch<SetStateAction<Profile>>, blocked: boolean) {
  const [visible, setVisible] = useState(false);
  const latest = useRef({ profile, blocked });
  latest.current = { profile, blocked };

  useEffect(() => {
    if (!profile.preferences.reminders.enabled || profile.activity[profile.dailyDate]?.rounds) {
      setVisible(false); void closeReminderNotifications();
    }
  }, [profile.preferences.reminders.enabled, profile.dailyDate, profile.activity]);

  useEffect(() => { setVisible(false); }, [profile.generation]);

  useEffect(() => {
    if (!profile.preferences.reminders.enabled) return;
    let alive = true; let checking = false;
    const available = () => alive && !latest.current.blocked && document.visibilityState === 'visible' && latest.current.profile.preferences.reminders.enabled;
    async function check() {
      if (checking || !reminderDue(latest.current.profile, Date.now(), available())) return;
      checking = true;
      try {
        const reserved = await claimReminder(latest.current.profile, available) as Profile | null;
        if (!reserved || !available() || reserved.generation !== latest.current.profile.generation) return;
        onChange((current) => current.generation !== reserved.generation ? current : { ...current, preferences: { ...current.preferences, reminders: { ...current.preferences.reminders, lastAt: reserved.preferences.reminders.lastAt, lastDay: reserved.preferences.reminders.lastDay } } });
        const deliveryAllowed = () => {
          const current = latest.current.profile;
          return available() && current.generation === reserved.generation && storedDeliveryAllowed(reserved);
        };
        if (!deliveryAllowed()) return;
        if (reserved.preferences.reminders.channel === 'system') {
          const sent = await showReminderNotification(true, false, deliveryAllowed);
          if (!sent.ok && deliveryAllowed()) setVisible(true);
        } else setVisible(true);
      } catch { /* Не повторяем автоматически ошибочную доставку и не нарушаем игру. */ }
      finally { checking = false; }
    }
    const timer = setInterval(() => { void check(); }, 15000);
    const onVisible = () => { void check(); };
    document.addEventListener('visibilitychange', onVisible); window.addEventListener('focus', onVisible);
    void check();
    return () => { alive = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', onVisible); };
  }, [profile.preferences.reminders.enabled, profile.generation, onChange]);

  return { visible: visible && !blocked, dismiss: () => setVisible(false) };
}