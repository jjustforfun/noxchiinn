type ArtProps = { className?: string; variant?: string };

/** Рисует волчонка для логотипа и локального аватара. */
export function Wolf({ className = '', variant = 'wolf' }: ArtProps) {
  return (
    <svg className={className} width="100" height="100" viewBox="0 0 100 100" fill="none" aria-hidden="true">
      <path d="M20 43 13 10Q31 9 40 31M62 30Q77 8 88 11L81 48" fill={variant === 'sun' ? '#b9844c' : '#667777'} />
      <path d="m22 32-3-14 14 15M70 33l11-15-2 17" fill="#d4b4a6" />
      <path d="M15 54C15 27 37 24 51 25c23 0 38 14 37 31L96 62 85 69l-2 9c-8 11-21 16-33 16-17 0-29-7-36-18L5 66l10-5Z" fill={variant === 'sun' ? '#d7a362' : '#82938f'} />
      <path d="M17 59c11 4 13-14 25-12l9 15 10-15c13-3 15 15 24 12 4 19-15 30-34 30-22 0-39-14-34-30Z" fill="#fff4df" />
      <ellipse cx="34" cy="49" rx="7" ry="9" fill="#fffdf5" />
      <ellipse cx="68" cy="49" rx="7" ry="9" fill="#fffdf5" />
      <ellipse cx="35" cy="51" rx="4" ry="5.5" fill="#2e3b37" />
      <ellipse cx="67" cy="51" rx="4" ry="5.5" fill="#2e3b37" />
      <circle cx="36" cy="49" r="1.6" fill="white" /><circle cx="68" cy="49" r="1.6" fill="white" />
      <path d="M43 65c0-5 17-5 17 0 0 4-6 8-8 8s-9-4-9-8Z" fill="#37453f" />
      <path d="M42 77q9 9 18 0" stroke="#37453f" strokeWidth="2.8" strokeLinecap="round" />
      <path d="m29 90 22 8 23-8-6-6q-17 7-33 0Z" fill="#22936d" />
      <path d="m58 93 8 7 8-11" fill="#19765a" />
    </svg>
  );
}

