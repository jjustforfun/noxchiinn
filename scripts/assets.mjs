import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

// Одноразовая подготовка ресурсов через тот же Chromium, который нужен UI-тестам.
// Скрипт не запускает сборку и не изменяет package.json или конфигурацию Vite.
const root = resolve(import.meta.dirname, '..');
const icon = await readFile(resolve(root, 'public/icons/icon.svg'), 'utf8');
const maskable = await readFile(resolve(root, 'public/icons/maskable.svg'), 'utf8');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const spec of [
    { name: 'icon-192.png', size: 192, source: icon },
    { name: 'icon-512.png', size: 512, source: icon },
    { name: 'maskable-512.png', size: 512, source: maskable },
    { name: 'apple-touch-icon.png', size: 180, source: icon },
  ]) {
    const base64 = await page.evaluate(async ({ source, size }) => {
      const url = URL.createObjectURL(new Blob([source], { type: 'image/svg+xml' }));
      try {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#eaf2dc'; ctx.fillRect(0, 0, size, size);
        ctx.drawImage(image, 0, 0, size, size);
        return canvas.toDataURL('image/png').split(',')[1];
      } finally { URL.revokeObjectURL(url); }
    }, spec);
    await writeFile(resolve(root, 'public/icons', spec.name), Buffer.from(base64, 'base64'));
    console.log(`Создан ${spec.name}: ${spec.size}x${spec.size}`);
  }

  const original = await readFile(resolve(root, 'public/images/learning-landscape.png'));
  const renderedImages = await page.evaluate(async (base64) => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas');
    canvas.width = Math.min(image.naturalWidth, 1568);
    canvas.height = Math.round(image.naturalHeight * canvas.width / image.naturalWidth);
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const data = canvas.toDataURL('image/webp', .82);
    if (!data.startsWith('data:image/webp')) throw new Error('WebP не поддерживается');
    const share = document.createElement('canvas'); share.width = 1200; share.height = 630;
    const ctx = share.getContext('2d');
    ctx.fillStyle = '#def3e5'; ctx.fillRect(0, 0, 1200, 630);
    const scale = 630 / image.naturalHeight;
    ctx.drawImage(image, -390, 0, image.naturalWidth * scale, 630);
    const shade = ctx.createLinearGradient(0, 0, 820, 0);
    shade.addColorStop(0, '#def3e5'); shade.addColorStop(.6, '#def3e5'); shade.addColorStop(1, '#def3e500');
    ctx.fillStyle = shade; ctx.fillRect(0, 0, 850, 630);
    ctx.fillStyle = '#31563b'; ctx.font = '800 62px Arial, sans-serif'; ctx.fillText('Нохчийн Мотт', 66, 205);
    ctx.font = '700 39px Arial, sans-serif'; ctx.fillText('Язык твоей семьи.', 69, 268);
    ctx.fillStyle = '#56765a'; ctx.font = '25px Arial, sans-serif'; ctx.fillText('Чеченский язык в игре', 70, 337); ctx.fillText('для детей и их близких.', 70, 376);
    return { webp: data.split(',')[1], share: share.toDataURL('image/jpeg', .87).split(',')[1] };
  }, original.toString('base64'));
  await mkdir(resolve(root, 'public/images'), { recursive: true });
  await writeFile(resolve(root, 'public/images/learning-landscape.webp'), Buffer.from(renderedImages.webp, 'base64'));
  await writeFile(resolve(root, 'public/images/share.jpg'), Buffer.from(renderedImages.share, 'base64'));
  console.log(`Созданы WebP (${Math.round(Buffer.byteLength(renderedImages.webp, 'base64') / 1024)} КБ) и JPEG-превью 1200x630`);

  const manifestPath = resolve(root, 'public/manifest.webmanifest');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  manifest.icons = [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ];
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  const htmlPath = resolve(root, 'index.html');
  const html = await readFile(htmlPath, 'utf8');
  if (!html.includes('rel="apple-touch-icon"')) await writeFile(htmlPath, html.replace('</head>', '  <link rel="apple-touch-icon" sizes="180x180" href="/icons/apple-touch-icon.png" />\n  </head>'));
  console.log('Manifest и Apple Touch Icon подключены. Проверьте файлы перед публикацией.');
} finally { await browser.close(); }