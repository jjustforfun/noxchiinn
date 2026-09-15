import { test, expect, type Page } from '@playwright/test';

/** Открывает настройки через настоящий родительский экран. */
async function settings(page: Page) {
  await page.goto('/#parents');
  await page.getByRole('tab', { name: 'Семейные настройки' }).click();
}

test('родительский экран не придумывает статистику и помещается в экран', async ({ page }, info) => {
  await page.goto('/#parents');
  await expect(page.getByRole('heading', { name: 'Растём вместе с родным языком' })).toBeVisible();
  await expect(page.locator('.parent-metrics')).toContainText('Нет данных');
  await expect(page.locator('.history-empty')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath('parents.png'), fullPage: true });
});

test('календарь переключает месяцы и поддерживает клавиатуру', async ({ page }, info) => {
  await page.goto('/');
  await page.locator('.streak-stat').click();
  await expect(page.locator('.calendar-grid .calendar-day')).toHaveCount(42);
  const current = await page.locator('.calendar-toolbar h3').innerText();
  await page.getByRole('button', { name: 'Предыдущий месяц' }).click();
  await expect(page.locator('.calendar-toolbar h3')).not.toHaveText(current);
  await page.getByRole('button', { name: 'Следующий месяц' }).click();
  await expect(page.locator('.calendar-toolbar h3')).toHaveText(current);
  const selected = page.locator('.calendar-day[aria-pressed="true"]');
  const date = await selected.getAttribute('data-day'); await selected.focus(); await page.keyboard.press('ArrowLeft');
  await expect(page.locator('.calendar-day[aria-pressed="true"]')).not.toHaveAttribute('data-day', date!);
  await expect(page.locator('.calendar-day[aria-pressed="true"]')).toBeFocused();
  await page.screenshot({ path: info.outputPath('calendar.png'), fullPage: true });
});

test('цель семьи сохраняется и отображается на главном экране', async ({ page }) => {
  await settings(page);
  await page.getByRole('radio', { name: /12 XP/ }).check();
  await page.getByRole('button', { name: 'Вернуться к игре', exact: true }).click();
  await expect(page.locator('.goal-progress')).toContainText('0 / 12 XP');
  await page.reload(); await expect(page.locator('.goal-progress')).toContainText('0 / 12 XP');
});

test('без согласия напоминания не включаются', async ({ page }) => {
  await settings(page);
  await page.getByRole('switch', { name: 'Напоминать о занятии', exact: true }).click();
  await page.getByRole('button', { name: 'Сохранить напоминания', exact: true }).click();
  await expect(page.locator('.reminder-settings .setting-status')).toContainText('Подтвердите согласие');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress') || '{}'));
  expect(saved.preferences.reminders.enabled).toBe(false);
});

test('внутриигровое напоминание появляется один раз и не на родительском экране', async ({ page }) => {
  await page.clock.install({ time: new Date(2026, 8, 14, 18, 5) });
  await settings(page);
  await page.getByRole('switch', { name: 'Напоминать о занятии', exact: true }).click();
  await page.locator('.reminder-time input').fill('18:00');
  await page.getByRole('checkbox', { name: /Я взрослый и согласен/ }).check();
  await page.getByRole('button', { name: 'Сохранить напоминания', exact: true }).click();
  await expect(page.locator('.study-reminder')).toHaveCount(0);
  await page.getByRole('button', { name: 'Вернуться к игре', exact: true }).click();
  await page.clock.fastForward(16000);
  await expect(page.locator('.study-reminder')).toBeVisible();
  await page.getByRole('button', { name: 'Не сегодня', exact: true }).click();
  await page.reload(); await page.clock.fastForward(16000);
  await expect(page.locator('.study-reminder')).toHaveCount(0);
});

test('звуки можно выключить и настройка не теряется после перезагрузки', async ({ page }) => {
  await page.goto('/#profile');
  const toggle = page.getByRole('switch', { name: 'Звуковые эффекты', exact: true });
  await expect(toggle).toBeChecked(); await toggle.click();
  await expect(toggle).not.toBeChecked(); await page.reload();
  await expect(page.getByRole('switch', { name: 'Звуковые эффекты', exact: true })).not.toBeChecked();
});

test('миграция сохраняет старую серию, но не восстанавливает вымышленную историю', async ({ page }) => {
  await page.addInitScript(() => {
    const date = new Date(); const today = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    localStorage.setItem('nohchiin-mott:progress', JSON.stringify({ version: 3, generation: 'test-migration', updatedAt: Date.now(), xp: 76, hearts: 5, heartUpdated: Date.now(), streak: 3, lastPlayed: today, dailyDate: today, dailyXP: 20, completed: {}, learned: ['a', 'family-mother'], sessions: 9, practiceDays: [today], rewardedRounds: [], spentAttempts: [] }));
  });
  await page.goto('/#parents');
  await expect(page.locator('.history-empty')).toBeVisible();
  await expect(page.locator('.parent-streak-note')).toContainText('3 дня подряд');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('nohchiin-mott:progress') || '{}'));
  expect(saved.version).toBe(4); expect(saved.xp).toBe(76); expect(saved.preferences.reminders.enabled).toBe(false);
});

test('прогресс тем открывает соответствующую тренировку', async ({ page }) => {
  await page.goto('/#parents'); await page.getByRole('tab', { name: 'Темы и открытия' }).click();
  await expect(page.locator('.topic-progress-row')).toHaveCount(8);
  await page.getByRole('button', { name: /^Моя семья\. Пройдено/ }).click();
  await expect(page.getByRole('combobox', { name: 'Тема тренировки' })).toHaveValue('family');
});

test('новые семейные экраны доступны при офлайн-перезагрузке', async ({ page, context }) => {
  await page.goto('/');
  const menu = page.getByRole('button', { name: 'Открыть меню', exact: true });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole('button', { name: 'Установить приложение', exact: true }).click();
  await expect(page.locator('.offline-verified')).toBeVisible({ timeout: 30000 });
  await page.getByRole('button', { name: 'Закрыть окно' }).click();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true); await page.goto('/#parents');
  await expect(page.getByRole('heading', { name: 'Растём вместе с родным языком' })).toBeVisible();
  await page.getByRole('tab', { name: 'Семейные настройки' }).click();
  await expect(page.getByRole('heading', { name: 'Мягкое напоминание' })).toBeVisible();
});