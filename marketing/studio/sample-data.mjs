// Sample data for marketing captures: a calm, typical month on a K250,000
// salary. Prints what Ndalama's own calculations show for it (so every number
// on screen is real), and writes the JSON for capture.cjs.
// Usage: node sample-data.mjs [TODAY=today] [OUT_JSON]   (months and dates follow TODAY)
import { writeFileSync } from 'node:fs';
import { safeToSpend, goalWarnings, goalPlan, budgetStatus, monthlyReport, LUMP_SUM_CATEGORIES } from '../../src/logic.js';

const TODAY = process.argv[2] || new Date().toISOString().slice(0, 10);
let n = 0;
const id = () => `ad${(n++).toString(36).padStart(4, '0')}`;
const tx = (date, type, amount, category, method, note) => ({ id: id(), date, type, amount, category, method, note });

// Months and dates relative to TODAY, so the screens always show the present.
const [Y, M, D] = TODAY.split('-').map(Number);
const ym = (off) => { const d = new Date(Date.UTC(Y, M - 1 + off, 1)); return d.toISOString().slice(0, 7); };
const on = (off, day) => `${ym(off)}-${String(day).padStart(2, '0')}`;
const lastDay = (off) => { const d = new Date(Date.UTC(Y, M + off, 0)); return d.toISOString().slice(0, 10); };
const upTo = (list) => list.filter((x) => x.date <= TODAY);

const month = (m, upToDay) =>
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
    .filter(([d]) => d <= upToDay)
    .map(([d, ...rest]) => tx(`${m}-${String(d).padStart(2, '0')}`, ...rest));

const day = D;
const paid = (dueDay) => (day >= dueDay ? [ym(-1), ym(0)] : [ym(-1)]);
const data = {
  // This month so far, as it looks on TODAY: nothing bought yet today, and in
  // the first week only the big monthly payments (the app can't judge a pace
  // from two or three days, so small early buys would look like overspending).
  transactions: [
    ...month(ym(-1), 31),
    ...month(ym(0), day - 1).filter((t) => day >= 8 || t.type === 'income' || LUMP_SUM_CATEGORIES.has(t.category)),
  ],
  budgets: {
    Rent: 60000, Groceries: 70000, Transport: 25000, Electricity: 15000, Water: 6000,
    'Airtime & Data': 12000, 'Family support': 20000, 'Church & Giving': 12000, 'Eating out': 10000, Savings: 20000,
  },
  goals: [
    { id: id(), name: 'New phone', target: 250000, deadline: lastDay(5), contributions: [{ amount: 60000, date: on(-1, 2) }] },
    { id: id(), name: "Children's school fees", target: 120000, deadline: `${Y + 1}-01-15`, contributions: [{ amount: 45000, date: on(-1, 2) }] },
  ],
  bills: [
    { id: id(), name: 'House rent', amount: 60000, dueDay: 1, category: 'Rent', paidMonths: paid(1) },
    { id: id(), name: 'ESCOM electricity', amount: 15000, dueDay: 5, category: 'Electricity', paidMonths: paid(5) },
    { id: id(), name: 'Water board', amount: 6000, dueDay: 13, category: 'Water', paidMonths: [ym(-1)] },
    { id: id(), name: 'Internet bundle', amount: 10000, dueDay: 25, category: 'Airtime & Data', paidMonths: [ym(-1)] },
  ],
  loans: [
    { id: id(), direction: 'lent', person: 'Chikondi (cousin)', amount: 20000, date: on(-1, 10), dueDate: on(1, 15), note: 'For transport to Blantyre', repayments: upTo([{ amount: 5000, date: on(-1, 28) }]) },
    { id: id(), direction: 'borrowed', person: 'Village bank', amount: 50000, date: on(-1, 3), dueDate: on(2, 3), note: 'Small loan', repayments: upTo([{ amount: 10000, date: on(0, 3) }]) },
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
console.log(monthlyReport({ ...data, monthKey: ym(-1) }).insights);
writeFileSync(process.argv[3] || '/dev/null', JSON.stringify(data));
