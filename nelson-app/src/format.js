// Pure helpers (no React Native imports) so they can be unit tested in Node.

export function money(value, currency = 'USD') {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return '-';
  const v = Number(value);
  const sign = v < 0 ? '-' : '';
  const abs = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${sign}${currency === 'USD' ? '$' : ''}${abs}${currency !== 'USD' ? ` ${currency}` : ''}`;
}

export function signedMoney(value, currency = 'USD') {
  if (value === null || value === undefined) return '-';
  return (Number(value) > 0 ? '+' : '') + money(value, currency);
}

export function price(value) {
  if (value === null || value === undefined) return '-';
  return Number(value).toFixed(2);
}

export function pct(value) {
  if (value === null || value === undefined) return '-';
  const v = Number(value);
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

// "3 min ago" style label for an ISO time (UTC from Nelson) relative to now.
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return '';
  const t = Date.parse(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  const s = Math.round((now - t) / 1000);
  if (s < 0) return timeUntil(iso, now);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export function timeUntil(iso, now = Date.now()) {
  const t = Date.parse(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  const m = Math.round((t - now) / 60000);
  if (m <= 0) return 'now';
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `in ${h} h ${m % 60} min` : `in ${Math.floor(h / 24)} d ${h % 24} h`;
}

export function utcClock(iso) {
  if (!iso) return '';
  const d = new Date(iso.endsWith('Z') || /[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return `${days[d.getUTCDay()]} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
}

// Cleans what the user typed (or scanned) into a base URL: https://host[:port]
export function normaliseUrl(raw) {
  let u = String(raw || '').trim();
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  return u.replace(/\/+$/, '').replace(/\/api$/, '');
}

// QR from `python run_nelson.py app-setup`: {"url": "...", "key": "..."}
export function parseConnectionQr(data) {
  try {
    const obj = JSON.parse(data);
    if (obj && typeof obj.url === 'string' && typeof obj.key === 'string' && obj.key.length >= 16) {
      return { url: normaliseUrl(obj.url), key: obj.key.trim() };
    }
  } catch {
    // not JSON
  }
  return null;
}

// Plain http is fine on a home network, the demo, or inside Tailscale (100.64.0.0/10),
// but sends the key unencrypted over the internet.
export function isInsecureRemote(url) {
  const m = /^http:\/\/([^/:]+)/i.exec(url || '');
  if (!m) return false;
  const host = m[1];
  if (host === 'localhost' || host.endsWith('.local') || host.endsWith('.ts.net')) return false;
  const p = host.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n))) return true;
  if (p[0] === 10 || p[0] === 127) return false;
  if (p[0] === 192 && p[1] === 168) return false;
  if (p[0] === 172 && p[1] >= 16 && p[1] <= 31) return false;
  if (p[0] === 100 && p[1] >= 64 && p[1] <= 127) return false;
  return true;
}

export function trendLabel(trend) {
  if (trend > 0) return 'Bullish';
  if (trend < 0) return 'Bearish';
  return 'Unclear';
}

// Short human sentence for the journal list
export function journalText(row) {
  const e = row.event;
  const side = row.side ? `${row.side} ` : '';
  const at = row.price ? `@ ${price(row.price)}` : '';
  switch (e) {
    case 'order': return `Order placed: ${side}${row.lots} lots ${at}`;
    case 'filled': return `Filled ${at} (${row.lots} lots)`;
    case 'partial': return `Partial profit: ${row.lots} lots ${at}`;
    case 'breakeven': return `Stop moved to break-even (${price(row.sl)})`;
    case 'closed': return `Trade closed ${signedMoney(row.pnl)}`;
    case 'cancel': return `Order cancelled: ${row.details}`;
    case 'flatten': return `Closed early: ${row.details}`;
    case 'skipped': return `${side}setup skipped: ${row.details}`;
    case 'blocked': return `${side}setup blocked: ${row.details}`;
    case 'paper_signal': return `Paper signal: ${side}${at}`;
    case 'paused': return `${side}setup seen while paused`;
    case 'pause': return `Paused ${row.details}`;
    case 'resume': return `Resumed ${row.details}`;
    case 'closeall': return `Close all ${row.details}`;
    case 'risk': return row.details;
    case 'start': {
      const kv = Object.fromEntries(String(row.details || '').split(' ').map((p) => p.split('=')));
      return `Nelson started: ${kv.mode || '?'} mode, ${kv.account || '?'} account, ${kv.trading === 'True' ? 'placing orders' : 'analysis only'}`;
    }
    default: return `${e} ${row.details || ''}`.trim();
  }
}

export function journalTone(event, pnl) {
  if (event === 'closed') return Number(pnl) > 0 ? 'good' : Number(pnl) < 0 ? 'bad' : 'neutral';
  if (['order', 'filled', 'partial', 'breakeven'].includes(event)) return 'info';
  if (['blocked', 'flatten', 'closeall', 'cancel'].includes(event)) return 'warn';
  return 'neutral';
}

// Price scale for the candle chart: candles + chosen extra lines, padded
export function priceRange(candles, extra = []) {
  let lo = Infinity;
  let hi = -Infinity;
  for (const c of candles) {
    lo = Math.min(lo, c[3]);
    hi = Math.max(hi, c[2]);
  }
  for (const p of extra) {
    if (p !== null && p !== undefined && Number.isFinite(p)) {
      lo = Math.min(lo, p);
      hi = Math.max(hi, p);
    }
  }
  if (!Number.isFinite(lo)) return { lo: 0, hi: 1 };
  const pad = Math.max((hi - lo) * 0.06, 0.5);
  return { lo: lo - pad, hi: hi + pad };
}
