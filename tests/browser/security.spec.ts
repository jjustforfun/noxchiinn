import { expect, test, type Page } from '@playwright/test';

/** Загружает файл через пользовательский импорт без прямой записи состояния игры. */
async function upload(page: Page, value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  await page.getByLabel('Файл сохранения', { exact: true }).setInputFiles({ name: 'progress.json', mimeType: 'application/json', buffer: Buffer.from(text) });
}

test('production CSP действительно блокирует посторонний inline script', async ({ page }) => {
  const response = await page.goto('/');
  const csp = response!.headers()['content-security-policy'];
  expect(csp).toContain('sha256-'); expect(csp).not.toMatch(/unsafe-inline|unsafe-eval|nonce-/);
  await expect(page.getByRole('heading', { name: 'Рады видеть тебя, друг!' })).toBeVisible();
  await page.evaluate(() => { const script = document.createElement('script'); script.textContent = 'document.body.dataset.securityProbe="executed"'; document.body.append(script); });
  await expect(page.locator('body')).not.toHaveAttribute('data-security-probe', 'executed');
});

test('security headers применены, а Service Worker имеет отдельную CSP', async ({ request }) => {
  const response = await request.get('/');
  expect(response.headers()['x-content-type-options']).toBe('nosniff');
  expect(response.headers()['referrer-policy']).toBe('no-referrer');
  expect(response.headers()['x-frame-options']).toBe('DENY');
  const worker = await request.get('/sw.js');
  expect(worker.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(worker.headers()['cache-control']).toBe('no-cache');
});

test('импорт не заменяет текущий профиль до подтверждения', async ({ page }) => {
  await page.goto('/#profile');
  await page.waitForFunction(() => Boolean(localStorage.getItem('nohchiin-mott:progress')));
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress')!));
  await upload(page, { ...before, xp: 64, name: 'Из файла' });
  await expect(page.getByRole('heading', { name: 'Продолжить другое путешествие?' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress')!).xp)).toBe(before.xp);
  await page.getByRole('button', { name: 'Оставить мой профиль', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress')!).name)).toBe(before.name);
});

test('подтверждение импорта выключает напоминания из файла', async ({ page }) => {
  await page.goto('/#profile'); await page.waitForFunction(() => Boolean(localStorage.getItem('nohchiin-mott:progress')));
  const initial = await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress')!));
  initial.preferences.reminders.enabled = true; initial.preferences.reminders.consent = true;
  await upload(page, { ...initial, xp: 80 });
  await page.getByRole('button', { name: 'Заменить прогресс', exact: true }).click();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
  const result = await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress')!));
  expect(result.xp).toBe(80); expect(result.generation).not.toBe(initial.generation); expect(result.preferences.reminders.enabled).toBe(false); expect(result.preferences.reminders.consent).toBe(false);
});

test('вредоносные ключи файла отклоняются без изменения сохранения', async ({ page }) => {
  await page.goto('/#profile'); await page.waitForFunction(() => Boolean(localStorage.getItem('nohchiin-mott:progress')));
  const before = await page.evaluate(() => localStorage.getItem('nohchiin-mott:progress'));
  await upload(page, '{"version":4,"xp":777,"completed":{},"learned":[],"preferences":{"__proto__":{"polluted":true}}}');
  await expect(page.locator('.toast')).toContainText('Файл не подходит');
  expect(await page.evaluate(() => localStorage.getItem('nohchiin-mott:progress'))).toBe(before);
});

test('слишком глубокий JSON не приводит к белому экрану', async ({ page }) => {
  await page.goto('/#profile');
  await upload(page, '['.repeat(100) + '0' + ']'.repeat(100));
  await expect(page.locator('.toast')).toContainText('Файл не подходит');
  await expect(page.getByRole('heading', { name: 'Мой профиль', exact: true })).toBeVisible();
});

test('будущая схема остаётся нетронутой при загрузке старого интерфейса', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('nohchiin-mott:progress', '{"version":999,"xp":500,"privateFutureField":"do-not-replace"}'));
  await page.goto('/');
  await expect(page.locator('.storage-notice')).toContainText('не поддерживается');
  await page.getByRole('button', { name: 'Начать путешествие', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress')!).privateFutureField)).toBe('do-not-replace');
});

test('действия двух вкладок не перезаписывают настройки друг друга', async ({ page, context }) => {
  await page.goto('/#profile'); await page.waitForFunction(() => Boolean(localStorage.getItem('nohchiin-mott:progress')));
  const second = await context.newPage(); await second.goto('/#profile');
  await page.getByLabel('Как тебя называть?', { exact: true }).fill('Лиса');
  await page.getByRole('button', { name: 'Сохранить профиль', exact: true }).click();
  await expect(second.getByRole('heading', { name: 'Привет, Лиса!' })).toBeVisible();
  await second.getByRole('switch', { name: 'Звуковые эффекты', exact: true }).click();
  await expect(page.getByRole('switch', { name: 'Звуковые эффекты', exact: true })).not.toBeChecked();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress')!).name)).toBe('Лиса');
});

test('прогресс и модалки работают без inline style attributes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Начать путешествие', exact: true }).click();
  await page.getByRole('button', { name: 'Поехали!', exact: true }).click();
  await expect(page.locator('progress')).not.toHaveCount(0);
  await expect(page.locator('#root [style]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Буква А', exact: true }).click();
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.locator('.feedback-correct')).toBeVisible();
});

test('запрос к произвольному медиа не попадает в runtime-кэш', async ({ page }) => {
  await page.goto('/'); await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.evaluate(async () => { await fetch('/audio/not-in-catalog.mp3').catch(() => undefined); });
  const cached = await page.evaluate(async () => {
    const names = await caches.keys();
    for (const name of names.filter((name) => name.startsWith('nohchiin-mott-'))) if (await (await caches.open(name)).match('/audio/not-in-catalog.mp3')) return true;
    return false;
  });
  expect(cached).toBe(false);
});