import { createElement as h } from 'react';
import site from '../data/site.json' with { type: 'json' };
import copy from '../data/public-content.json' with { type: 'json' };
import faq from '../data/faq.json' with { type: 'json' };
import sources from './source-data.js';

/** Общий FAQ для живого интерфейса, публичных страниц и статического prerender. */
export function PublicFaq({ compact = false, id = 'faq' } = {}) {
  return h('section', { className: `public-faq ${compact ? 'public-faq-compact' : ''}`, id, 'aria-labelledby': `${id}-title` },
    h('div', { className: 'public-section-heading' }, h('span', { className: 'public-eyebrow' }, 'ДЛЯ ДЕТЕЙ И ИХ БЛИЗКИХ'), h('h2', { id: `${id}-title` }, copy.faqTitle), h('p', null, copy.faqIntro)),
    h('div', { className: 'public-faq-list' }, faq.map((item, index) => h('details', { key: item.id, className: 'public-faq-item', open: index === 0 }, h('summary', null, item.question), h('p', null, item.answer)))),
    h('div', { className: 'public-faq-links' }, h('a', { href: '/about.html' }, 'О проекте'), h('a', { href: '/sources.html' }, 'Источники и произношение'), h('a', { href: '/privacy.html' }, 'Данные и приватность')),
  );
}

/** Публичная шапка не содержит профиль, серию, имя или статистику ребёнка. */
export function PublicHeader({ page = 'home' } = {}) {
  return h('header', { className: 'public-header' },
    h('a', { href: '/', className: 'public-logo', 'aria-label': 'Нохчийн Мотт, к игре' }, h('img', { src: '/icons/icon.svg', alt: '', width: 43, height: 43 }), h('span', null, site.name, h('i', null, '.'))),
    h('nav', { 'aria-label': 'О проекте и игре' }, site.pages.filter((item) => item.id !== 'home').map((item) => h('a', { key: item.id, href: item.path, 'aria-current': page === item.id ? 'page' : undefined }, item.label)), h('a', { href: '/#learn', className: 'public-button public-button-small' }, 'К игре')),
  );
}

/** Выводит фактические источники, не называя их записи свободно лицензированными. */
function SourceList() {
  return h('section', { className: 'public-sources', 'aria-labelledby': 'source-list-title' }, h('h2', { id: 'source-list-title' }, 'Материалы, с которыми мы сверяемся'), h('ol', null, Object.entries(sources).map(([id, source]) => h('li', { key: id }, h('a', { href: source.url, target: '_blank', rel: 'noopener noreferrer' }, source.title, h('span', { 'aria-hidden': true }, ' ↗')), h('p', null, source.note)))));
}

/**
 * Публичные страницы работают без браузерных API, сохранений и исполнения JavaScript.
 * @param {{page?: string, image?: string, webp?: string | null}} [options] Публичный маршрут и подготовленные медиа.
 */
export function PublicPage({ page = 'about', image = '/images/learning-landscape.png', webp = null } = {}) {
  const definition = site.pages.find((item) => item.id === page) || site.pages[1];
  const hero = page === 'home' || page === 'about';
  const sections = page === 'privacy' ? copy.privacy : page === 'sources' ? copy.sources : copy.about;
  return h('div', { className: 'public-site' },
    h('a', { className: 'public-skip', href: '#public-main' }, 'Перейти к содержимому'),
    h(PublicHeader, { page }),
    h('main', { id: 'public-main' },
      hero ? h('section', { className: 'public-hero', 'aria-labelledby': 'public-title' },
        h('picture', null, webp && h('source', { type: 'image/webp', srcSet: webp }), h('img', { className: 'public-hero-image', src: image, alt: 'Волчонок в зелёном шарфе на фоне кавказских гор и чеченской башни', width: 1568, height: 518, fetchPriority: 'high' })),
        h('div', { className: 'public-hero-inner' }, h('span', { className: 'public-eyebrow' }, copy.hero.eyebrow), h('h1', { id: 'public-title', lang: 'ce' }, copy.hero.title), h('h2', null, copy.hero.headline), h('p', null, copy.hero.description), h('a', { href: '/#learn', className: 'public-button' }, 'Вернуться к игре', h('span', { 'aria-hidden': true }, ' →'))),
      ) : h('div', { className: 'public-article-heading' }, h('p', { className: 'public-wordmark', lang: 'ce' }, site.name), h('h1', { id: 'public-title' }, definition.label), h('p', null, definition.description)),
      h('div', { className: 'public-article' },
        hero && h('section', { className: 'public-intro' }, h('span', { className: 'public-eyebrow' }, 'МАЛЕНЬКИЕ ШАГИ К РОДНОМУ ЯЗЫКУ'), h('h2', null, copy.intro.heading), h('p', null, copy.intro.text)),
        h('div', { className: 'public-prose' }, sections.map((section) => h('section', { key: section.heading }, h('h2', null, section.heading), h('p', null, section.text)))),
        hero && h('section', { className: 'public-start', id: 'start' }, h('div', null, h('h2', null, 'Начнём с одного открытия?'), h('p', null, 'Откройте игру, выберите алфавит и побудьте рядом первые пять минут.')), h('a', { href: '/#learn', className: 'public-button' }, 'К карте уроков', h('span', { 'aria-hidden': true }, ' →'))),
        page === 'sources' && h(SourceList),
        hero && h(PublicFaq),
        h('p', { className: 'public-status' }, copy.status),
      ),
    ),
    h('footer', { className: 'public-footer' }, h('p', null, copy.footer), h('nav', { 'aria-label': 'Дополнительные страницы' }, site.pages.map((item) => h('a', { key: item.id, href: item.path }, item.label)))),
  );
}

