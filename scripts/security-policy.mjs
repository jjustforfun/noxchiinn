import { createHash } from 'node:crypto';

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000',
};
export const WORKER_POLICY = "default-src 'none'; script-src 'self'; connect-src 'self'; img-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'";
export const ASSET_POLICY = "default-src 'none'; script-src 'none'; style-src 'none'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'";

/** Вычисляет настоящую SHA-256 SRI-строку, не заменяя проверку доверенного origin. */
export function integrity(bytes) { return `sha256-${createHash('sha256').update(bytes).digest('base64')}`; }

/** Строит CSP по финальным inline-блокам Vite, без unsafe-inline, eval и повторяемого nonce. */
export function sealHtml(source) {
  const html = source.replace(/\r\n?/g, '\n');
  if (!/<meta\s+charset="UTF-8"\s*\/?\s*>/i.test(html)) throw new Error('Missing UTF-8 declaration');
  if (html.includes('name="nohchiin-security"')) throw new Error('Already sealed; use a fresh Vite build');
  const blocks = [...html.matchAll(/<(script|style)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)];
  const scripts = blocks.filter((match) => match[1].toLowerCase() === 'script');
  const styles = blocks.filter((match) => match[1].toLowerCase() === 'style');
  if (scripts.some((match) => /\bsrc\s*=/i.test(match[2]))) throw new Error('Expected a bundled inline script, not an unreviewed external script');
  const scriptHashes = [...new Set(scripts.map((match) => `'${integrity(match[3])}'`))];
  const styleHashes = [...new Set(styles.map((match) => `'${integrity(match[3])}'`))];
  const policy = [
    "default-src 'none'", `script-src ${scriptHashes.join(' ') || "'none'"}`, "script-src-attr 'none'",
    `style-src ${styleHashes.join(' ') || "'none'"}`, "style-src-attr 'none'",
    "img-src 'self' data:", "font-src 'self' data:", "connect-src 'self'", "media-src 'self'",
    "worker-src 'self'", "manifest-src 'self'", "object-src 'none'", "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
  ].join('; ');
  // frame-ancestors поддерживается только HTTP-заголовком, не meta.
  const metaPolicy = policy.replace("; frame-ancestors 'none'", '');
  const marker = `<meta name="nohchiin-security" content="sealed-v1"><meta http-equiv="Content-Security-Policy" content="${metaPolicy}">`;
  const sealed = html.replace(/(<meta\s+charset="UTF-8"\s*\/?\s*>)/i, `$1\n    ${marker}`);
  return { html: sealed, policy, scriptHashes, styleHashes };
}

/** Убеждается, что опубликованный HTML совпадает с разрешёнными CSP-хешами. */
export function verifySealed(html, policy) {
  if (!html.includes('name="nohchiin-security" content="sealed-v1"') || /unsafe-inline|unsafe-eval|nonce-/.test(policy)) return false;
  for (const match of html.matchAll(/<(script|style)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)) if (!policy.includes(`'${integrity(match[2])}'`)) return false;
  return policy.includes("script-src-attr 'none'") && policy.includes("style-src-attr 'none'") && policy.includes("frame-ancestors 'none'");
}