import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  money, signedMoney, pct, timeAgo, timeUntil, utcClock, normaliseUrl, parseConnectionQr,
  isInsecureRemote, journalText, journalTone, priceRange, signalStatus, signalResult, ntfyLinks,
} from '../src/format.js';

test('money formatting', () => {
  assert.equal(money(10234.5), '$10,234.50');
  assert.equal(money(-12), '-$12.00');
  assert.equal(signedMoney(45.1), '+$45.10');
  assert.equal(signedMoney(-3), '-$3.00');
  assert.equal(money(null), '-');
  assert.equal(pct(-1.234), '-1.23%');
});

test('times from Nelson are UTC', () => {
  const now = Date.parse('2026-03-06T10:00:00Z');
  assert.equal(timeAgo('2026-03-06T09:58:00', now), '2 min ago');
  assert.equal(timeUntil('2026-03-06T13:30:00', now), 'in 3 h 30 min');
  assert.equal(timeAgo('2026-03-06T10:30:00', now), 'in 30 min');
  assert.equal(utcClock('2026-03-06T13:30:00'), 'Fri 13:30 UTC');
});

test('connection url and QR', () => {
  assert.equal(normaliseUrl(' nelson.tail1.ts.net/ '), 'https://nelson.tail1.ts.net');
  assert.equal(normaliseUrl('http://192.168.1.5:8765/api'), 'http://192.168.1.5:8765');
  assert.equal(normaliseUrl('http://desktop-cmh441j.tail0ac9cf.ts.net'), 'https://desktop-cmh441j.tail0ac9cf.ts.net');
  assert.equal(normaliseUrl('http://pc.tail1.ts.net:8765'), 'http://pc.tail1.ts.net:8765');
  assert.deepEqual(parseConnectionQr('{"url":"https://a.ts.net","key":"abcdefghijklmnopqrstuvwxyz"}'),
    { url: 'https://a.ts.net', key: 'abcdefghijklmnopqrstuvwxyz' });
  assert.equal(parseConnectionQr('hello'), null);
  assert.equal(parseConnectionQr('{"url":"x","key":"short"}'), null);
});

test('warns about plain http over the internet only', () => {
  assert.equal(isInsecureRemote('https://1.2.3.4'), false);
  assert.equal(isInsecureRemote('http://192.168.1.20:8765'), false);
  assert.equal(isInsecureRemote('http://100.101.5.6:8765'), false); // Tailscale
  assert.equal(isInsecureRemote('http://203.0.113.9:8765'), true);
  assert.equal(isInsecureRemote('http://myvps.example.com:8765'), true);
});

test('journal wording and colours', () => {
  assert.equal(journalText({ event: 'closed', pnl: '120.5' }), 'Trade closed +$120.50');
  assert.equal(journalText({ event: 'order', side: 'SELL', lots: '0.12', price: '2404' }), 'Order placed: SELL 0.12 lots @ 2404.00');
  assert.equal(journalTone('closed', '-20'), 'bad');
  assert.equal(journalTone('order'), 'info');
  assert.equal(journalText({ event: 'start', details: 'mode=demo account=demo trading=True' }),
    'Nelson started: demo mode, demo account, placing orders');
});

test('chart price range includes trade lines', () => {
  const r = priceRange([[0, 10, 12, 9, 11]], [15]);
  assert.ok(r.lo < 9 && r.hi > 15);
});

test('signal status and result', () => {
  assert.deepEqual(signalStatus('tp'), { label: 'Take profit', tone: 'good' });
  assert.equal(signalStatus('sl').tone, 'bad');
  assert.equal(signalResult({ pnl: 120.5 }), '+$120.50');
  assert.equal(signalResult({ pnl: null, result_r: 2.5 }), '+2.5R');
  assert.equal(signalResult({ pnl: null, result_r: -1 }), '-1R');
  assert.equal(signalResult({ status: 'waiting' }), '');
});

test('ntfy subscribe links', () => {
  assert.deepEqual(ntfyLinks('https://ntfy.sh/', 'nelson-abc'), { app: 'ntfy://ntfy.sh/nelson-abc', web: 'https://ntfy.sh/nelson-abc' });
});

test('missed and learning helpers', async () => {
  const { wouldBe, hoursLabel, windowText, recordText } = await import('../src/format.js');
  assert.equal(wouldBe({}), null);
  assert.deepEqual(wouldBe({ sim: { status: 'tp', result_r: 2.5 } }), { label: 'Would have hit the target', tone: 'good', result: '+2.5R' });
  assert.equal(wouldBe({ sim: { status: 'sl', result_r: -1 } }).result, '-1R');
  assert.equal(wouldBe({ sim: { status: 'waiting', result_r: null } }).result, '');
  assert.equal(hoursLabel(0.25), '15 min');
  assert.equal(hoursLabel(3.25), '3.3 h');
  assert.equal(hoursLabel(72), '3 days');
  assert.equal(windowText({ trades: 0, setups: 0 }), 'No setups formed');
  assert.equal(windowText({ trades: 0, setups: 2 }), 'No tradeable setups, 2 skipped by filters');
  assert.equal(windowText({ trades: 3, wins: 1, losses: 1, open: 0, no_fill: 1, result_r: 1.5 }),
    '3 would-be trades: 1 target, 1 stop, 1 no fill · +1.5R');
  assert.equal(windowText({ trades: 1, wins: 0, losses: 0, open: 1, no_fill: 0, result_r: 0 }), '1 would-be trade: 1 still open');
  assert.equal(recordText({ wins: 3, losses: 5, avg_r: -0.31 }), '3W / 5L · -0.31R avg');
  assert.equal(signalStatus('offline').label, 'Nelson was off');
});
