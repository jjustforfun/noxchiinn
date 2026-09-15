import { useState } from 'react';
import { Check, CheckCheck, Download, Headphones, LoaderCircle, RefreshCw, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { applyUpdate, checkUpdate, prepareOffline } from './pwa.js';
import { courses, lessons } from './catalog.js';

export type PwaStatus = { state: string; message: string; updateAvailable: boolean; audioReady: number; audioTotal: number; lastChecked: number | null };

/** Показывает подтверждённую готовность к дороге и запрашивает установку только по нажатию. */
export function PwaPanel({ status, installed, canInstall, onInstall }: { status: PwaStatus; installed: boolean; canInstall: boolean; onInstall: () => void }) {
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState('');
  async function run(action: () => Promise<unknown>) {
    setWorking(true); setNotice('');
    try { await action(); }
    catch { setNotice('Не получилось выполнить действие. Можно попробовать ещё раз позже.'); }
    finally { setWorking(false); }
  }
  return <div className="centered-modal">
    <div className="modal-feature-icon install-feature"><Smartphone size={48} /></div>
    <h2>{installed ? 'Родной язык уже рядом' : 'Возьмём родной язык с собой'}</h2>
    <p>{installed ? 'Открывай Нохчийн Мотт с главного экрана устройства.' : 'Без магазина приложений и регистрации. Добавь игру на главный экран и учись в дороге.'}</p>
    <div className={`offline-readiness ${status.state === 'ready' ? 'offline-verified' : ''}`} role="status">
      <span>{status.state === 'ready' ? <CheckCheck size={23} /> : status.state === 'loading' ? <LoaderCircle className="spinner" size={23} /> : <WifiOff size={23} />}</span>
      <div><strong>{status.state === 'ready' ? 'Можно учиться без интернета' : status.state === 'loading' ? 'Готовим всё для дороги' : 'Подготовка ещё не подтверждена'}</strong><p>{status.message}</p></div>
    </div>
    <div className="offline-details"><span><Check size={17} />{courses.length} тем и {lessons.length} урока, все визуальные игры</span><span><ShieldCheck size={17} />Прогресс только на устройстве</span><span><Headphones size={17} />{status.audioTotal ? `Записей сохранено: ${status.audioReady} из ${status.audioTotal}` : 'Голосовые записи пока готовятся'}</span></div>
    {status.state !== 'development' && status.state !== 'unsupported' && <div className="pwa-controls"><button className="text-button" disabled={working || status.state === 'loading'} onClick={() => run(prepareOffline)}><Download size={16} />Проверить файлы</button><button className="text-button" disabled={working} onClick={() => run(checkUpdate)}><RefreshCw size={16} />Проверить обновление</button></div>}
    {working && <p className="pwa-working" role="status"><LoaderCircle className="spinner" size={15} />Подождём немного...</p>}
    {status.updateAvailable && <button className="button button-secondary full-width" disabled={working} onClick={() => run(applyUpdate)}><RefreshCw size={18} />Применить обновление</button>}
    {notice && <p className="audio-notice" role="status">{notice}</p>}
    {canInstall && !installed ? <button className="button button-primary full-width" onClick={onInstall}><Download size={19} />Установить приложение</button> : !installed && <div className="install-instructions"><h3>На iPhone или iPad</h3><p>Открой сайт в Safari. Нажми «Поделиться», затем «На экран Домой».</p><h3>На Android или компьютере</h3><p>Открой меню Chrome или Edge и выбери «Установить приложение», если этот пункт доступен.</p></div>}
    <p className="modal-note">Кэш может быть удалён браузером при нехватке места. Перед поездкой открой приложение и проверь готовность. Настоящий офлайн-прогон на устройстве всё равно необходим.</p>
  </div>;
}