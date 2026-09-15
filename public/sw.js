/* Origin и пути ограничены до исполнения. Ошибка импорта не активирует неполный worker. */
const modulePath = new URL(self.location.href).searchParams.get('module');
if (modulePath) {
  const moduleUrl = new URL(modulePath, self.location.origin);
  if (moduleUrl.origin === self.location.origin && /^\/(?:assets\/)?service-[a-zA-Z0-9_-]+\.js$/.test(moduleUrl.pathname) && !moduleUrl.search && !moduleUrl.hash && !moduleUrl.username && !moduleUrl.password) {
    importScripts('/release.js');
    const release = self.__NOHCHI_RELEASE__;
    if (release !== null && (!release || release.version !== 1 || typeof release.worker !== 'string' || !/^\/service-[a-zA-Z0-9_-]+\.js$/.test(release.worker))) {
      throw new Error('Некорректный локальный манифест выпуска');
    }
    importScripts(release ? new URL(release.worker, self.location.origin).href : moduleUrl.href);
  } else {
    throw new Error('Недопустимый адрес service worker');
  }
} else {
  throw new Error('Не указан модуль service worker');
}