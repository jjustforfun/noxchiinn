import { readFile, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { gzipSync } from 'node:zlib';
import { integrity, verifySealed } from './security-policy.mjs';

const root = resolve(import.meta.dirname, '..');

/** Проверяет готовый выпуск без браузера: SRI, CSP всех страниц, FAQ, ссылки и SEO-гейты. */
export async function verifyRelease(directory = resolve(root, 'dist'), output = resolve(root, 'docs/release-checks.json')) {
  const config = JSON.parse(await readFile(resolve(root, 'data/site.json'), 'utf8'));
  const faq = JSON.parse(await readFile(resolve(root, 'data/faq.json'), 'utf8'));
  const release = JSON.parse(await readFile(resolve(directory, 'release-manifest.json'), 'utf8'));
  const security = JSON.parse(await readFile(resolve(root, 'docs/release-security.json'), 'utf8'));
  const seo = JSON.parse(await readFile(resolve(root, 'docs/seo-results.json'), 'utf8'));
  const checks = [];
  function assert(name, condition) { checks.push({ name, passed: Boolean(condition) }); }
  assert('Same release identifier', release.id === security.release);
  const resources = new Map(release.assets.map((asset) => [asset.url, asset]));
  for (const asset of release.assets) {
    const file = resolve(directory, asset.url === '/' ? 'index.html' : asset.url.slice(1));
    if (!file.startsWith(`${directory}/`)) throw new Error('Invalid release path');
    const bytes = await readFile(file);
    assert(`SRI ${asset.url}`, bytes.length === asset.bytes && integrity(bytes) === asset.integrity);
  }
  const scripts = [];
  for (const page of config.pages) {
    const html = await readFile(resolve(directory, page.file), 'utf8');
    assert(`CSP ${page.path}`, verifySealed(html, security.policies[page.file] || ''));
    assert(`Headers ${page.path}`, Boolean(security.documentHeaders?.[page.file]?.['Content-Security-Policy']));
    assert(`Title and description ${page.path}`, (html.match(/<title>/g) || []).length === 1 && html.includes('<meta name="description"'));
    assert(`One h1 ${page.path}`, (html.match(/<h1\b/g) || []).length === 1);
    assert(`Language ${page.path}`, html.includes('<html lang="ru"'));
    assert(`No private state ${page.path}`, !/(?:localStorage|sessionStorage)\s*(?:\.|\[)|nohchiin-mott:progress|"generation"\s*:/.test(html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '')));
    if (page.id !== 'home') assert(`No application JavaScript ${page.path}`, !/<script\b(?![^>]*type="application\/ld\+json")/i.test(html));
    if (['home', 'about'].includes(page.id)) {
      const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
      const faqPage = blocks.flatMap((block) => block['@graph'] || [block]).find((node) => node['@type'] === 'FAQPage');
      assert(`FAQ JSON-LD ${page.path}`, faqPage?.mainEntity?.length === faq.length);
      assert(`Visible FAQ ${page.path}`, faq.every((item) => html.includes(item.question)));
    }
    if (seo.indexing) {
      assert(`Canonical ${page.path}`, html.includes(`rel="canonical" href="${seo.origin}${page.path}"`));
      assert(`Indexing enabled ${page.path}`, !/<meta name="robots" content="noindex/.test(html));
    } else assert(`Preview noindex ${page.path}`, html.includes('name="robots" content="noindex'));
    for (const match of html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '').matchAll(/(?:href|src)="(\/[^"#?]*)(?:[#?][^"]*)?"/g)) assert(`Local URL ${match[1]}`, resources.has(match[1]));
    if (page.id === 'home') for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) if (!match[1].includes('application/ld+json')) scripts.push(match[2]);
  }
  const jsGzipBytes = gzipSync(scripts.join('\n')).length;
  assert('Initial JS gzip below 200KB', jsGzipBytes < 200000);
  assert('Analytics remains disabled', seo.analytics === false && config.analytics.enabled === false);
  assert('404 remains noindex', (await readFile(resolve(directory, '404.html'), 'utf8')).includes('name="robots" content="noindex'));
  const sitemap = await readFile(resolve(directory, 'sitemap.xml'), 'utf8');
  assert('Sitemap contains only approved pages', (sitemap.match(/<loc>/g) || []).length === (seo.indexing ? config.pages.length : 0));
  if (seo.indexing) {
    for (const name of ['icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'images/learning-landscape.webp', 'images/share.jpg']) {
      try { assert(`Publication asset ${name}`, (await stat(resolve(directory, name))).size > 0); } catch { assert(`Publication asset ${name}`, false); }
    }
  }
  const report = { generatedAt: new Date().toISOString(), release: release.id, passed: checks.every((check) => check.passed), jsGzipBytes, checks, browserVerified: false, lighthouseVerified: false };
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`${checks.filter((check) => check.passed).length}/${checks.length} artifact checks passed. Initial JavaScript: ${jsGzipBytes} bytes gzip.`);
  if (!report.passed) throw new Error('Release checks failed; inspect docs/release-checks.json');
  return report;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try { await verifyRelease(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}