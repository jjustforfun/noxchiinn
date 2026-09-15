import { readFile, writeFile, access, mkdir, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PublicHome, PublicPage, PublicNotFound } from '../src/PublicContent.js';
import { headMarkup, publicationEnvironment, robots, sitemap } from '../src/seo.js';

const root = resolve(import.meta.dirname, '..');
const readJson = async (name) => JSON.parse(await readFile(resolve(root, 'data', name), 'utf8'));
async function exists(path) { try { await access(path); return true; } catch { return false; } }

/** Создаёт публичный HTML из одних данных с React, до финальных CSP/SRI-хешей. */
export async function prerender(directory = resolve(root, 'dist'), environment = process.env) {
  const config = await readJson('site.json'); const faq = await readJson('faq.json');
  const published = publicationEnvironment(config, environment);
  const original = await readFile(resolve(directory, 'index.html'), 'utf8');
  if (original.includes('name="nohchiin-security"')) throw new Error('Prerender must run before scripts/harden.mjs on a fresh build');
  if (!original.includes('<!-- PUBLIC-START -->') || !original.includes('<!-- PUBLIC-END -->')) throw new Error('Missing public root markers');
  const files = await readdir(directory);
  const hashedPng = files.find((name) => /^learning-landscape-[a-zA-Z0-9_-]+\.png$/.test(name));
  const hashedWebp = files.find((name) => /^learning-landscape-[a-zA-Z0-9_-]+\.webp$/.test(name));
  const webp = hashedWebp ? `/${hashedWebp}` : await exists(resolve(directory, 'images/learning-landscape.webp')) ? '/images/learning-landscape.webp' : null;
  const image = hashedPng ? `/${hashedPng}` : '/images/learning-landscape.png';
  const share = await exists(resolve(directory, 'images/share.jpg')) ? { path: '/images/share.jpg', width: 1200, height: 630, type: 'image/jpeg' } : { path: '/images/learning-landscape.png', width: 1568, height: 518, type: 'image/png' };
  const sourceCss = await readFile(resolve(root, 'public/site.css'), 'utf8');
  const fontCss = [...original.matchAll(/@font-face\s*\{[^}]+\}/g)].map((match) => match[0]).join('\n');
  const fonts = [...original.matchAll(/<link\b[^>]*\bas="font"[^>]*>/g)].map((match) => match[0]).join('\n');
  const outputs = [];
  for (const page of config.pages) {
    const head = headMarkup(config, faq, page, published, share);
    const rendered = renderToStaticMarkup(createElement(page.id === 'home' ? PublicHome : PublicPage, { page: page.id, image, webp }));
    let html;
    if (page.id === 'home') {
      html = original.replace(/<!-- SEO-START -->[\s\S]*?<!-- SEO-END -->/, () => `<!-- SEO-START -->\n${head}\n<!-- SEO-END -->`).replace(/<!-- PUBLIC-START -->[\s\S]*?<!-- PUBLIC-END -->/, () => `<!-- PUBLIC-START -->${rendered}<!-- PUBLIC-END -->`);
      html = html.replace(/<noscript>[\s\S]*?<\/noscript>/g, '<noscript><p class="public-noscript">Для игровых заданий включите JavaScript. Публичные страницы и ответы на вопросы доступны без него.</p></noscript>');
    } else {
      html = `<!doctype html>\n<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="application-name" content="Нохчийн Мотт"><meta name="theme-color" content="#278454"><meta name="referrer" content="no-referrer">${head}<link rel="icon" href="/icons/icon.svg" type="image/svg+xml"><link rel="manifest" href="/manifest.webmanifest">${fonts}<style>html,body{margin:0;background:#fafbf7} ${fontCss}\n${sourceCss}</style></head><body>${rendered}</body></html>\n`;
    }
    if (/nohchiin-mott:progress|"generation"\s*:/.test(rendered)) throw new Error('Private state in public prerender');
    await writeFile(resolve(directory, page.file), html);
    outputs.push({ path: page.path, file: page.file, language: config.language, hasJavaScript: page.id === 'home', indexable: published.indexing });
  }
  await writeFile(resolve(directory, 'robots.txt'), robots(published));
  await writeFile(resolve(directory, 'sitemap.xml'), sitemap(config, published));
  const missing = renderToStaticMarkup(createElement(PublicNotFound));
  await writeFile(resolve(directory, '404.html'), `<!doctype html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>Страница не найдена | Нохчийн Мотт</title><style>html,body{margin:0;background:#fafbf7}${fontCss}\n${sourceCss}</style></head><body>${missing}</body></html>`);
  // Runtime не подключает аналитику: этот файл описывает только публичные URL и режим индексации.
  const report = { version: 1, origin: published.origin, indexing: published.indexing, analytics: false, generatedAt: new Date().toISOString(), pages: outputs, domainRequired: !published.origin };
  await mkdir(resolve(root, 'docs'), { recursive: true });
  await writeFile(resolve(root, 'docs/seo-results.json'), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Prerendered ${outputs.length} public pages. Indexing: ${published.indexing ? 'enabled' : 'disabled pending approval'}. No profile data or analytics included.`);
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await prerender(); } catch (error) { console.error('SEO preparation failed:', error.message); process.exitCode = 1; }
}