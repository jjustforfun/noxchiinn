import alphabet from '../data/alphabet.json';

/** Нормализует регистр и оба кириллических варианта палочки, не подменяя её цифрой. */
export function normalize(text) {
  return String(text).normalize('NFC').toLocaleLowerCase('ru').replace(/\u04cf/g, '\u04c0').replace(/\s+/g, ' ').trim();
}

const signs = alphabet.items.map((item) => normalize(item.chechen)).sort((a, b) => b.length - a.length);

/** Делит слово по буквам чеченского алфавита; кх, къ, кӀ и гласные диграфы не разрываются. */
export function tokenize(text) {
  const input = normalize(text);
  const tokens = [];
  let index = 0;
  while (index < input.length) {
    const sign = signs.find((candidate) => input.startsWith(candidate, index)) || String.fromCodePoint(input.codePointAt(index));
    tokens.push(sign);
    index += sign.length;
  }
  return tokens;
}

/** Пробелы и дефисы уже стоят на месте: ребёнок переставляет только буквы. */
export function separator(token) { return token === ' ' || token === '-'; }

/** Получает переставляемые буквы, сохраняя повторяющиеся как отдельные фишки. */
export function movable(text) { return tokenize(text).filter((token) => !separator(token)); }

/** Вставляет выбранные буквы в шаблон с неизменными пробелами. */
export function assemble(text, tokens) {
  let index = 0;
  return tokenize(text).map((token) => separator(token) ? token : tokens[index++] || '').join('');
}

/** Сравнивает полную сборку, не принимая пропущенные или лишние буквы. */
export function spelled(text, tokens) {
  return tokens.length === movable(text).length && normalize(assemble(text, tokens)) === normalize(text);
}