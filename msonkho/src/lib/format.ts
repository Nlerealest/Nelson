// Number and money formatting that does not depend on Intl, so it behaves the
// same on every Android phone, in the browser and in Node tests.

/** Rounds to the nearest tambala (two decimal places). */
export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function group(intDigits: string): string {
  return intDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** K1,234,567 — or K1,234.50 when there are tambala. */
export function formatK(n: number, opts: { decimals?: 'auto' | 'always' | 'never' } = {}): string {
  if (!Number.isFinite(n)) return '—';
  const mode = opts.decimals ?? 'auto';
  const sign = n < 0 ? '−' : '';
  const abs = Math.abs(roundMoney(n));
  const whole = Math.floor(abs);
  const cents = Math.round((abs - whole) * 100);
  const showCents = mode === 'always' || (mode === 'auto' && cents !== 0);
  if (mode === 'never') return `${sign}K${group(String(Math.round(abs)))}`;
  return `${sign}K${group(String(whole))}${showCents ? `.${String(cents).padStart(2, '0')}` : ''}`;
}

/** K1.57m, K10m, K250k: for tight spaces such as band labels. */
export function formatKShort(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  const trim = (v: number) => String(Math.round(v * 100) / 100).replace(/\.0+$/, '');
  if (n >= 1_000_000_000) return `K${trim(n / 1_000_000_000)}bn`;
  if (n >= 1_000_000) return `K${trim(n / 1_000_000)}m`;
  if (n >= 1_000) return `K${trim(n / 1_000)}k`;
  return `K${trim(n)}`;
}

/** 0.175 → "17.5%" */
export function formatPct(rate: number, maxDecimals = 2): string {
  const v = Math.round(rate * 100 * 10 ** maxDecimals) / 10 ** maxDecimals;
  return `${v}%`;
}

/** Reads what someone typed ("K 1,250,000.50") as a number. Empty → 0. */
export function parseAmount(text: string): number {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  const normal = firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '');
  const n = Number.parseFloat(normal);
  return Number.isFinite(n) ? n : 0;
}

/** Keeps a money field readable while typing: "1250000" → "1,250,000". */
export function formatTyping(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  if (!cleaned) return '';
  const [intPart, ...rest] = cleaned.split('.');
  const intGrouped = group(intPart.replace(/^0+(?=\d)/, ''));
  if (rest.length === 0) return intGrouped;
  return `${intGrouped || '0'}.${rest.join('').slice(0, 2)}`;
}
