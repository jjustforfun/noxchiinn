import { useState } from 'react';
import { landscapeFallback, landscapeWebp } from './assets.js';

/** Использует оптимизированный пейзаж, когда он подготовлен, с исходным PNG в запасе. */
export function Landscape() {
  const [failed, setFailed] = useState(false);
  return <picture>
    {landscapeWebp && !failed && <source type="image/webp" srcSet={landscapeWebp} />}
    <img className="hero-landscape" src={landscapeFallback} alt="Дружелюбный волчонок в зелёном шарфе на фоне кавказских гор и чеченской башни" fetchPriority="high" width="1568" height="518" onError={() => setFailed(true)} />
  </picture>;
}