/**
 * Нейтральная главная для crawler и первого HTML-ответа: никаких сохранений и персональных полей.
 * @param {{image?: string, webp?: string | null}} [options] Публичные ресурсы изображения.
 */
export function PublicHome({ image = '/images/learning-landscape.png', webp = null } = {}) {
  return h('div', { className: 'public-home-snapshot' },
    h('aside', { className: 'sidebar' }, h('a', { className: 'brand', href: '/' }, h('img', { className: 'brand-wolf', src: '/icons/icon.svg', alt: '', width: 49, height: 57 }), h('span', null, 'Нохчийн', h('span', null, 'Мотт', h('span', { className: 'brand-dot' }, '.')))), h('p', { className: 'brand-caption' }, 'Родной язык. Близкие корни.'), h('nav', { className: 'side-nav', 'aria-label': 'Основные страницы' }, h('a', { className: 'nav-item active', href: '/#learn' }, 'Учиться'), h('a', { className: 'nav-item', href: '/about.html' }, 'О проекте'), h('a', { className: 'nav-item', href: '/sources.html' }, 'Источники'), h('a', { className: 'nav-item', href: '/privacy.html' }, 'Данные и приватность'))),
    h('div', { className: 'main-shell' }, h('header', { className: 'topbar' }, h('span', { className: 'topbar-message' }, 'Маленькие шаги. Большие открытия.')), h('main', { className: 'main-content', id: 'main-content' },
      h('div', { className: 'page-heading' }, h('div', null, h('h1', null, 'Чеченский язык для детей'), h('p', null, 'Сегодня отличный день для маленького открытия.'))),
      h('section', { className: 'welcome-hero', 'aria-labelledby': 'static-brand' }, h('picture', null, webp && h('source', { type: 'image/webp', srcSet: webp }), h('img', { className: 'hero-landscape', src: image, alt: 'Дружелюбный волчонок в зелёном шарфе на фоне кавказских гор', fetchPriority: 'high', width: 1568, height: 518 })), h('div', { className: 'hero-copy' }, h('span', { className: 'hero-eyebrow' }, 'УЧИМ ЧЕЧЕНСКИЙ ВМЕСТЕ'), h('h2', { id: 'static-brand' }, h('span', { lang: 'ce' }, 'Нохчийн мотт.'), h('br'), 'Язык твоей семьи.'), h('p', null, 'Играй, открывай новое и становись ближе к своим корням.'), h('a', { href: '/about.html#start', className: 'button button-primary hero-cta' }, 'Как начать учиться'))),
      h('section', { className: 'public-intro' }, h('h2', null, copy.intro.heading), h('p', null, copy.intro.text)),
      h(PublicFaq, { compact: true }),
      h('footer', { className: 'main-footer' }, h('span', null, copy.footer), h('a', { href: '/privacy.html' }, 'Данные и приватность')),
    )),
  );
}

/** Понятная статическая 404-страница вместо выдачи игрового экрана по любому адресу. */
export function PublicNotFound() {
  return h('div', { className: 'public-site' }, h(PublicHeader), h('main', { className: 'public-article public-not-found', id: 'public-main' }, h('img', { src: '/icons/icon.svg', alt: 'Волчонок-помощник', width: 100, height: 100 }), h('p', { className: 'public-eyebrow' }, 'ЭТА ТРОПИНКА НЕ НАШЛАСЬ'), h('h1', null, 'Вернёмся к знакомым открытиям?'), h('p', null, 'Такой страницы пока нет. Игровой прогресс на устройстве от этого не меняется.'), h('a', { href: '/', className: 'public-button' }, 'К Нохчийн Мотт')));
}