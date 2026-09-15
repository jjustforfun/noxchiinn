/** Обрабатывает только уведомления игры и не доверяет адресу из произвольного payload. */
export async function openReminder(event, clients, origin) {
  if (!['nohchiin-mott-study', 'nohchiin-mott-study-test'].includes(event.notification?.tag)) return false;
  event.notification.close();
  try {
    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find((client) => {
      const url = new URL(client.url);
      return url.origin === origin && ['/', '/index.html'].includes(url.pathname);
    });
    if (existing) {
      // Фокусируем вкладку, а не navigate/reload: активный урок нельзя потерять.
      existing.postMessage({ type: 'OPEN_STUDY' }); await existing.focus();
    } else await clients.openWindow(new URL('/#learn', origin).href);
    return true;
  } catch { return false; }
}