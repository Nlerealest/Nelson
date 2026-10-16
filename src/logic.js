// Pure money-management calculations. No DOM access here so everything can be
// unit tested in Node and reused by the UI.
//
// Conventions:
//   - Dates are local "YYYY-MM-DD" strings, months are "YYYY-MM" strings.
//   - Amounts are numbers in Malawi Kwacha (MWK).
//   - Functions that depend on "now" take a `today` date string argument.

export const EXPENSE_CATEGORIES = [
  'Rent',
  'Groceries',
  'Transport',
  'Electricity',
  'Water',
  'Airtime & Data',
  'Family support',
  'School fees',
  'Health',
  'Church & Giving',
  'Eating out',
  'Clothing',
  'Entertainment',
  'Debt repayment',
  'Money lent',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Business',
  'Ganyu (casual work)',
  'Farming',
  'Gift / Remittance',
  'Loan repaid to me',
  'Borrowed money',
  'Other income',
];

export const PAYMENT_METHODS = ['Cash', 'Airtel Money', 'TNM Mpamba', 'Bank', 'Other'];

// Lumpy, once-a-month costs. These are not extrapolated from the daily
// spending pace, otherwise paying rent on the 1st would look like a disaster.
export const FIXED_CATEGORIES = new Set(['Rent', 'Electricity', 'Water', 'School fees']);

// One-off amounts that are not part of day-to-day spending, so they are never
// used to estimate a daily spending rate.
export const LUMP_SUM_CATEGORIES = new Set([...FIXED_CATEGORIES, 'Family support', 'Debt repayment', 'Money lent']);

// Default split used when suggesting a budget from someone's real income.
// Percentages add up to 100.
export const SUGGESTED_SPLIT = [
  ['Rent', 25],
  ['Groceries', 20],
  ['Transport', 10],
  ['Electricity', 5],
  ['Water', 2],
  ['Airtime & Data', 3],
  ['Family support', 8],
  ['Health', 3],
  ['Church & Giving', 4],
  ['Other', 5],
  ['Savings', 15],
];

// ---------- formatting & dates ----------

export function formatKwacha(amount) {
  const n = Math.round(Number(amount) || 0);
  const sign = n < 0 ? '-' : '';
  return `${sign}K${Math.abs(n).toLocaleString('en-US')}`;
}

export function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function monthOf(dateKey) {
  return dateKey.slice(0, 7);
}

export function daysInMonth(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function addMonths(monthKey, n) {
  const [y, m] = monthKey.split('-').map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, '0')}`;
}

export function monthLabel(monthKey) {
  const [y, m] = monthKey.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

export function daysBetween(fromKey, toKey) {
  const a = new Date(`${fromKey}T00:00:00`);
  const b = new Date(`${toKey}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

// Number of calendar months from `today` until `deadline`, counting the
// current month. A deadline later this month counts as 1.
export function monthsUntil(today, deadline) {
  const a = monthOf(today).split('-').map(Number);
  const b = monthOf(deadline).split('-').map(Number);
  return (b[0] - a[0]) * 12 + (b[1] - a[1]) + 1;
}

function sum(list, fn = (x) => x) {
  return list.reduce((acc, x) => acc + (Number(fn(x)) || 0), 0);
}

// ---------- transactions ----------

export function monthSummary(transactions, monthKey) {
  const byCategory = {};
  const incomeByCategory = {};
  let income = 0;
  let expenses = 0;
  for (const t of transactions) {
    if (monthOf(t.date) !== monthKey) continue;
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      income += amt;
      incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + amt;
    } else {
      expenses += amt;
      byCategory[t.category] = (byCategory[t.category] || 0) + amt;
    }
  }
  return { month: monthKey, income, expenses, net: income - expenses, byCategory, incomeByCategory };
}

// Average income and expenses over the `months` full months before `monthKey`
// that actually have data. Returns null when there is no history yet.
export function monthlyAverages(transactions, monthKey, months = 3) {
  const summaries = [];
  for (let i = 1; i <= months; i++) {
    const s = monthSummary(transactions, addMonths(monthKey, -i));
    if (s.income > 0 || s.expenses > 0) summaries.push(s);
  }
  if (!summaries.length) return null;
  return {
    months: summaries.length,
    income: sum(summaries, (s) => s.income) / summaries.length,
    expenses: sum(summaries, (s) => s.expenses) / summaries.length,
  };
}

