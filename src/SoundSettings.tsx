import { useId, useState } from 'react';
import { Check, Volume2, VolumeX } from 'lucide-react';
import { playEffect, stopEffects } from './effects.js';
import type { Preferences } from './types';

/** Даёт выключить неголосовые эффекты и проверить комфортную громкость. */
export function SoundSettings({ preferences, onChange }: { preferences: Preferences; onChange: (patch: Partial<Preferences>) => void }) {
  const id = useId();
  const [notice, setNotice] = useState('');
  async function preview(kind: string) {
    const ok = await playEffect(kind, preferences);
    setNotice(ok ? 'Короткий сигнал включён. Это музыкальный тон, не произношение.' : 'Звук не удалось включить. Играть можно без него; проверь громкость и разрешения браузера.');
  }
  return <section className="sound-settings" aria-label="Звуки игры"><div className="settings-switch-row"><span className="settings-symbol">{preferences.effects ? <Volume2 size={23} /> : <VolumeX size={23} />}</span><div><h3>Звуки маленьких побед</h3><p>Тихие сигналы успеха и поддержки. Без музыки и речи.</p></div><button className={`settings-switch ${preferences.effects ? 'is-on' : ''}`} type="button" role="switch" aria-checked={preferences.effects} aria-label="Звуковые эффекты" onClick={() => { stopEffects(); onChange({ effects: !preferences.effects }); setNotice(''); }}><span>{preferences.effects && <Check size={12} />}</span></button></div>
    {preferences.effects && <div className="sound-options"><label htmlFor={id}>Громкость<span>{preferences.volume}%</span></label><input id={id} type="range" min="0" max="100" step="5" value={preferences.volume} onChange={(event) => { stopEffects(); onChange({ volume: Number(event.target.value) }); }} /><div className="sound-previews"><button className="text-button" type="button" onClick={() => preview('success')}><Volume2 size={15} />Успех</button><button className="text-button" type="button" onClick={() => preview('retry')}><Volume2 size={15} />Поддержка</button></div></div>}
    {notice && <p className="setting-status" role="status">{notice}</p>}
  </section>;
}