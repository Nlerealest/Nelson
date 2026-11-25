import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, daysBetween, deadlinesFor, openDeadlines, quarterEndMonths, weekday, ymd } from '../src/lib/calendar.ts';
import { sampleSales, summariseSales } from '../src/lib/sales.ts';

test('Date keys handle month and year overflow', () => {
  assert.equal(ymd(2026, 13, 14), '2027-01-14');
  assert.equal(addDays('2026-06-30', 180), '2026-12-27');
  assert.equal(daysBetween('2026-11-25', '2026-12-14'), 19);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(weekday('2026-11-25'), 3); // a Wednesday
});

test('Quarter ends follow the financial year end', () => {
  assert.deepEqual(quarterEndMonths(6), [9, 12, 3, 6]);
  assert.deepEqual(quarterEndMonths(12), [3, 6, 9, 12]);
  assert.deepEqual(quarterEndMonths(8), [11, 2, 5, 8]);
});

test('An employer registered for VAT: PAYE and WHT on the 14th, VAT on the 25th', () => {
  const list = deadlinesFor(['employer', 'vat'], '2026-11-25', { horizonDays: 40, pastDays: 0 });
  const keys = list.map((d) => d.key);
  assert.deepEqual(keys, ['vat:2026-11-25', 'paye:2026-12-14', 'wht:2026-12-14', 'vat:2026-12-25']);
  const vatToday = list[0];
  assert.equal(vatToday.daysLeft, 0);
  assert.deepEqual(vatToday.period, { kind: 'month', year: 2026, month: 10 });
});

test('Quarterly deadlines: FBT on the 14th, presumptive tax on the 20th, provisional tax on the 25th', () => {
  const fbt = deadlinesFor(['employer'], '2026-12-20', { horizonDays: 30, pastDays: 0 }).filter((d) => d.id === 'fbt');
  assert.deepEqual(fbt.map((d) => d.due), ['2027-01-14']);
  assert.deepEqual(fbt[0].period, { kind: 'quarter', year: 2026, endMonth: 12 });

  const presumptive = deadlinesFor(['smallBusiness'], '2026-11-25', { horizonDays: 200, pastDays: 0 }).map((d) => d.due);
  assert.deepEqual(presumptive, ['2027-01-20', '2027-04-20']);

  const provisional = deadlinesFor(['company'], '2026-11-25', { horizonDays: 100, pastDays: 0 }).filter((d) => d.id === 'provisional');
  assert.deepEqual(provisional.map((d) => d.due), ['2027-01-25']);
});

test('Annual return: 180 days after the financial year ends', () => {
  const june = deadlinesFor(['company'], '2026-11-25', { horizonDays: 60, pastDays: 0 }).filter((d) => d.id === 'annualReturn');
  assert.deepEqual(june.map((d) => d.due), ['2026-12-27']);
  const march = deadlinesFor(['company'], '2026-08-01', { horizonDays: 120, pastDays: 0, yearEndMonth: 3 }).filter((d) => d.id === 'annualReturn');
  assert.deepEqual(march.map((d) => d.due), ['2026-09-27']);
});

test('Nothing for people with no matching profile; importers have no fixed deadlines', () => {
  assert.deepEqual(deadlinesFor([], '2026-11-25'), []);
  assert.deepEqual(deadlinesFor(['importer'], '2026-11-25'), []);
});

test('Done deadlines drop out; overdue ones stay until done', () => {
  const list = deadlinesFor(['vat'], '2026-11-27', { horizonDays: 40, pastDays: 10 });
  assert.equal(list[0].key, 'vat:2026-11-25');
  assert.equal(list[0].daysLeft, -2);
  assert.equal(openDeadlines(list, {})[0].key, 'vat:2026-11-25');
  // VAT-registered businesses also withhold tax on payments they make.
  assert.deepEqual(
    openDeadlines(list, { 'vat:2026-11-25': true }).map((d) => d.key),
    ['wht:2026-12-14', 'vat:2026-12-25'],
  );
});

test('Employees see when their employer pays their PAYE, but past ones disappear', () => {
  const list = deadlinesFor(['employee'], '2026-12-16', { horizonDays: 40, pastDays: 10 });
  assert.deepEqual(list.map((d) => d.key), ['payslip:2026-12-14', 'payslip:2027-01-14']);
  assert.ok(list.every((d) => d.informational));
  assert.deepEqual(openDeadlines(list, {}).map((d) => d.key), ['payslip:2027-01-14']);
});

test('Sales record totals', () => {
  const s = summariseSales(
    [
      { id: '1', date: '2026-11-03', amount: 100_000 },
      { id: '2', date: '2026-10-15', amount: 50_000 },
      { id: '3', date: '2026-09-30', amount: 25_000 },
      { id: '4', date: '2025-11-20', amount: 10_000 },
      { id: '5', date: '2025-11-26', amount: 1_000 },
      { id: '6', date: '2026-12-01', amount: 999_999 },
    ],
    '2026-11-25',
  );
  assert.equal(s.thisMonth, 100_000);
  assert.equal(s.thisQuarter, 150_000);
  assert.equal(s.last12Months, 176_000);
  assert.deepEqual(s.byMonth.map(([m]) => m), ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11']);
  assert.equal(s.byMonth[5][1], 100_000);
  const sample = summariseSales(sampleSales('2026-11-25'), '2026-11-25');
  assert.ok(sample.last12Months > 8_000_000 && sample.last12Months < 10_000_000);
});
