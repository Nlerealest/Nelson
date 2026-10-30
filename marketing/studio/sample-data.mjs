// Sample data for marketing captures: a calm, typical month on a K250,000
// salary. Prints what Ndalama's own calculations show for it (so every number
// on screen is real), and writes the JSON for capture.cjs.
// Usage: node sample-data.mjs [TODAY=2026-10-13] [OUT_JSON]
import { writeFileSync } from 'node:fs';
import { safeToSpend, goalWarnings, goalPlan, budgetStatus, monthlyReport } from '../../src/logic.js';

const TODAY = process.argv[2] || '2026-10-10';
let n = 0;
const id = () => `ad${(n++).toString(36).padStart(4, '0')}`;
const tx = (date, type, amount, category, method, note) => ({ id: id(), date, type, amount, category, method, note });

const month = (m, upTo) =>
  [
    [1, 'income', 250000, 'Salary', 'Bank', 'Monthly salary'],
    [1, 'expense', 60000, 'Rent', 'Airtel Money', 'House rent'],
    [2, 'expense', 22000, 'Groceries', 'Cash', 'Maize flour, oil, sugar'],
    [3, 'expense', 3000, 'Airtime & Data', 'Airtel Money', 'Data bundle'],
    [4, 'expense', 4000, 'Transport', 'Cash', 'Minibus'],
    [5, 'expense', 15000, 'Electricity', 'TNM Mpamba', 'ESCOM units'],
    [6, 'expense', 20000, 'Family support', 'Airtel Money', 'Sent to mother'],
    [8, 'expense', 4000, 'Transport', 'Cash', 'Minibus'],
    [9, 'expense', 9000, 'Groceries', 'Cash', 'Vegetables and fish'],
    [11, 'expense', 5000, 'Church & Giving', 'Cash', 'Offering'],
    [14, 'expense', 2000, 'Airtime & Data', 'Airtel Money', 'Airtime'],
    [15, 'expense', 4000, 'Transport', 'Cash', 'Minibus'],
    [17, 'expense', 9000, 'Groceries', 'Cash', 'Groceries top-up'],
    [18, 'expense', 6000, 'Water', 'TNM Mpamba', 'Water board'],
    [22, 'expense', 4000, 'Transport', 'Cash', 'Minibus'],
    [24, 'expense', 5000, 'Eating out', 'Cash', 'Chips with friends'],
    [27, 'expense', 8000, 'Groceries', 'Cash', 'Groceries'],
  ]
    .filter(([d]) => d <= upTo)
    .map(([d, ...rest]) => tx(`${m}-${String(d).padStart(2, '0')}`, ...rest));

const day = Number(TODAY.slice(8, 10));
const data = {
  transactions: [...month('2026-09', 30), ...month('2026-10', day)],
  budgets: {
    Rent: 60000, Groceries: 70000, Transport: 25000, Electricity: 15000, Water: 6000,
    'Airtime & Data': 12000, 'Family support': 20000, 'Church & Giving': 12000, 'Eating out': 10000, Savings: 20000,
  },
  goals: [
    { id: id(), name: 'New phone', target: 250000, deadline: '2027-03-31', contributions: [{ amount: 60000, date: '2026-09-02' }] },
    { id: id(), name: "Children's school fees", target: 120000, deadline: '2027-01-15', contributions: [{ amount: 45000, date: '2026-09-02' }] },
  ],
  bills: [
    { id: id(), name: 'House rent', amount: 60000, dueDay: 1, category: 'Rent', paidMonths: ['2026-09', '2026-10'] },
    { id: id(), name: 'ESCOM electricity', amount: 15000, dueDay: 5, category: 'Electricity', paidMonths: ['2026-09', '2026-10'] },
    { id: id(), name: 'Water board', amount: 6000, dueDay: 13, category: 'Water', paidMonths: ['2026-09'] },
    { id: id(), name: 'Internet bundle', amount: 10000, dueDay: 25, category: 'Airtime & Data', paidMonths: ['2026-09'] },
  ],
  loans: [
    { id: id(), direction: 'lent', person: 'Chikondi (cousin)', amount: 20000, date: '2026-09-10', dueDate: '2026-11-15', note: 'For transport to Blantyre', repayments: [{ amount: 5000, date: '2026-09-28' }] },
    { id: id(), direction: 'borrowed', person: 'Village bank', amount: 50000, date: '2026-09-03', dueDate: '2026-12-03', note: 'Small loan', repayments: [{ amount: 10000, date: '2026-10-03' }] },
  ],
  settings: { name: 'Chisomo' },
};

const s = safeToSpend({ ...data, today: TODAY });
console.log('safe', Math.round(s.perDay), 'leftToday', Math.round(s.leftToday), 'days', s.daysLeft, 'available', s.available);
const g = goalWarnings({ ...data, today: TODAY });
console.log('surplus', Math.round(g.projectedSurplus), 'needed', Math.round(g.requiredTotal));
for (const w of g.warnings) console.log(' -', w.level, w.message);
for (const goal of data.goals) console.log(' goal', goal.name, Math.round(goalPlan(goal, TODAY).requiredMonthly));
for (const b of budgetStatus(data.budgets, data.transactions, TODAY)) if (b.status !== 'ok') console.log(' budget', b.category, b.status, Math.round(b.projected));
console.log(monthlyReport({ ...data, monthKey: '2026-09' }).insights);
writeFileSync(process.argv[3] || '/dev/null', JSON.stringify(data));
