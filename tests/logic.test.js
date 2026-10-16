import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatKwacha,
  addMonths,
  daysInMonth,
  monthsUntil,
  monthSummary,
  monthlyAverages,
  suggestBudget,
  budgetStatus,
  billSchedule,
  loanStatus,
  loansSummary,
  goalPlan,
  safeToSpend,
  goalWarnings,
  projectMonthExpenses,
  monthlyReport,
} from '../src/logic.js';

const tx = (date, type, amount, category) => ({ id: `${date}-${category}-${amount}`, date, type, amount, category });

test('formatKwacha', () => {
  assert.equal(formatKwacha(250000), 'K250,000');
  assert.equal(formatKwacha(-1500.4), '-K1,500');
  assert.equal(formatKwacha(undefined), 'K0');
});

test('month helpers', () => {
  assert.equal(addMonths('2026-12', 1), '2027-01');
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(daysInMonth('2028-02'), 29);
  assert.equal(monthsUntil('2026-10-16', '2026-10-30'), 1);
  assert.equal(monthsUntil('2026-10-16', '2027-03-01'), 6);
});

test('monthSummary groups by category and ignores other months', () => {
  const s = monthSummary(
    [
      tx('2026-10-01', 'income', 250000, 'Salary'),
      tx('2026-10-02', 'expense', 80000, 'Rent'),
      tx('2026-10-03', 'expense', 5000, 'Transport'),
      tx('2026-10-05', 'expense', 3000, 'Transport'),
      tx('2026-09-30', 'expense', 9999, 'Transport'),
    ],
    '2026-10',
  );
  assert.equal(s.income, 250000);
  assert.equal(s.expenses, 88000);
  assert.equal(s.net, 162000);
  assert.deepEqual(s.byCategory, { Rent: 80000, Transport: 8000 });
});

test('monthlyAverages skips empty months and returns null with no history', () => {
  assert.equal(monthlyAverages([], '2026-10'), null);
  const avg = monthlyAverages(
    [tx('2026-09-01', 'income', 200000, 'Salary'), tx('2026-07-01', 'income', 100000, 'Salary')],
    '2026-10',
  );
  assert.equal(avg.months, 2);
  assert.equal(avg.income, 150000);
});

test('suggestBudget splits income and rounds to K500', () => {
  const b = suggestBudget(250000);
  assert.equal(b.Rent, 62500);
  assert.equal(b.Savings, 37500);
  for (const v of Object.values(b)) assert.equal(v % 500, 0);
});

test('budgetStatus flags overspending and bad pace but not fixed costs', () => {
  const status = budgetStatus(
    { Rent: 80000, Transport: 20000, Groceries: 50000, Savings: 30000 },
    [
      tx('2026-10-01', 'expense', 80000, 'Rent'),
      tx('2026-10-05', 'expense', 25000, 'Groceries'),
      tx('2026-10-08', 'expense', 21000, 'Transport'),
    ],
    '2026-10-10',
  );
  const by = Object.fromEntries(status.map((s) => [s.category, s]));
  assert.equal(by.Rent.status, 'ok');
  assert.equal(by.Transport.status, 'over');
  assert.equal(by.Groceries.status, 'pace');
  assert.equal(by.Savings, undefined);
});

test('billSchedule computes due dates and statuses', () => {
  const bills = [
    { id: 'a', name: 'Rent', amount: 80000, dueDay: 5 },
    { id: 'b', name: 'ESCOM', amount: 15000, dueDay: 18 },
    { id: 'c', name: 'Water', amount: 6000, dueDay: 31, paidMonths: ['2026-10'] },
    { id: 'd', name: 'School fees', amount: 60000, dueDay: 31 },
  ];
  const sched = billSchedule(bills, '2026-10-16');
  assert.deepEqual(
    sched.map((s) => [s.bill.id, s.status, s.dueDate]),
    [
      ['a', 'overdue', '2026-10-05'],
      ['b', 'due-soon', '2026-10-18'],
      ['d', 'upcoming', '2026-10-31'],
      ['c', 'paid', '2026-11-30'],
    ],
  );
});

test('loans track repayments, outstanding balance and overdue status', () => {
  const lent = { direction: 'lent', amount: 30000, dueDate: '2026-10-01', repayments: [{ amount: 10000 }] };
  const borrowed = { direction: 'borrowed', amount: 50000, repayments: [{ amount: 50000 }] };
  assert.deepEqual(loanStatus(lent, '2026-10-16'), { repaid: 10000, outstanding: 20000, settled: false, overdue: true });
  assert.equal(loanStatus(borrowed, '2026-10-16').settled, true);
  assert.deepEqual(loansSummary([lent, borrowed], '2026-10-16'), { owedToMe: 20000, iOwe: 0, overdueCount: 1 });
});

test('goalPlan works out the monthly amount needed', () => {
  const goal = { target: 300000, deadline: '2027-03-31', contributions: [{ amount: 60000, date: '2026-09-10' }] };
  const plan = goalPlan(goal, '2026-10-16');
  assert.equal(plan.monthsLeft, 6);
  assert.equal(plan.remaining, 240000);
  assert.equal(plan.requiredMonthly, 40000);
  assert.equal(goalPlan({ target: 100, contributions: [{ amount: 100, date: '2026-10-01' }] }, '2026-10-16').done, true);
});