// ---------- budgets ----------

export function suggestBudget(monthlyIncome) {
  const budget = {};
  for (const [category, pct] of SUGGESTED_SPLIT) {
    // Round to the nearest K500 so the numbers are easy to remember.
    budget[category] = Math.round((monthlyIncome * pct) / 100 / 500) * 500;
  }
  return budget;
}

export function budgetStatus(budgets, transactions, today) {
  const mk = monthOf(today);
  const summary = monthSummary(transactions, mk);
  const dim = daysInMonth(mk);
  const day = Number(today.slice(8, 10));
  return Object.entries(budgets)
    .filter(([category, limit]) => category !== 'Savings' && limit > 0)
    .map(([category, limit]) => {
      const spent = summary.byCategory[category] || 0;
      const projected = LUMP_SUM_CATEGORIES.has(category) ? spent : (spent / day) * dim;
      let status = 'ok';
      if (spent > limit) status = 'over';
      else if (projected > limit * 1.05) status = 'pace';
      return {
        category,
        limit,
        spent,
        left: limit - spent,
        pct: limit ? spent / limit : 0,
        projected,
        status,
      };
    });
}

// ---------- bills ----------

function billDueDate(bill, monthKey) {
  const day = Math.min(Number(bill.dueDay) || 1, daysInMonth(monthKey));
  return `${monthKey}-${String(day).padStart(2, '0')}`;
}

export function isBillPaid(bill, monthKey) {
  return (bill.paidMonths || []).includes(monthKey);
}

// Every bill with its next due date and a status: overdue, due-soon, upcoming
// or paid (for this month). Sorted with the most urgent first.
export function billSchedule(bills, today, soonDays = 5) {
  const mk = monthOf(today);
  const order = { overdue: 0, 'due-soon': 1, upcoming: 2, paid: 3 };
  return bills
    .map((bill) => {
      const paid = isBillPaid(bill, mk);
      const dueDate = paid ? billDueDate(bill, addMonths(mk, 1)) : billDueDate(bill, mk);
      const daysLeft = daysBetween(today, dueDate);
      let status = 'upcoming';
      if (paid) status = 'paid';
      else if (daysLeft < 0) status = 'overdue';
      else if (daysLeft <= soonDays) status = 'due-soon';
      return { bill, dueDate, daysLeft, status };
    })
    .sort((a, b) => order[a.status] - order[b.status] || a.daysLeft - b.daysLeft);
}

export function unpaidBillsTotal(bills, monthKey) {
  return sum(bills.filter((b) => !isBillPaid(b, monthKey)), (b) => b.amount);
}

// ---------- loans & debts ----------
// loan.direction: 'lent' (someone owes me) or 'borrowed' (I owe someone).

export function loanStatus(loan, today) {
  const repaid = sum(loan.repayments || [], (r) => r.amount);
  const outstanding = Math.max(0, (Number(loan.amount) || 0) - repaid);
  const settled = outstanding === 0;
  const overdue = !settled && !!loan.dueDate && loan.dueDate < today;
  return { repaid, outstanding, settled, overdue };
}

export function loansSummary(loans, today) {
  let owedToMe = 0;
  let iOwe = 0;
  let overdueCount = 0;
  for (const loan of loans) {
    const s = loanStatus(loan, today);
    if (loan.direction === 'lent') owedToMe += s.outstanding;
    else iOwe += s.outstanding;
    if (s.overdue) overdueCount++;
  }
  return { owedToMe, iOwe, overdueCount };
}

// Debt repayments I should make this month: anything I owe that is due by the
// end of this month (or already overdue).
export function debtDueThisMonth(loans, today) {
  const end = billDueDate({ dueDay: 31 }, monthOf(today));
  return sum(
    loans.filter((l) => l.direction === 'borrowed' && l.dueDate && l.dueDate <= end),
    (l) => loanStatus(l, today).outstanding,
  );
}

// ---------- savings goals ----------

export function goalSaved(goal) {
  return sum(goal.contributions || [], (c) => c.amount);
}

export function goalContributionsInMonth(goal, monthKey) {
  return sum((goal.contributions || []).filter((c) => monthOf(c.date) === monthKey), (c) => c.amount);
}

