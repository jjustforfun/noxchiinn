import { prerender } from './prerender.mjs';
import { harden } from './harden.mjs';
import { verifyRelease } from './verify-release.mjs';

// Обрабатывает уже собранный dist: публичный HTML -> CSP/SRI -> проверка артефактов.
// Этот сценарий не запускает Vite и не изменяет исходную конфигурацию сборки.
try {
  await prerender();
  await harden(undefined, process.argv.includes('--vercel'));
  await verifyRelease();
} catch (error) { console.error('Publication preparation stopped:', error.message); process.exitCode = 1; }