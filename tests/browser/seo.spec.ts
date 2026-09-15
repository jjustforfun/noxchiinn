import { test, expect } from '@playwright/test';

const pages = ['/about.html', '/privacy.html', '/sources.html'];

test('публичная главная содержит ответы и бренд до выполнения JavaScript', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('Чеченский язык для детей');
  expect(html).toContain('Как начать учить чеченский алфавит с ребёнком?');
  expect(html).toContain('FAQPage'); expect(html).toContain('Course');
  expect(html).toContain('<!-- PUBLIC-START -->');
});

test('публичные страницы читаются без JavaScript и не запускают игровой профиль', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const path of pages) {
    const response = await page.goto(`http://127.0.0.1:4173${path}`);
    expect(response?.status()).toBe(200);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('.public-prose')).toBeVisible();
    expect(await page.locator('script:not([type="application/ld+json"])').count()).toBe(0);
  }
  await context.close();
});

test('каждая публичная страница получает строгую собственную CSP и метаданные', async ({ request }) => {
  const titles = new Set();
  for (const path of ['/', ...pages]) {
    const response = await request.get(path); const html = await response.text();
    const policy = response.headers()['content-security-policy'];
    expect(policy).toContain('sha256-'); expect(policy).toContain("script-src-attr 'none'"); expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).not.toMatch(/unsafe-inline|unsafe-eval/);
    expect(html).toContain('property="og:title"'); expect(html).toContain('name="twitter:title"');
    const title = html.match(/<title>(.*?)<\/title>/)?.[1]; expect(title).toBeTruthy(); titles.add(title);
  }
  expect(titles.size).toBe(4);
});

test('приватные значения браузера не попадают на публичные страницы', async ({ page }) => {
  await page.addInitScript(() => { localStorage.setItem('private-seo-probe', 'NEVER-RENDER-THIS-PLAYER'); });
  await page.goto('/privacy.html');
  await expect(page.locator('body')).not.toContainText('NEVER-RENDER-THIS-PLAYER');
  expect(await page.evaluate(() => localStorage.getItem('nohchiin-mott:progress'))).toBe(null);
});

test('FAQ открывается с клавиатуры и совпадает с JSON-LD', async ({ page }) => {
  await page.goto('/about.html');
  await expect(page.locator('.public-faq-item')).toHaveCount(8);
  const summary = page.locator('.public-faq-item summary').nth(1);
  await summary.focus(); await page.keyboard.press('Enter');
  await expect(page.locator('.public-faq-item').nth(1)).toHaveAttribute('open', '');
  const data = await page.locator('script[type="application/ld+json"]').textContent();
  const faq = JSON.parse(data!)['@graph'].find((node: { '@type': string }) => node['@type'] === 'FAQPage');
  expect(faq.mainEntity).toHaveLength(8);
  for (let index = 0; index < 8; index++) await expect(page.locator('.public-faq-item p').nth(index)).toHaveText(faq.mainEntity[index].acceptedAnswer.text);
});

test('несуществующий адрес возвращает настоящую 404, не игру с кодом 200', async ({ page }) => {
  const response = await page.goto('/not-a-real-route');
  expect(response?.status()).toBe(404);
  await expect(page.getByRole('heading', { name: 'Вернёмся к знакомым открытиям?' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
});

test('публичные страницы помещаются в viewport', async ({ page }, info) => {
  for (const path of pages) {
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/about.html');
  await page.screenshot({ path: info.outputPath('public-about.png'), fullPage: true });
});

test('новые публичные страницы и их FAQ доступны из защищённого offline-кэша', async ({ page, context }) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Открыть меню', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Установить приложение', exact: true }).click();
  await expect(page.locator('.offline-verified')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Закрыть окно' }).click();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.goto('/about.html');
  await expect(page.getByRole('heading', { name: 'Нохчийн Мотт', exact: true })).toBeVisible();
  await expect(page.locator('.public-faq-item')).toHaveCount(8);
});

test('внешняя аналитика не загружается при просмотре публичных страниц', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => { if (request.url().startsWith('http') && !request.url().startsWith('http://127.0.0.1:4173/')) external.push(request.url()); });
  await page.goto('/about.html'); await page.goto('/privacy.html');
  expect(external).toEqual([]);
});