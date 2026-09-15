import { readFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

const numbers = JSON.parse(readFileSync(new URL('../../data/numbers.json', import.meta.url), 'utf8'));
const family = JSON.parse(readFileSync(new URL('../../data/family.json', import.meta.url), 'utf8'));
const alphabet = JSON.parse(readFileSync(new URL('../../data/alphabet.json', import.meta.url), 'utf8'));

/** Открывает мини-игру через видимые действия в мастерской. */
async function launch(page: Page, title: string, topic = 'numbers') {
  await page.goto('/#practice');
  await page.getByRole('combobox', { name: 'Тема тренировки' }).selectOption(topic);
  await page.locator('.practice-game').filter({ has: page.getByRole('heading', { name: title, exact: true }) }).click();
  await page.getByRole('button', { name: 'Поехали!', exact: true }).click();
}

/** Читает подпись картинки, а не внутреннее состояние игры. */
async function pairPage(page: Page, dataset = numbers) {
  const buttons = page.locator('.match-picture:not(:disabled)');
  while (await buttons.count()) {
    const button = buttons.first();
    const label = await button.locator('.art-caption').innerText();
    const item = dataset.items.find((item: { russian: string }) => item.russian === label);
    await button.click();
    await page.getByRole('button', { name: `Слово: ${item.chechen}`, exact: true }).click();
  }
}

/** Разбирает образец по опубликованному алфавиту, чтобы нажать настоящие фишки интерфейса. */
function sampleTokens(text: string) {
  const normalize = (value: string) => value.toLocaleLowerCase('ru').replace(/\u04cf/g, '\u04c0');
  const input = normalize(text);
  const signs = alphabet.items.map((item: { chechen: string }) => normalize(item.chechen)).sort((a: string, b: string) => b.length - a.length);
  const result: string[] = [];
  for (let index = 0; index < input.length;) {
    const token = signs.find((sign: string) => input.startsWith(sign, index)) || input[index];
    if (token !== ' ' && token !== '-') result.push(token);
    index += token.length;
  }
  return result;
}

test('мастерская показывает 20 чисел и три новые игры', async ({ page }, info) => {
  await page.goto('/#practice');
  await expect(page.getByRole('heading', { name: 'Мастерская знаний' })).toBeVisible();
  await expect(page.locator('.practice-game')).toHaveCount(3);
  await expect(page.locator('.vocabulary-card')).toHaveCount(20);
  await expect(page.getByRole('combobox', { name: 'Тема тренировки' })).toHaveValue('numbers');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('practice.png'), fullPage: true });
});

test('полное сопоставление даёт XP, но не обходит основную карту', async ({ page }) => {
  await launch(page, 'Найди пару');
  for (let index = 0; index < 2; index++) {
    await pairPage(page);
    await page.getByRole('button', { name: /^(Дальше|Посмотреть результат)$/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'У тебя получилось!' })).toBeVisible();
  await expect(page.locator('.result-numbers')).toContainText('+20 XP');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress') || '{}'));
  expect(saved.xp).toBe(20); expect(saved.hearts).toBe(5); expect(saved.completed).toEqual({}); expect(saved.learned).toHaveLength(5);
});

test('неверную пару можно исправить, и сердечки тренировки остаются', async ({ page }, info) => {
  await launch(page, 'Найди пару');
  const left = page.locator('.match-picture:not(:disabled)').first();
  const label = await left.locator('.art-caption').innerText();
  const right = numbers.items.find((item: { russian: string }) => item.russian === label).chechen;
  await left.click();
  const wrong = page.locator('.match-word:not(:disabled)').filter({ hasNotText: right }).first();
  await wrong.click();
  await expect(page.locator('.matching-error')).toBeVisible();
  await page.getByRole('button', { name: `Слово: ${right}`, exact: true }).click();
  await expect(page.getByRole('button', { name: `Картинка: ${label}, пара найдена`, exact: true })).toBeDisabled();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress') || '{}').hearts)).toBe(5);
  await page.screenshot({ path: info.outputPath('pairs.png'), fullPage: true });
});

test('сборка слова работает с повторяющимися фишками и подсказкой', async ({ page }, info) => {
  await launch(page, 'Собери слово', 'family');
  await page.getByRole('button', { name: 'Показать образец' }).click();
  const sample = await page.locator('.spelling-example').innerText();
  expect(family.items.some((item: { chechen: string }) => item.chechen === sample)).toBe(true);
  for (const token of sampleTokens(sample)) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    await page.locator('.tile-bank button:not(:disabled)').filter({ hasText: new RegExp(`^${escaped}$`) }).first().click();
  }
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
  await expect(page.locator('.feedback-correct')).toBeVisible();
  expect(await page.locator('dialog').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('spelling.png'), fullPage: true });
});

test('пауза викторины не расходует остаток времени', async ({ page }) => {
  await launch(page, 'Быстрые открытия');
  await expect(page.locator('.quiz-clock')).toBeVisible();
  await expect.poll(async () => page.locator('.quiz-clock > strong').innerText()).not.toBe('01:30');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Сделаем маленькую паузу?' })).toBeVisible();
  const before = await page.evaluate(() => JSON.parse(sessionStorage.getItem('nohchiin-mott:round') || '{}').remainingMs);
  await page.waitForTimeout(750);
  const after = await page.evaluate(() => JSON.parse(sessionStorage.getItem('nohchiin-mott:round') || '{}').remainingMs);
  expect(after).toBe(before);
  await page.getByRole('button', { name: 'Остаться в уроке' }).click();
  await expect(page.locator('.quiz-clock')).toBeVisible();
});

test('поиск и карточки работают во всех новых темах', async ({ page }) => {
  await page.goto('/#practice');
  for (const topic of ['colors', 'words', 'family', 'food', 'animals', 'body']) {
    await page.getByRole('combobox', { name: 'Тема тренировки' }).selectOption(topic);
    await expect(page.locator('.vocabulary-card')).toHaveCount(8);
  }
  await page.getByRole('textbox', { name: 'Найти слово' }).fill('БӀаьрг');
  await expect(page.locator('.vocabulary-card')).toHaveCount(1);
  await page.locator('.vocabulary-card').click();
  await expect(page.locator('.word-detail-name')).toHaveText('БӀаьрг');
  await expect(page.locator('.content-source')).toBeVisible();
});

test('сохраняет выбранную фишку после перезагрузки', async ({ page }) => {
  await launch(page, 'Собери слово', 'food');
  const first = await page.locator('.tile-bank button').first().innerText();
  await page.locator('.tile-bank button').first().click();
  await page.reload(); await page.goto('/#learn');
  await page.locator('.resume-strip .text-button').click();
  await expect(page.locator('.word-slot.filled')).toHaveCount(1);
  await expect(page.locator('.word-slot.filled')).toHaveText(first);
});

test('новые данные и SVG доступны после офлайн-перезагрузки', async ({ page, context }) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Открыть меню', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Установить приложение', exact: true }).click();
  await expect(page.locator('.offline-verified')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Закрыть окно' }).click();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await launch(page, 'Найди пару', 'family');
  const reference = await page.locator('.match-picture use').first().getAttribute('href');
  expect(await page.evaluate(async (url) => (await fetch(url!.split('#')[0])).ok, reference)).toBe(true);
  await pairPage(page, family);
  await expect(page.getByRole('button', { name: 'Дальше', exact: true })).toBeVisible();
});