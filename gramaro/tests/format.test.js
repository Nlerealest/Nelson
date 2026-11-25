const test = require('node:test');
const assert = require('node:assert');

test('format helpers', async () => {
  const f = await import('../src/format.js');
  assert.equal(f.mk(2450000), 'MK 2,450,000');
  assert.equal(f.mk(null), '—');
  assert.equal(f.parseAmount('MK 1,250,000'), 1250000);
  assert.equal(f.parseAmount('abc'), null);
  assert.equal(f.parseDate('2026-12-20'), '2026-12-20');
  assert.equal(f.parseDate('5/1/2027'), '2027-01-05');
  assert.equal(f.parseDate('31/02/2027'), null);
  assert.equal(f.day('2026-12-20'), '20 Dec 2026');
  assert.notEqual(f.when(Date.now() + 5 * 3600e3), 'just now');
  const now = Date.parse('2026-11-25T10:00:00Z');
  assert.equal(f.holdLeft('2026-11-25T09:00:00Z', now).expired, true);
  assert.equal(f.holdLeft('2026-11-25T13:30:00Z', now).text, '3 h 30 min left');
  assert.equal(f.holdLeft('2026-11-27T12:00:00Z', now).text, '2 d 2 h left');
  assert.equal(f.passportCheck('2027-03-01', '2026-12-20', new Date(now)).tone, 'bad');
  assert.equal(f.passportCheck('2030-01-01', '2026-12-20', new Date(now)).tone, 'ok');
  assert.equal(f.passportCheck(null).tone, 'warn');
  assert.equal(f.balance({ amount_due_mwk: 100, amount_paid_mwk: 40 }), 60);
  assert.equal(f.pax({ adults: 2, children: 1, infants: 0 }), '2 adults, 1 child');
  assert.equal(f.tripTitle({ kind: 'flight', origin: 'LLW', destination: 'DXB' }), 'LLW → DXB');
  assert.equal(f.tripTitle({ kind: 'visa', destination: 'United Kingdom' }), 'Visa help: United Kingdom');
});
