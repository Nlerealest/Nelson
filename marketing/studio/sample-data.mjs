// Sample data for marketing captures: one month in the life of a persona from
// personas.mjs, dated around TODAY. Prints what Ndalama's own calculations
// show for it (so every number on screen is real), and writes the JSON for
// capture.cjs.
// Usage: node sample-data.mjs [TODAY=today] [OUT_JSON] [PERSONA=corporate|business|family|young]
import { writeFileSync } from 'node:fs';
import { safeToSpend, goalWarnings, goalPlan, budgetStatus, monthlyReport, LUMP_SUM_CATEGORIES } from '../../src/logic.js';
import { PERSONAS } from './personas.mjs';

const TODAY = process.argv[2] || new Date().toISOString().slice(0, 10);
const PERSONA = process.env.PERSONA || process.argv[4] || 'corporate';
const P = PERSONAS[PERSONA] || PERSONAS.corporate;
let n = 0;
const id = () => `ad${(n++).toString(36).padStart(4, '0')}`;
const tx = (date, type, amount, category, method, note) => ({ id: id(), date, type, amount, category, method, note });

// Months and dates relative to TODAY, so the screens always show the present.
const [Y, M, D] = TODAY.split('-').map(Number);
const ym = (off) => new Date(Date.UTC(Y, M - 1 + off, 1)).toISOString().slice(0, 7);
const on = (off, day) => `${ym(off)}-${String(day).padStart(2, '0')}`;
const lastDay = (off) => new Date(Date.UTC(Y, M + off, 0)).toISOString().slice(0, 10);
const upTo = (list) => list.filter((x) => x.date <= TODAY);
const month = (m, upToDay) => P.month.filter(([d]) => d <= upToDay).map(([d, ...rest]) => tx(`${m}-${String(d).padStart(2, '0')}`, ...rest));
const paid = (dueDay) => (D >= dueDay ? [ym(-1), ym(0)] : [ym(-1)]);
const round = (x) => Math.round(x / 1000) * 1000;

const data = {
  // This month so far, as it looks on TODAY: nothing bought yet today, and in
  // the first week only the big monthly payments (the app can't judge a pace
  // from two or three days, so small early buys would look like overspending).
  transactions: [
    ...month(ym(-1), 31),
    ...month(ym(0), D - 1).filter((t) => D >= 8 || t.type === 'income' || LUMP_SUM_CATEGORIES.has(t.category)),
  ],
  budgets: P.budgets,
  goals: P.goals.map(([name, target, months, saved]) => ({ id: id(), name, target, deadline: lastDay(months), contributions: [{ amount: saved, date: on(-1, 2) }] })),
  bills: P.bills.map(([name, amount, dueDay, category]) => ({ id: id(), name, amount, dueDay, category, paidMonths: dueDay <= 5 ? paid(dueDay) : [ym(-1)] })),
  loans: [
    { id: id(), direction: 'lent', person: P.lent[0], amount: P.lent[1], date: on(-1, 10), dueDate: on(1, 15), note: 'To be paid back', repayments: upTo([{ amount: round(P.lent[1] / 4), date: on(-1, 28) }]) },
    { id: id(), direction: 'borrowed', person: P.borrowed[0], amount: P.borrowed[1], date: on(-1, 3), dueDate: on(10, 3), note: 'Monthly repayments', repayments: upTo([{ amount: round(P.borrowed[1] / 10), date: on(0, 3) }]) },
  ],
  settings: { name: P.name },
};

console.log('persona', PERSONA, '-', P.who, '- income a month', P.month.filter((t) => t[1] === 'income').reduce((a, t) => a + t[2], 0));
const s = safeToSpend({ ...data, today: TODAY });
console.log('safe', Math.round(s.perDay), 'leftToday', Math.round(s.leftToday), 'days', s.daysLeft, 'available', s.available);
const g = goalWarnings({ ...data, today: TODAY });
console.log('surplus', Math.round(g.projectedSurplus), 'needed', Math.round(g.requiredTotal));
for (const w of g.warnings) console.log(' -', w.level, w.message);
for (const goal of data.goals) console.log(' goal', goal.name, Math.round(goalPlan(goal, TODAY).requiredMonthly));
for (const b of budgetStatus(data.budgets, data.transactions, TODAY)) if (b.status !== 'ok') console.log(' budget', b.category, b.status, Math.round(b.projected));
console.log(monthlyReport({ ...data, monthKey: ym(-1) }).insights);
writeFileSync(process.argv[3] || '/dev/null', JSON.stringify(data));