/** Рисует лёгкие иллюстрации тем без внешних изображений. */
export function TopicArt({ variant = 'alphabet', className = '' }: ArtProps) {
  return (
    <svg viewBox="0 0 220 130" className={`topic-art ${className}`} fill="none" aria-hidden="true">
      {variant === 'alphabet' && <>
        <ellipse cx="106" cy="115" rx="68" ry="8" fill="#c0d9bd" opacity=".35" />
        <g transform="rotate(-12 90 68)">
          <rect x="48" y="21" width="77" height="92" rx="13" fill="#d4a74d" />
          <rect x="48" y="16" width="77" height="89" rx="13" fill="#f9cf69" />
          <path d="M59 19v82" stroke="#ffe69c" strokeWidth="3" />
          <text x="86" y="81" textAnchor="middle" fill="#fffdf0" fontSize="65" fontFamily="Nunito Variable, sans-serif" fontWeight="900">А</text>
        </g>
        <g transform="rotate(11 144 87)">
          <rect x="118" y="63" width="54" height="56" rx="11" fill="#479578" />
          <rect x="118" y="58" width="54" height="55" rx="11" fill="#73b796" />
          <text x="145" y="100" textAnchor="middle" fill="#f9ffed" fontSize="49" fontFamily="Nunito Variable, sans-serif" fontWeight="900">а</text>
        </g>
        <path d="m154 29 3 7 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#e9bd5b" />
        <circle cx="34" cy="69" r="4" fill="#b3cfa7" />
      </>}
      {variant === 'numbers' && <>
        <ellipse cx="112" cy="116" rx="69" ry="7" fill="#b9a3d1" opacity=".16" />
        <g transform="rotate(-12 62 73)">
          <rect x="34" y="41" width="57" height="69" rx="15" fill="#d7af52" />
          <rect x="34" y="36" width="57" height="69" rx="15" fill="#f4d483" />
          <text x="62" y="89" textAnchor="middle" fontSize="54" fontFamily="Nunito Variable, sans-serif" fontWeight="900" fill="#fffbea">1</text>
        </g>
        <g transform="rotate(7 121 68)">
          <rect x="89" y="19" width="63" height="85" rx="15" fill="#a79ac9" />
          <rect x="89" y="14" width="63" height="85" rx="15" fill="#c1b4df" />
          <text x="121" y="80" textAnchor="middle" fontSize="63" fontFamily="Nunito Variable, sans-serif" fontWeight="900" fill="#fffaf7">2</text>
        </g>
        <g transform="rotate(12 169 88)">
          <rect x="143" y="65" width="48" height="51" rx="12" fill="#9daed2" />
          <rect x="143" y="61" width="48" height="51" rx="12" fill="#b2c5e4" />
          <text x="167" y="101" textAnchor="middle" fontSize="43" fontFamily="Nunito Variable, sans-serif" fontWeight="900" fill="#fffdfa">3</text>
        </g>
        <circle cx="179" cy="31" r="5" fill="#d9cae9" />
      </>}
      {variant === 'colors' && <>
        <ellipse cx="106" cy="116" rx="64" ry="7" fill="#dabaa1" opacity=".2" />
        <path d="M52 99C24 64 61 20 99 17c38-4 75 22 74 45-1 20-25 8-32 21-9 18 12 23-2 31-26 14-66 6-87-15Z" fill="#dab99b" />
        <path d="M51 93C28 62 61 16 99 13c38-4 75 22 74 45-1 20-25 8-32 21-9 18 12 23-2 31-26 14-66 6-88-17Z" fill="#efd8bf" />
        <ellipse cx="67" cy="72" rx="13" ry="14" transform="rotate(-20 67 72)" fill="#e99b83" />
        <ellipse cx="82" cy="37" rx="12" ry="12" fill="#ecc862" />
        <ellipse cx="121" cy="34" rx="12" ry="11" fill="#99bda6" />
        <ellipse cx="151" cy="54" rx="11" ry="10" fill="#9abed0" />
        <ellipse cx="91" cy="102" rx="12" ry="10" fill="#b6a2cc" />
        <ellipse cx="111" cy="68" rx="13" ry="12" fill="#fcf0e3" />
        <g transform="rotate(35 155 91)"><rect x="151" y="44" width="10" height="80" rx="5" fill="#9aafbd" /><path d="M149 53V35q7-15 14 0v18" fill="#6d8692" /><path d="M151 57h10v13h-10" fill="#dddde0" /></g>
      </>}
      {variant === 'words' && <>
        <ellipse cx="111" cy="116" rx="65" ry="7" fill="#adc6d4" opacity=".2" />
        <g transform="rotate(-8 89 58)"><path d="M46 21h73q13 0 13 13v37q0 13-13 13H76L58 99V84H46q-13 0-13-13V34q0-13 13-13Z" fill="#a69bbc" /><path d="M46 16h73q13 0 13 13v37q0 13-13 13H76L58 94V79H46q-13 0-13-13V29q0-13 13-13Z" fill="#c7bbdc" /><path d="M58 40h48M58 53h34" stroke="#f9f6ff" strokeWidth="7" strokeLinecap="round" /></g>
        <g transform="rotate(8 139 86)"><path d="M106 59h59q12 0 12 12v26q0 12-12 12h-6v14l-17-14h-36q-12 0-12-12V71q0-12 12-12Z" fill="#80aebe" /><path d="M106 54h59q12 0 12 12v26q0 12-12 12h-6v14l-17-14h-36q-12 0-12-12V66q0-12 12-12Z" fill="#a6cedb" /><circle cx="117" cy="79" r="5" fill="#f5fbfd" /><circle cx="135" cy="79" r="5" fill="#f5fbfd" /><circle cx="153" cy="79" r="5" fill="#f5fbfd" /></g>
        <path d="m166 19 3 6 7 3-7 3-3 7-3-7-7-3 7-3Z" fill="#d1be77" />
      </>}
      {variant === 'family' && <><path d="m43 67 66-48 68 48v46H43Z" fill="#e7b8a1" /><path d="m34 69 75-56 77 56" stroke="#bd8e76" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" /><rect x="92" y="74" width="35" height="39" rx="8" fill="#fff1d9" /><circle cx="73" cy="61" r="10" fill="#fff1d9" /></>}
      {variant === 'animals' && <g transform="translate(52 4) scale(1.1)"><Wolf /></g>}
      {variant === 'food' && <><path d="M109 47c-52-42-85 37-49 63 15 11 36 5 49 2 17 5 36 9 53-10 25-36-2-83-53-55Z" fill="#d99482" /><path d="M111 49q-6-22 2-32" stroke="#967450" strokeWidth="7" strokeLinecap="round" /><path d="M116 32q33 3 38-21-32-8-38 21Z" fill="#86ad85" /></>}
      {variant === 'nature' && <><path d="m23 114 61-93 35 56 26-36 54 73Z" fill="#a2c8b9" /><path d="m84 21-23 34 22-8 19 4Z" fill="#eff4e9" /><path d="m111 114 36-55 40 55Z" fill="#72a38e" /><circle cx="159" cy="22" r="13" fill="#eccc7d" /></>}
      {variant === 'body' && <><path d="M59 126q2-37 49-37t49 37" fill="#a5bea6" /><circle cx="108" cy="55" r="35" fill="#e9c29e" /><path d="M73 47q-2-40 33-35 37-5 37 35l-20-22-33 14Z" fill="#aa8a63" /><circle cx="96" cy="55" r="3.7" fill="#665e4c" /><circle cx="120" cy="55" r="3.7" fill="#665e4c" /><path d="M98 70q10 9 20 0" stroke="#aa7860" strokeWidth="3" strokeLinecap="round" /><path d="m154 47 5 10 10 5-10 5-5 10-5-10-10-5 10-5Z" fill="#dbc178" /></>}
    </svg>
  );
}

/** Рисует цель ежедневной тренировки. */
export function TargetArt({ className = '' }: ArtProps) {
  return <svg viewBox="0 0 150 140" fill="none" className={className} aria-hidden="true">
    <ellipse cx="72" cy="122" rx="42" ry="7" fill="#dbd2e9" />
    <ellipse cx="72" cy="76" rx="45" ry="46" fill="#a896c8" />
    <ellipse cx="67" cy="72" rx="45" ry="46" fill="#c2b1de" />
    <ellipse cx="67" cy="72" rx="33" ry="34" fill="#f9f6fd" />
    <ellipse cx="67" cy="72" rx="22" ry="23" fill="#c2b1de" />
    <ellipse cx="67" cy="72" rx="10" ry="11" fill="#f9f6fd" />
    <path d="m70 72 47-47" stroke="#99777c" strokeWidth="6" strokeLinecap="round" />
    <path d="m112 31-3-15 16-11 1 14 13 1-12 16Z" fill="#e9ab92" />
    <path d="m70 72 10-3-7-7Z" fill="#99777c" />
    <path d="m30 23 2 6 6 2-6 2-2 6-2-6-6-2 6-2Z" fill="#d9b873" />
  </svg>;
}