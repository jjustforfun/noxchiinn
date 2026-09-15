import { useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Check, ShieldCheck, Smartphone } from 'lucide-react';
import motivation from '../data/motivation.json';
import { notificationPermission, requestNotifications, showReminderNotification, closeReminderNotifications } from './notifications.js';
import { cleanPreferences, validTime } from './preferences.js';
import type { Preferences, ReminderSettings as Reminder } from './types';

/** Сохраняет добровольные напоминания после явного согласия взрослого. Это не парольная защита. */
export function ReminderSettings({ preferences, workerReady, onChange }: { preferences: Preferences; workerReady: boolean; onChange: (patch: Partial<Preferences>) => void }) {
  const [draft, setDraft] = useState<Reminder>({ ...preferences.reminders, days: [...preferences.reminders.days] });
  const [consent, setConsent] = useState(false);
  const [permission, setPermission] = useState(notificationPermission);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const live = useRef({ mounted: true, consent, enabled: draft.enabled });
  live.current.consent = consent; live.current.enabled = draft.enabled;
  useEffect(() => { live.current.mounted = true; return () => { live.current.mounted = false; }; }, []);
  useEffect(() => { const focus = () => setPermission(notificationPermission()); window.addEventListener('focus', focus); return () => window.removeEventListener('focus', focus); }, []);

  function edit(patch: Partial<Reminder>) { setDraft((value) => ({ ...value, ...patch })); setSaved(false); setNotice(''); }
  function save() {
    if (draft.enabled && !consent) { setNotice('Подтвердите согласие взрослого. Пока напоминания не изменены.'); return; }
    if (draft.enabled && (!validTime(draft.time) || !draft.days.length)) { setNotice('Выберите хотя бы один день и время между 08:00 и 20:30.'); return; }
    if (draft.enabled && draft.channel === 'system' && notificationPermission() !== 'granted') { setNotice('Разрешите системные уведомления или выберите подсказку внутри игры.'); return; }
    const settings = cleanPreferences({ ...preferences, reminders: { ...draft, consent: draft.enabled && consent, lastDay: preferences.reminders.lastDay, lastAt: preferences.reminders.lastAt } }).reminders as Reminder;
    onChange({ reminders: settings }); setSaved(true);
    setNotice(settings.enabled ? 'Настройки сохранены. Подсказка появится только при открытой игре, не во время урока.' : 'Напоминания выключены. Больше не будем предлагать занятие по расписанию.');
    if (!settings.enabled) void closeReminderNotifications();
  }

  async function allow() {
    if (busy) return;
    setBusy(true);
    const result = await requestNotifications(consent); setPermission(result.permission); setBusy(false);
    if (result.ok) edit({ channel: 'system' });
    setNotice(result.message);
  }

  return <section className="reminder-settings" aria-labelledby="reminders-heading">
    <div className="settings-section-heading"><span className="settings-symbol"><Bell size={24} /></span><div><h2 id="reminders-heading">Мягкое напоминание</h2><p>Только если это удобно вашей семье.</p></div><span className={`setting-state ${preferences.reminders.enabled ? 'enabled' : ''}`}>{preferences.reminders.enabled ? 'Включено' : 'Выключено'}</span></div>
    <div className="reminder-explanation"><ShieldCheck size={20} /><p><strong>Без фоновых push и без сервера.</strong> Подсказка работает, только пока игра открыта и видна. При закрытом приложении ничего не придёт. Системное разрешение само по себе это не меняет.</p></div>
    <div className="settings-switch-row reminder-enable"><div><h3>Напоминать о маленьком открытии</h3><p>Не чаще раза в день. Если занятие уже было, не напомним.</p></div><button className={`settings-switch ${draft.enabled ? 'is-on' : ''}`} role="switch" aria-label="Напоминать о занятии" aria-checked={draft.enabled} onClick={() => edit({ enabled: !draft.enabled })}><span>{draft.enabled && <Check size={12} />}</span></button></div>
    {draft.enabled && <div className="reminder-form">
      <fieldset className="reminder-days"><legend>В какие дни?</legend>{motivation.weekdays.map((date) => <label key={date.id} className={draft.days.includes(date.id) ? 'selected' : ''}><input type="checkbox" checked={draft.days.includes(date.id)} aria-label={date.name} onChange={() => edit({ days: draft.days.includes(date.id) ? draft.days.filter((value) => value !== date.id) : [...draft.days, date.id].sort() })} /><span>{date.short}</span></label>)}</fieldset>
      <label className="reminder-time">Удобное время<input type="time" value={draft.time} min="08:00" max="20:30" onChange={(event) => edit({ time: event.target.value })} /></label>
      <p className="field-note">По времени устройства. Покажем при открытии в течение двух часов после выбранного времени, но не позже 21:00. За пропущенные дни напоминания не накапливаются.</p>
      <fieldset className="reminder-channels"><legend>Где показать?</legend><label><input type="radio" name="reminder-channel" checked={draft.channel === 'in-app'} onChange={() => edit({ channel: 'in-app' })} /><span><strong>Внутри игры</strong><small>Без разрешения браузера</small></span></label><label><input type="radio" name="reminder-channel" checked={draft.channel === 'system'} onChange={() => edit({ channel: 'system' })} /><span><strong>Системное уведомление</strong><small>Тоже только при открытой игре; при ошибке покажем подсказку внутри</small></span></label></fieldset>
      <label className="parent-consent"><input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} /><span>Я взрослый и согласен включить выбранные напоминания на этом устройстве.</span></label>
      <p className="consent-note">Это подтверждение согласия, не проверка личности и не родительский пароль.</p>
      {draft.channel === 'system' && <div className="system-notification-settings"><Smartphone size={21} /><div><strong>{permission === 'granted' ? 'Разрешение получено' : permission === 'denied' ? 'Запрещено в браузере' : 'Нужно разрешение браузера'}</strong><p>{permission === 'denied' ? 'Изменить его можно в настройках сайта. Автоматически спрашивать ещё раз не будем.' : !workerReady ? 'Откройте production-сборку по HTTPS и дождитесь подготовки PWA. Встроенный предпросмотр может блокировать запрос.' : 'На iPhone или iPad сначала установите веб-приложение на главный экран. Доступность зависит от версии браузера.'}</p><button className="text-button" disabled={!consent || busy || !workerReady || permission === 'denied' || permission === 'granted'} onClick={() => void allow()}><Bell size={15} />Разрешить в браузере</button>{permission === 'granted' && <button className="text-button" disabled={!consent || busy || !workerReady} onClick={async () => { setBusy(true); const result = await showReminderNotification(consent, true, () => live.current.mounted && live.current.consent && live.current.enabled); if (live.current.mounted) { setNotice(result.message); setBusy(false); } }}>Отправить проверку</button>}</div></div>}
    </div>}
    <div className="settings-form-footer"><button className="button button-primary" disabled={busy} onClick={save}>{saved ? 'Настройки сохранены' : 'Сохранить напоминания'}<Check size={17} /></button>{preferences.reminders.enabled && <button className="text-button" onClick={() => { const off = { ...preferences.reminders, enabled: false, consent: false }; onChange({ reminders: off }); setDraft(off); setConsent(false); void closeReminderNotifications(); setNotice('Все напоминания выключены.'); }}><BellOff size={16} />Выключить сразу</button>}</div>
    {notice && <p className="setting-status" role="status">{notice}</p>}
  </section>;
}