export function goalPlan(goal, today) {
  const saved = goalSaved(goal);
  const target = Number(goal.target) || 0;
  const remaining = Math.max(0, target - saved);
  const done = remaining === 0;
  let monthsLeft = null;
  let requiredMonthly = 0;
  if (!done && goal.deadline) {
    monthsLeft = Math.max(1, monthsUntil(today, goal.deadline));
    // Money already put aside this month counts towards this month's share.
    const thisMonth = goalContributionsInMonth(goal, monthOf(today));
    requiredMonthly = (remaining + thisMonth) / monthsLeft;
  }
  return {
    saved,
    target,
    remaining,
    done,
    progress: target ? Math.min(1, saved / target) : 0,
    monthsLeft,
    requiredMonthly,
    pastDeadline: !done && !!goal.deadline && goal.deadline < today,
  };
}

// ---------- safe daily spending ----------

// How much can be spent per day for the rest of the month while still paying
// every unpaid bill, debts due this month, and this month's savings target.
export function safeToSpend({ transactions, bills = [], goals = [], loans = [], today }) {
  const mk = monthOf(today);
  const summary = monthSummary(transactions, mk);
  const dim = daysInMonth(mk);
  const day = Number(today.slice(8, 10));
  const daysLeft = dim - day + 1;

  // Lump sums paid today (rent, a debt repayment...) come out of the month's
  // pool rather than wiping out today's allowance.
  const spentToday = sum(
    transactions.filter((t) => t.type !== 'income' && t.date === today && !LUMP_SUM_CATEGORIES.has(t.category)),
    (t) => t.amount,
  );
  const spentBeforeToday = summary.expenses - spentToday;

  const billsReserve = unpaidBillsTotal(bills, mk);
  const debtReserve = debtDueThisMonth(loans, today);
  const savedThisMonth = sum(goals, (g) => goalContributionsInMonth(g, mk));
  const savingsTarget = sum(goals, (g) => goalPlan(g, today).requiredMonthly);
  // Whatever was already moved to savings is gone from the wallet; any target
  // not yet met still needs to be held back.
  const savingsReserve = Math.max(savedThisMonth, savingsTarget);

  const available = summary.income - spentBeforeToday - billsReserve - debtReserve - savingsReserve;
  const perDay = Math.max(0, available) / daysLeft;

  return {
    income: summary.income,
    spent: summary.expenses,
    spentToday,
    billsReserve,
    debtReserve,
    savingsReserve,
    available,
    daysLeft,
    perDay,
    leftToday: perDay - spentToday,
    shortfall: available < 0 ? -available : 0,
  };
}

// ---------- savings-goal warnings ----------

// Estimate the full month's spending: what is already spent, plus unpaid
// bills, plus everyday spending for the days that remain. Spending is usually
// heavier just after payday, so when there is history we look at what was
// actually spent over the same remaining days in previous months, and weight
// that above simply extending this month's pace.
export function projectMonthExpenses(transactions, bills, today) {
  const mk = monthOf(today);
  const summary = monthSummary(transactions, mk);
  const day = Number(today.slice(8, 10));
  const daysRemaining = daysInMonth(mk) - day;
  const everyday = (txs) => sum(txs.filter((t) => t.type !== 'income' && !LUMP_SUM_CATEGORIES.has(t.category)), (t) => t.amount);

  const pace = (everyday(transactions.filter((t) => monthOf(t.date) === mk)) / day) * daysRemaining;
  const history = [1, 2, 3]
    .map((i) => addMonths(mk, -i))
    .filter((m) => transactions.some((t) => monthOf(t.date) === m));
  let rest = pace;
  if (history.length) {
    const later = transactions.filter((t) => history.includes(monthOf(t.date)) && Number(t.date.slice(8, 10)) > day);
    rest = ((2 * everyday(later)) / history.length + pace) / 3;
  }
  return summary.expenses + unpaidBillsTotal(bills, mk) + rest;
}

