import { test, expect, type Page } from '@playwright/test';

/** Начинает реальный визуальный раунд через пользовательский интерфейс. */
async function start(page: Page) {
  await page.getByRole('button', { name: 'Начать путешествие', exact: true }).click();
  await expect(page.getByRole('radio', { name: /Слушаем и выбираем/ })).toBeDisabled();
  await page.getByRole('button', { name: 'Поехали!', exact: true }).click();
}

/** Решает один вопрос по видимой маленькой букве, а не скрытому состоянию React. */
async function answer(page: Page, correct = true) {
  const lower = await page.locator('.question-letter > span').innerText();
  const upper = lower.toLocaleUpperCase('ru');
  if (correct) await page.getByRole('button', { name: `Буква ${upper}`, exact: true }).click();
  else {
    const choices = await page.locator('.answer-option').all();
    for (const choice of choices) {
      if (await choice.getAttribute('aria-label') !== `Буква ${upper}`) { await choice.click(); break; }
    }
  }
  await page.getByRole('button', { name: 'Проверить', exact: true }).click();
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('главный экран помещается в viewport и сохраняет фирменную композицию', async ({ page }, info) => {
  await expect(page.getByRole('heading', { name: 'Рады видеть тебя, друг!' })).toBeVisible();
  await expect(page.locator('.hero-landscape')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('home.png'), fullPage: true });
});

test('полный урок даёт 28 XP, открывает следующий и сохраняется', async ({ page }) => {
  await start(page);
  for (let index = 0; index < 7; index++) {
    await expect(page.locator('.answer-option')).toHaveCount(3);
    await answer(page);
    await page.getByRole('button', { name: /^(Дальше|Посмотреть результат)$/ }).click();
  }
  await expect(page.getByRole('heading', { name: 'У тебя получилось!' })).toBeVisible();
  await expect(page.locator('.result-numbers')).toContainText('+28 XP');
  await page.getByRole('button', { name: 'К моему путешествию' }).click();
  await page.reload();
  const profile = await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress') || '{}'));
  expect(profile.version).toBe(4);
  expect(profile.xp).toBe(28);
  expect(profile.hearts).toBe(5);
  expect(profile.completed['alphabet-1'].stars).toBe(3);
  expect(profile.learned).toHaveLength(7);
  await page.locator('.topic-active').click();
  await expect(page.getByRole('button', { name: /Урок 2.*Доступен/ })).toBeVisible();
});

test('перезагрузка на обратной связи не списывает сердечко второй раз', async ({ page }) => {
  await start(page); await answer(page, false);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress') || '{}').hearts)).toBe(4);
  await page.reload();
  await page.locator('.resume-strip .text-button').click();
  await expect(page.locator('.feedback-incorrect')).toBeVisible();
  await page.getByRole('button', { name: 'Дальше', exact: true }).click();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress') || '{}').hearts)).toBe(4);
});

test('отсутствующая запись даёт подсказку, а не штраф', async ({ page }) => {
  await start(page);
  await page.locator('.audio-button').click();
  await expect(page.locator('.audio-recovery')).toContainText('Запись носителя ещё готовится');
  await answer(page);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress') || '{}').hearts)).toBe(5);
});

test('Escape позволяет сохранить паузу, фокус не остаётся за диалогом', async ({ page }) => {
  await start(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Сделаем маленькую паузу?' })).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить паузу и выйти' }).click();
  await expect(page.locator('.resume-strip')).toBeVisible();
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});

test('worker подтверждает кэш, игра запускается после офлайн-перезагрузки', async ({ page, context }) => {
  const menu = page.getByRole('button', { name: 'Открыть меню', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Установить приложение', exact: true }).click();
  await expect(page.locator('.offline-verified')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Закрыть окно' }).click();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Рады видеть тебя, друг!' })).toBeVisible();
  await start(page); await answer(page);
  await expect(page.locator('.feedback-correct')).toBeVisible();
});