import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import config from '../data/site.json' with { type: 'json' };
import faq from '../data/faq.json' with { type: 'json' };
import { PublicHome, PublicPage, PublicFaq, PublicNotFound } from '../src/PublicContent.js';
import { escapeHtml, headMarkup, jsonLd, publication, publicationEnvironment, robots, siteOrigin, sitemap, structuredData } from '../src/seo.js';
import { documentHeaders, documentRoutes } from '../scripts/route-policy.mjs';
import { sealHtml, verifySealed } from '../scripts/security-policy.mjs';

const approved = { origin: 'https://language.example', indexing: true, robots: 'index, follow, max-image-preview:large' };
const preview = publication(config);

describe('Домен и индексирование', () => {
  it('не придумывает домен по умолчанию', () => expect(preview).toMatchObject({ origin: null, indexing: false }));
  it('не включает индексацию без согласованного origin', () => expect(() => publication(config, { indexing: true })).toThrow());
  it('принимает только HTTPS-origin, убирая конечный slash', () => expect(siteOrigin('https://language.example/')).toBe('https://language.example'));
  it('отклоняет HTTP, credentials, query, hash и путь', () => {
    for (const value of ['http://language.example', 'https://user@language.example', 'https://language.example/path', 'https://language.example/?token=x', 'https://language.example/#part']) expect(() => siteOrigin(value)).toThrow();
  });
  it('не считает локальную среду публичным доменом', () => {
    for (const value of ['https://localhost', 'https://127.0.0.1', 'https://app.local', 'https://app.localhost']) expect(() => siteOrigin(value)).toThrow();
  });
  it('добавление аналитики требует отдельного изменения архитектуры, не тихого включения', () => expect(() => publication({ ...config, analytics: { enabled: true } })).toThrow());
  it('индексация требует точного true, а не строки', () => expect(publication(config, { origin: approved.origin, indexing: 'true' }).indexing).toBe(false));
  it('preview Vercel не индексируется с production-переменными', () => expect(publicationEnvironment(config, { SITE_URL: approved.origin, SITE_INDEXING: '1', VERCEL_ENV: 'preview' }).indexing).toBe(false));
  it('явный SITE_INDEXING=0 перекрывает настройку репозитория', () => expect(publicationEnvironment({ ...config, origin: approved.origin, indexing: true }, { SITE_INDEXING: '0' }).indexing).toBe(false));
  it('не принимает опечатку в переключателе индексации', () => expect(() => publicationEnvironment(config, { SITE_INDEXING: 'true' })).toThrow());
});

describe('Метаданные и структурированные данные', () => {
  it('создаёт один title и description для каждой страницы', () => {
    for (const page of config.pages) {
      const head = headMarkup(config, faq, page, approved);
      expect((head.match(/<title>/g) || []).length).toBe(1); expect((head.match(/name="description"/g) || []).length).toBe(1);
    }
  });
  it('canonical и OG URL ведут на конкретную страницу', () => {
    const page = config.pages.find((item) => item.id === 'privacy'); const head = headMarkup(config, faq, page, approved);
    expect(head).toContain('rel="canonical" href="https://language.example/privacy.html"'); expect(head).toContain('property="og:url" content="https://language.example/privacy.html"');
  });
  it('не создаёт ложные ce/en hreflang без перевода интерфейса', () => {
    const head = headMarkup(config, faq, config.pages[0], approved);
    expect(head).toContain('hreflang="ru"'); expect(head).toContain('hreflang="x-default"'); expect(head).not.toMatch(/hreflang="(?:ce|en)"/);
  });
  it('без домена не выдаёт относительный OG image за рабочее социальное превью', () => {
    const head = headMarkup(config, faq, config.pages[0], preview);
    expect(head).not.toContain('rel="canonical"'); expect(head).not.toContain('property="og:image"'); expect(head).toContain('noindex');
  });
  it('с доменом изображение имеет абсолютный адрес и alt', () => {
    const head = headMarkup(config, faq, config.pages[0], approved);
    expect(head).toContain('https://language.example/images/learning-landscape.png'); expect(head).toContain('og:image:alt'); expect(head).toContain('twitter:image:alt');
  });
  it('FAQ JSON-LD содержит ровно те же ответы, что и видимый контент', () => {
    const graph = structuredData(config, faq, config.pages[0], approved)['@graph'];
    const structured = graph.find((node) => node['@type'] === 'FAQPage');
    expect(structured.mainEntity.map((item) => [item.name, item.acceptedAnswer.text])).toEqual(faq.map((item) => [item.question, item.answer]));
  });
  it('не добавляет несуществующие рейтинги и достижения в schema', () => {
    const encoded = JSON.stringify(structuredData(config, faq, config.pages[0], approved));
    expect(encoded).not.toMatch(/aggregateRating|ratingValue|award|reviewCount|telephone|streetAddress/);
  });
  it('не добавляет FAQPage на страницу без видимого FAQ', () => expect(structuredData(config, faq, config.pages.find((item) => item.id === 'privacy'), approved)['@graph'].some((node) => node['@type'] === 'FAQPage')).toBe(false));
  it('JSON-LD не позволяет закрыть script-тег пользовательским текстом', () => {
    const result = jsonLd({ text: '</script><script>alert(1)</script>' });
    expect(result).not.toContain('</script>'); expect(JSON.parse(result).text).toBe('</script><script>alert(1)</script>');
  });
  it('HTML-экранирование защищает атрибуты метатегов', () => expect(escapeHtml('"<script>&')).toBe('&quot;&lt;script&gt;&amp;'));
});