export function goalWarnings({ transactions, bills = [], goals = [], today }) {
  const mk = monthOf(today);
  const active = goals
    .map((goal) => ({ goal, plan: goalPlan(goal, today) }))
    .filter(({ plan }) => !plan.done);
  if (!active.length) return { warnings: [], projectedSurplus: null, requiredTotal: 0 };

  const summary = monthSummary(transactions, mk);
  const avg = monthlyAverages(transactions, mk);
  const expectedIncome = Math.max(summary.income, avg ? avg.income : 0);
  const projectedExpenses = projectMonthExpenses(transactions, bills, today);
  const projectedSurplus = expectedIncome - projectedExpenses;
  const requiredTotal = sum(active, (a) => a.plan.requiredMonthly);

  const warnings = [];
  for (const { goal, plan } of active) {
    if (plan.pastDeadline) {
      warnings.push({
        goalId: goal.id,
        level: 'danger',
        message: `"${goal.name}" passed its deadline with ${formatKwacha(plan.remaining)} still to save.`,
      });
      continue;
    }
    if (!plan.requiredMonthly) continue;
    // Share the projected surplus between goals in proportion to what each needs.
    const share = requiredTotal ? Math.max(0, projectedSurplus) * (plan.requiredMonthly / requiredTotal) : 0;
    if (share + 0.5 >= plan.requiredMonthly) continue;
    const gap = plan.requiredMonthly - share;
    if (share <= 0) {
      warnings.push({
        goalId: goal.id,
        level: 'danger',
        message: `At your current spending you will have nothing left to save for "${goal.name}" this month. It needs ${formatKwacha(plan.requiredMonthly)} a month.`,
        gap,
      });
    } else {
      const monthsNeeded = Math.ceil(plan.remaining / share);
      warnings.push({
        goalId: goal.id,
        level: 'warning',
        message: `"${goal.name}" is off track: it needs ${formatKwacha(plan.requiredMonthly)} a month but you are on course to save about ${formatKwacha(share)}. At this rate it takes ${monthsNeeded} months instead of ${plan.monthsLeft}.`,
        gap,
      });
    }
  }

  if (warnings.length) {
    const totalGap = sum(warnings, (w) => w.gap || 0);
    const top = Object.entries(summary.byCategory)
      .filter(([c]) => !FIXED_CATEGORIES.has(c))
      .sort((a, b) => b[1] - a[1])[0];
    if (top && totalGap > 0) {
      warnings.push({
        level: 'tip',
        message: `Tip: ${top[0]} is your biggest everyday cost this month (${formatKwacha(top[1])}). Cutting about ${formatKwacha(totalGap)} from spending this month would put your goals back on track.`,
      });
    }
  }
  return { warnings, projectedSurplus, requiredTotal, projectedExpenses, expectedIncome };
}

// ---------- monthly report ----------

export function monthlyReport({ transactions, budgets = {}, goals = [], monthKey }) {
  const current = monthSummary(transactions, monthKey);
  const previous = monthSummary(transactions, addMonths(monthKey, -1));
  const saved = sum(goals, (g) => goalContributionsInMonth(g, monthKey));

  const categories = Object.entries(current.byCategory)
    .map(([category, amount]) => ({
      category,
      amount,
      share: current.expenses ? amount / current.expenses : 0,
      budget: budgets[category] || 0,
      previous: previous.byCategory[category] || 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const insights = [];
  if (current.income === 0 && current.expenses === 0) {
    insights.push('No money recorded for this month yet.');
  } else {
    if (current.income > 0) {
      const rate = (current.income - current.expenses) / current.income;
      if (rate < 0) {
        insights.push(`You spent ${formatKwacha(-current.net)} more than you earned.`);
      } else {
        insights.push(`You kept ${Math.round(rate * 100)}% of your income (${formatKwacha(current.net)}).`);
      }
    }
    if (categories[0]) {
      insights.push(
        `Most money went to ${categories[0].category}: ${formatKwacha(categories[0].amount)} (${Math.round(categories[0].share * 100)}% of spending).`,
      );
    }
    for (const c of categories) {
      if (c.budget && c.amount > c.budget) {
        insights.push(`${c.category} went over budget by ${formatKwacha(c.amount - c.budget)}.`);
      }
    }
    const rises = categories
      .filter((c) => c.previous > 0 && c.amount - c.previous >= Math.max(5000, c.previous * 0.25))
      .slice(0, 2);
    for (const c of rises) {
      insights.push(`${c.category} rose by ${formatKwacha(c.amount - c.previous)} compared with last month.`);
    }
    if (saved > 0) insights.push(`You put ${formatKwacha(saved)} towards your savings goals.`);
  }

  return { current, previous, categories, saved, insights };
}
