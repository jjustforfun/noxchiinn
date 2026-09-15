import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';

const root = resolve(import.meta.dirname, '..');
const report = { generatedAt: new Date().toISOString(), checks: [], bundle: null, git: 'not-checked' };

/** Запускает проверку с фиксированными аргументами и сохраняет её настоящий результат. */
function run(name, executable, args, shell = false) {
  console.log(`\nПроверка: ${name}`);
  const result = spawnSync(executable, args, { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, timeout: 180000, shell });
  const output = `${result.stdout || ''}${result.stderr || ''}${result.error?.message || ''}`;
  console.log(output);
  const check = { name, passed: result.status === 0, exitCode: result.status, output };
  report.checks.push(check);
  return check;
}

run('Vitest', process.execPath, [resolve(root, 'node_modules/vitest/vitest.mjs'), 'run', '--config', 'vitest.config.js']);
run('TypeScript', process.execPath, [resolve(root, 'node_modules/typescript/bin/tsc'), '--noEmit']);
run('npm audit', process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json'], process.platform === 'win32');

try {
  await stat(resolve(root, '.git'));
  report.git = 'directory-present';
} catch {
  if (process.argv.includes('--init-git')) report.git = run('Git init', 'git', ['init']).passed ? 'initialized' : 'failed';
  else report.git = 'not-initialized';
}

try {
  const html = await readFile(resolve(root, 'dist/index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter((match) => !match[1].includes('application/ld+json')).map((match) => match[2]).join('\n');
  const workers = [];
  for (const name of (await readdir(resolve(root, 'dist'))).filter((file) => /^service-[a-zA-Z0-9_-]+\.js$/.test(file))) {
      const data = await readFile(resolve(root, 'dist', name));
    workers.push({ file: name, bytes: data.length, gzipBytes: gzipSync(data).length });
  }
  report.bundle = { htmlBytes: Buffer.byteLength(html), htmlGzipBytes: gzipSync(html).length, initialJavaScriptGzipBytes: gzipSync(scripts).length, workers, javascriptBudgetPassed: gzipSync(scripts).length < 200000 };
  report.checks.push({ name: 'Initial JavaScript Budget', passed: report.bundle.javascriptBudgetPassed, exitCode: report.bundle.javascriptBudgetPassed ? 0 : 1, output: `${report.bundle.initialJavaScriptGzipBytes} bytes gzip, budget < 200000` });
} catch { report.bundle = { error: 'Сначала создайте dist штатной командой npm run build.' }; }

await writeFile(resolve(root, 'docs/check-results.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log('\nФактический отчёт записан в docs/check-results.json. Lighthouse и тесты браузера запускаются отдельно.');
if (report.checks.some((check) => !check.passed)) process.exitCode = 1;