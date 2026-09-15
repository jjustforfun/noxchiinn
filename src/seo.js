/** Проверяет только явно заданный HTTPS-origin, не выводит домен из недоверенного Host. */
export function siteOrigin(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 250 || /[\s\\]/.test(value)) throw new Error('Invalid SITE_URL');
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/' || url.port || !url.hostname.includes('.') || url.hostname.endsWith('.') || url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname.endsWith('.local') || /^(\d{1,3}\.){3}\d{1,3}$/.test(url.hostname)) throw new Error('SITE_URL must be an explicit public HTTPS origin');
  return url.origin;
}

/** Разрешает индексирование только с согласованным доменом и отдельным подтверждением. */
export function publication(config, { origin = config.origin, indexing = config.indexing } = {}) {
  if (!Array.isArray(config.pages) || !config.pages.length || config.pages.some((page) => !/^[a-z]+$/.test(page.id) || !/^[a-z0-9-]+\.html$/.test(page.file) || page.path !== (page.file === 'index.html' ? '/' : `/${page.file}`))) throw new Error('Public page paths must match reviewed flat HTML files');
  if (new Set(config.pages.map((page) => page.path)).size !== config.pages.length) throw new Error('Duplicate public page');
  if (config.analytics?.enabled) throw new Error('External analytics requires separate approval');
  const site = siteOrigin(origin);
  if (indexing === true && !site) throw new Error('Indexing requires an approved SITE_URL');
  return { origin: site, indexing: indexing === true, robots: indexing === true ? 'index, follow, max-image-preview:large' : 'noindex, nofollow, noarchive' };
}

/** Preview-развёртывание не получает индексацию даже с production-настройкой в репозитории. */
export function publicationEnvironment(config, environment = {}) {
  if (environment.SITE_INDEXING !== undefined && !['0', '1'].includes(environment.SITE_INDEXING)) throw new Error('SITE_INDEXING must be 0 or 1');
  const preview = environment.VERCEL_ENV === 'preview' || ['deploy-preview', 'branch-deploy'].includes(environment.CONTEXT);
  const indexing = preview ? false : environment.SITE_INDEXING !== undefined ? environment.SITE_INDEXING === '1' : config.indexing;
  return publication(config, { origin: environment.SITE_URL !== undefined ? environment.SITE_URL : config.origin, indexing });
}

/** Экранирует текст в HTML-атрибутах и публичных шаблонах. */
export function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]); }

/** Не даёт JSON-LD закрыть script-тег, даже если редактор добавит HTML в текст. */
export function jsonLd(value) { return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029'); }

/** Формирует связанные сущности без вымышленных рейтингов, автора, адреса или перевода интерфейса. */
export function structuredData(config, faq, page, published) {
  const url = published.origin ? `${published.origin}${page.path}` : null;
  const base = published.origin || '';
  const graph = [{ '@type': 'WebApplication', '@id': `${base}/#application`, name: config.name, alternateName: config.alternateName, description: config.description, applicationCategory: 'EducationalApplication', operatingSystem: 'Web', inLanguage: 'ru', isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'RUB' }, ...(published.origin ? { url: `${published.origin}/` } : {}) }];
  if (['home', 'about'].includes(page.id)) {
    graph.push({ '@type': 'Course', '@id': `${base}/#alphabet-course`, name: 'Знакомство с чеченским алфавитом', description: '49 букв чеченского алфавита в восьми визуальных учебных группах. Произношение и материалы ожидают проверки носителем.', inLanguage: 'ru', teaches: 'Написание букв чеченского алфавита', isAccessibleForFree: true, educationalLevel: 'Начальный', provider: { '@type': 'Organization', name: config.name } });
    graph.push({ '@type': 'FAQPage', '@id': `${url || page.path}#faq`, inLanguage: 'ru', mainEntity: faq.map((item) => ({ '@type': 'Question', name: item.question, acceptedAnswer: { '@type': 'Answer', text: item.answer } })) });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}

/** Создаёт один набор метатегов на страницу: canonical/hreflang только для реального origin. */
export function headMarkup(config, faq, page, published, image = { path: '/images/learning-landscape.png', width: 1568, height: 518, type: 'image/png' }) {
  if (!/^\/images\/[a-zA-Z0-9_-]+\.(png|jpe?g|webp|avif)$/.test(image.path) || !Number.isSafeInteger(image.width) || !Number.isSafeInteger(image.height) || image.width < 1 || image.height < 1) throw new Error('Invalid public image metadata');
  const esc = escapeHtml;
  const tags = [`<title>${esc(page.title)}</title>`, `<meta name="description" content="${esc(page.description)}">`, `<meta name="robots" content="${published.robots}">`, `<meta property="og:site_name" content="${esc(config.name)}">`, `<meta property="og:title" content="${esc(page.title)}">`, `<meta property="og:description" content="${esc(page.description)}">`, '<meta property="og:type" content="website">', `<meta property="og:locale" content="${esc(config.locale)}">`, '<meta name="twitter:card" content="summary_large_image">', `<meta name="twitter:title" content="${esc(page.title)}">`, `<meta name="twitter:description" content="${esc(page.description)}">`];
  if (published.origin) {
    const url = `${published.origin}${page.path}`; const imageUrl = `${published.origin}${image.path}`;
    tags.push(`<link rel="canonical" href="${esc(url)}">`, `<link rel="alternate" hreflang="ru" href="${esc(url)}">`, `<link rel="alternate" hreflang="x-default" href="${esc(url)}">`, `<meta property="og:url" content="${esc(url)}">`, `<meta property="og:image" content="${esc(imageUrl)}">`, `<meta property="og:image:type" content="${esc(image.type)}">`, `<meta property="og:image:width" content="${image.width}">`, `<meta property="og:image:height" content="${image.height}">`, '<meta property="og:image:alt" content="Волчонок в зелёном шарфе на фоне кавказских гор, Нохчийн Мотт">', `<meta name="twitter:image" content="${esc(imageUrl)}">`, '<meta name="twitter:image:alt" content="Нохчийн Мотт: язык твоей семьи">');
  }
  tags.push(`<script type="application/ld+json">${jsonLd(structuredData(config, faq, page, published))}</script>`);
  return tags.join('\n');
}

/** Публикует только существующие канонические страницы, без hash-профилей ребёнка. */
export function sitemap(config, published) {
  const entries = published.indexing ? config.pages.map((page) => `<url><loc>${escapeHtml(`${published.origin}${page.path}`)}</loc></url>`).join('') : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>\n`;
}

/** Не блокирует чтение noindex через robots.txt; приватность обеспечивает отсутствие данных в HTML. */
export function robots(published) {
  return `User-agent: *\nAllow: /\nDisallow: /audio/\nDisallow: /release-manifest.json\n${published.indexing ? `Sitemap: ${published.origin}/sitemap.xml\n` : '# Indexing is disabled by meta robots and X-Robots-Tag until publication approval.\n'}`;
}