describe('Публичный prerender без профиля', () => {
  it('FAQ состоит из восьми самодостаточных вопросов', () => expect(faq).toHaveLength(8));
  it('общий React FAQ содержит все вопросы и ответы в HTML', () => {
    const html = renderToStaticMarkup(createElement(PublicFaq));
    for (const item of faq) { expect(html).toContain(escapeHtml(item.question)); expect(html).toContain(escapeHtml(item.answer)); }
  });
  it('главная не требует доступа к window/localStorage и содержит h1', () => {
    const html = renderToStaticMarkup(createElement(PublicHome));
    expect(html).toContain('Чеченский язык для детей'); expect(html).toContain('<h1>'); expect(html).not.toMatch(/"generation"|profile\.name|nohchiin-mott:progress/);
  });
  it('информационные страницы не содержат приложение или доступ к хранилищам', () => {
    for (const page of ['about', 'privacy', 'sources']) {
      const html = renderToStaticMarkup(createElement(PublicPage, { page }));
      expect(html).not.toMatch(/<script|localStorage\.|sessionStorage\.|<input/); expect((html.match(/<h1\b/g) || []).length).toBe(1);
    }
  });
  it('источники содержат реальные справочные ссылки, не заменяют лицензии', () => {
    const html = renderToStaticMarkup(createElement(PublicPage, { page: 'sources' }));
    expect(html).toContain('govzalla.com'); expect(html).toContain('не даёт права копировать чужую озвучку');
  });
  it('статическая 404 не выглядит обычной игровой страницей', () => {
    const html = renderToStaticMarkup(createElement(PublicNotFound));
    expect(html).toContain('Такой страницы пока нет'); expect(html).not.toContain('Начать путешествие');
  });
  it('исходный index уже имеет содержимое без JS и маркеры генерации', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    expect(html).toContain('<!-- PUBLIC-START -->'); expect(html).toContain('<!-- SEO-START -->');
    expect(html).toContain('Как начать учить чеченский алфавит с ребёнком?');
  });
});

describe('Sitemap и строгая CSP для всех страниц', () => {
  it('пустой preview sitemap не содержит выдуманного домена', () => expect(sitemap(config, preview)).not.toContain('<loc>'));
  it('production sitemap содержит только публичные существующие страницы', () => {
    const xml = sitemap(config, approved); expect((xml.match(/<loc>/g) || []).length).toBe(config.pages.length); expect(xml).not.toMatch(/#profile|#parents|offline\.html|404\.html/);
  });
  it('robots разрешает прочитать noindex, но не рекомендует preview sitemap', () => { expect(robots(preview)).toContain('Allow: /'); expect(robots(preview)).not.toContain('Sitemap:'); expect(robots(approved)).toContain('Sitemap: https://language.example/sitemap.xml'); });
  it('каждая страница получает собственный хеш CSP', () => {
    const first = sealHtml('<html><head><meta charset="UTF-8"><style>body{color:green}</style></head><body>one</body></html>');
    const second = sealHtml('<html><head><meta charset="UTF-8"><style>body{color:blue}</style></head><body>two</body></html>');
    const headers = documentHeaders({ 'index.html': first.policy, 'privacy.html': second.policy });
    expect(headers['index.html']['Content-Security-Policy']).not.toBe(headers['privacy.html']['Content-Security-Policy']);
    expect(verifySealed(first.html, headers['index.html']['Content-Security-Policy'])).toBe(true);
    expect(verifySealed(second.html, headers['privacy.html']['Content-Security-Policy'])).toBe(true);
  });
  it('маршруты точные, не превращают любой путь в индексируемую главную', () => {
    const routes = documentRoutes(documentHeaders({ 'index.html': 'test', 'about.html': 'test' }));
    expect(new RegExp(routes[0].src).test('/missing')).toBe(false);
    expect(new RegExp(routes[1].src).test('/about.html')).toBe(true);
    expect(new RegExp(routes[1].src).test('/about.html/evil')).toBe(false);
  });
  it('не принимает traversal в пути HTML для заголовков', () => expect(() => documentHeaders({ '../private.html': 'test' })).toThrow());
});