// Formatting and the trip-status vocabulary shared by every screen.
// Pure functions only (tested in tests/format.test.js).

export const STATUS = {
  new: { label: 'Received', tone: 'info', icon: 'mail-unread', step: 0 },
  quoting: { label: 'Finding fares', tone: 'info', icon: 'search', step: 1 },
  quoted: { label: 'Fares ready', tone: 'accent', icon: 'pricetags', step: 1 },
  accepted: { label: 'Awaiting payment', tone: 'warn', icon: 'wallet', step: 2 },
  paid: { label: 'Checking payment', tone: 'warn', icon: 'hourglass', step: 2 },
  confirmed: { label: 'Issuing ticket', tone: 'brand', icon: 'checkmark-circle', step: 3 },
  ticketed: { label: 'Ticket issued', tone: 'ok', icon: 'airplane', step: 4 },
  completed: { label: 'Completed', tone: 'mute', icon: 'flag', step: 4 },
  cancelled: { label: 'Cancelled', tone: 'bad', icon: 'close-circle', step: -1 },
};
export const STEPS = ['Request', 'Fares', 'Payment', 'Confirmed', 'Ticket'];
export const statusOf = (s) => STATUS[s] || { label: s, tone: 'mute', icon: 'ellipse', step: 0 };

export const KINDS = [
  ['flight', 'Flight'],
  ['visa', 'Visa help'],
  ['planning', 'Trip planning'],
  ['other', 'Other'],
];
export const kindLabel = (k) => (KINDS.find(([v]) => v === k) || [k, k])[1];

export const PAY_METHODS = [
  ['airtel', 'Airtel Money'],
  ['mpamba', 'TNM Mpamba'],
  ['bank', 'Bank deposit'],
  ['cash', 'Cash at office'],
];
export const payLabel = (m) => (PAY_METHODS.find(([v]) => v === m) || [m, m])[1];

// Airports Gramaro's customers fly from most, plus common destinations.
export const PLACES = [
  'Lilongwe (LLW)', 'Blantyre (BLZ)', 'Johannesburg (JNB)', 'Nairobi (NBO)', 'Addis Ababa (ADD)',
  'Dar es Salaam (DAR)', 'Lusaka (LUN)', 'Harare (HRE)', 'Dubai (DXB)', 'London (LHR)',
];

export function mk(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '—';
  return 'MK ' + Math.round(Number(n)).toLocaleString('en-US');
}
export function usd(n) {
  if (n === null || n === undefined || n === '' || Number.isNaN(Number(n))) return '';
  return 'US$ ' + Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 });
}
// "1,250,000" / "1 250 000" / "MK1250000" → 1250000
export function parseAmount(text) {
  const n = Number(String(text || '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
// Accepts YYYY-MM-DD or D/M/YYYY. Returns YYYY-MM-DD or null.
export function parseDate(text) {
  const s = String(text || '').trim();
  let y, m, d;
  let r = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (r) [, y, m, d] = r.map(Number);
  else if ((r = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/))) [, d, m, y] = r.map(Number);
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}
export function day(iso) {
  if (!iso) return '';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
export function when(ts, now = Date.now()) {
  if (!ts) return '';
  const t = new Date(ts).getTime();
  const mins = Math.round((now - t) / 60000);
  if (mins < 1 && mins > -1) return 'just now';
  if (mins < 0) return at(t);
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)} h ago`;
  return at(t);
}
// "19 Dec, 14:05": an exact local date and time.
export function at(ts) {
  if (!ts) return '';
  const dt = new Date(ts);
  return `${dt.getDate()} ${MONTHS[dt.getMonth()]}, ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
}
// Time left on a fare hold: "5 h 12 min left", "Expired", or null if no hold.
export function holdLeft(until, now = Date.now()) {
  if (!until) return null;
  const ms = new Date(until).getTime() - now;
  if (ms <= 0) return { expired: true, text: 'Expired', urgent: true };
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440), h = Math.floor((mins % 1440) / 60), m = mins % 60;
  const text = d > 0 ? `${d} d ${h} h left` : h > 0 ? `${h} h ${m} min left` : `${m} min left`;
  return { expired: false, text, urgent: ms < 6 * 3600 * 1000 };
}
// Passport needs 6 months' validity after the trip for most countries.
export function passportCheck(expiry, travelDate, now = new Date()) {
  if (!expiry) return { tone: 'warn', text: 'Add your passport expiry date so we can check it for you.' };
  const exp = new Date(expiry + 'T00:00:00Z');
  const base = travelDate ? new Date(travelDate + 'T00:00:00Z') : now;
  const months = (exp.getUTCFullYear() - base.getUTCFullYear()) * 12 + (exp.getUTCMonth() - base.getUTCMonth()) - (exp.getUTCDate() < base.getUTCDate() ? 1 : 0);
  if (exp < now) return { tone: 'bad', text: 'Your passport has expired. Renew it before booking.' };
  if (months < 6) return { tone: 'bad', text: `Your passport has less than 6 months left${travelDate ? ' on your travel date' : ''}. Most airlines and countries will refuse it.` };
  if (months < 9) return { tone: 'warn', text: 'Your passport expires within 9 months. Plan to renew it soon.' };
  return { tone: 'ok', text: `Valid until ${day(expiry)}.` };
}
export const balance = (r) => Math.max(0, Number(r?.amount_due_mwk || 0) - Number(r?.amount_paid_mwk || 0));
export const pax = (r) => [r.adults && `${r.adults} adult${r.adults > 1 ? 's' : ''}`, r.children && `${r.children} child${r.children > 1 ? 'ren' : ''}`, r.infants && `${r.infants} infant${r.infants > 1 ? 's' : ''}`].filter(Boolean).join(', ');
export const tripTitle = (r) => (r.kind === 'flight' || r.origin ? `${r.origin || '?'} → ${r.destination || '?'}` : `${kindLabel(r.kind)}${r.destination ? ': ' + r.destination : ''}`);
export const phoneDigits = (p) => String(p || '').replace(/[^0-9+]/g, '');
