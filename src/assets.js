import vocabulary from '../public/images/vocabulary.svg?url&no-inline';

export { vocabulary };

/** @type {Record<string, string>} */
const images = import.meta.glob('../public/images/learning-landscape.{png,webp}', { eager: true, query: '?url&no-inline', import: 'default' });

// WebP появится после одноразовой подготовки ресурсов; исходный PNG остаётся запасным.
export const landscapeFallback = images['../public/images/learning-landscape.png'];
export const landscapeWebp = images['../public/images/learning-landscape.webp'] || null;
export const landscape = landscapeWebp || landscapeFallback;