test('safeToSpend holds back bills, debts and savings', () => {
  const r = safeToSpend({
    today: '2026-10-16',
    transactions: [
      tx('2026-10-01', 'income', 250000, 'Salary'),
      tx('2026-10-01', 'expense', 80000, 'Rent'),
      tx('2026-10-10', 'expense', 34000, 'Groceries'),
      tx('2026-10-16', 'expense', 2000, 'Transport'),
    ],
    bills: [{ amount: 15000, dueDay: 20 }],
    loans: [{ direction: 'borrowed', amount: 20000, dueDate: '2026-10-25', repayments: [] }],
    goals: [{ target: 120000, deadline: '2027-03-31', contributions: [] }],
  });
  // 250000 - 114000 spent before today - 15000 bill - 20000 debt - 20000 savings = 81000
  assert.equal(r.available, 81000);
  assert.equal(r.daysLeft, 16);
  assert.equal(r.perDay, 81000 / 16);
  assert.equal(r.leftToday, 81000 / 16 - 2000);
  assert.equal(r.shortfall, 0);
});

test('safeToSpend spreads a lump sum paid today over the rest of the month', () => {
  const r = safeToSpend({
    today: '2026-10-01',
    transactions: [tx('2026-10-01', 'income', 250000, 'Salary'), tx('2026-10-01', 'expense', 80000, 'Rent')],
  });
  assert.equal(r.spentToday, 0);
  assert.equal(r.perDay, 170000 / 31);
});

test('safeToSpend reports a shortfall instead of a negative daily amount', () => {
  const r = safeToSpend({
    today: '2026-10-20',
    transactions: [tx('2026-10-01', 'income', 50000, 'Salary'), tx('2026-10-02', 'expense', 60000, 'Rent')],
  });
  assert.equal(r.perDay, 0);
  assert.equal(r.shortfall, 10000);
});

test('goalWarnings warns when spending pace makes a goal unlikely', () => {
  const transactions = [
    tx('2026-10-01', 'income', 250000, 'Salary'),
    tx('2026-10-01', 'expense', 80000, 'Rent'),
    tx('2026-10-15', 'expense', 75000, 'Groceries'),
  ];
  // Everyday pace: 75000 over 15 days = 5000/day; 155000 spent + 16 more days * 5000 = 235000,
  // leaving 15000 against the 50000 a month the goal needs.
  const goals = [{ id: 'g', name: 'Phone', target: 300000, deadline: '2027-03-31', contributions: [] }];
  const r = goalWarnings({ transactions, goals, today: '2026-10-15' });
  assert.equal(r.requiredTotal, 50000);
  assert.equal(r.projectedSurplus, 15000);
  assert.equal(r.warnings[0].level, 'warning');
  assert.match(r.warnings[0].message, /Phone/);
  assert.equal(r.warnings.at(-1).level, 'tip');
});

test('projectMonthExpenses weights what was spent later in past months above the current pace', () => {
  const transactions = [
    // September: 20000 of everyday spending after the 10th. Family support is a lump sum and ignored.
    tx('2026-09-05', 'expense', 40000, 'Groceries'),
    tx('2026-09-20', 'expense', 20000, 'Groceries'),
    tx('2026-09-21', 'expense', 50000, 'Family support'),
    // October: 30000 of groceries by the 10th = 3000/day, so 63000 over the 21 days left.
    tx('2026-10-02', 'expense', 30000, 'Groceries'),
    tx('2026-10-03', 'expense', 20000, 'Family support'),
  ];
  // 50000 spent + 10000 unpaid bill + (2 * 20000 + 63000) / 3
  const projected = projectMonthExpenses(transactions, [{ amount: 10000, dueDay: 20 }], '2026-10-10');
  assert.ok(Math.abs(projected - (60000 + 103000 / 3)) < 1e-6);
});

test('goalWarnings stays quiet when goals are on track', () => {
  const r = goalWarnings({
    transactions: [tx('2026-10-01', 'income', 250000, 'Salary'), tx('2026-10-10', 'expense', 50000, 'Groceries')],
    goals: [{ id: 'g', name: 'School fees', target: 100000, deadline: '2026-12-31', contributions: [] }],
    today: '2026-10-15',
  });
  assert.deepEqual(r.warnings, []);
});

test('monthlyReport ranks categories and writes insights', () => {
  const rep = monthlyReport({
    monthKey: '2026-10',
    budgets: { Transport: 10000 },
    transactions: [
      tx('2026-09-02', 'expense', 5000, 'Transport'),
      tx('2026-10-01', 'income', 250000, 'Salary'),
      tx('2026-10-01', 'expense', 80000, 'Rent'),
      tx('2026-10-04', 'expense', 15000, 'Transport'),
    ],
  });
  assert.deepEqual(rep.categories.map((c) => c.category), ['Rent', 'Transport']);
  assert.ok(rep.insights.some((i) => i.includes('62%')));
  assert.ok(rep.insights.some((i) => i.includes('Transport went over budget by K5,000')));
  assert.ok(rep.insights.some((i) => i.includes('Transport rose by K10,000')));
});
