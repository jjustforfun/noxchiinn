/** Назначает каждой HTML-странице её CSP, а не политику главной страницы. */
export function documentHeaders(policies, robots = {}) {
  return Object.fromEntries(Object.entries(policies).map(([file, policy]) => {
    if (!/^(?:[a-z0-9-]+\/)*[a-z0-9-]+\.html$/.test(file)) throw new Error('Unreviewed HTML path');
    return [file, { 'Content-Security-Policy': policy, 'Cache-Control': 'no-cache', 'Content-Type': 'text/html; charset=utf-8', 'X-Robots-Tag': robots[file] || 'noindex, nofollow' }];
  }));
}

/** Формирует точные HTTP-маршруты без catch-all переписывания любого URL в игру. */
export function documentRoutes(headers) {
  return Object.entries(headers).map(([file, value]) => ({ src: file === 'index.html' ? '^/(?:index\\.html)?$' : `^/${file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, headers: value, ...(file === 'index.html' ? { dest: '/index.html' } : { continue: true }) }));
}