import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  SUGGESTED_SPLIT,
  formatKwacha as K,
  toDateKey,
  monthOf,
  addMonths,
  monthLabel,
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
  monthlyReport,
} from './logic.js';
import { load, save, newId, demoData, emptyData, parseBackup } from './store.js';

let data = load();
let tab = 'home';
let reportMonth = null;
let loanFilter = 'open';

const view = document.getElementById('view');
const sheet = document.getElementById('sheet');
const sheetForm = document.getElementById('sheet-form');
let sheetSubmit = null;

const today = () => toDateKey(new Date());

// ---------- helpers ----------

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function prettyDate(dateKey) {
  if (!dateKey) return '';
  const d = new Date(`${dateKey}T00:00:00`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: dateKey.slice(0, 4) === today().slice(0, 4) ? undefined : 'numeric' });
}

function options(list, selected) {
  return list.map((v) => `<option ${v === selected ? 'selected' : ''}>${esc(v)}</option>`).join('');
}

function toast(message) {
  const el = document.getElementById('toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

function commit(message) {
  if (!save(data)) toast('Could not save. Your phone storage may be full.');
  else if (message) toast(message);
  render();
}

function amountValue(raw) {
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function bar(fraction, cls = '') {
  const pct = Math.max(0, Math.min(1, fraction)) * 100;
  return `<div class="bar ${cls}"><i style="width:${pct.toFixed(1)}%"></i></div>`;
}

function alerts(list) {
  return list.map((a) => `<div class="alert ${a.level}">${esc(a.message)}</div>`).join('');
}

function amountInput(name, label, value = '', required = true) {
  return `<label for="f-${name}">${label}</label>
    <input id="f-${name}" name="${name}" inputmode="numeric" pattern="[0-9,. ]*" placeholder="K0" value="${esc(value)}" ${required ? 'required' : ''} />`;
}

// ---------- dialogs ----------

function openSheet(title, body, onSubmit) {
  document.getElementById('sheet-title').textContent = title;
  document.getElementById('sheet-body').innerHTML = body;
  sheetSubmit = onSubmit;
  if (!sheet.open) sheet.showModal();
  const first = sheet.querySelector('input:not([type=radio]):not([type=hidden]), select');
  if (first && first.id !== 'f-date') first.focus();
}

sheetForm.addEventListener('submit', (e) => {
  const action = e.submitter?.value;
  if (action === 'cancel' || !sheetSubmit) return;
  e.preventDefault();
  const form = Object.fromEntries(new FormData(sheetForm));
  const keepOpen = sheetSubmit(form, action) === false;
  if (!keepOpen) sheet.close();
});

document.getElementById('sheet-close').addEventListener('click', () => sheet.close());
sheet.addEventListener('close', () => {
  sheetSubmit = null;
});

function confirmSheet(title, message, onYes, yesLabel = 'Delete') {
  openSheet(
    title,
    `<p>${esc(message)}</p>
     <div class="actions"><button class="btn danger" value="yes">${esc(yesLabel)}</button>
     <button class="btn secondary" value="cancel" formnovalidate>Cancel</button></div>`,
    () => onYes(),
  );
}

// ---------- add / edit transaction ----------

function transactionSheet(existing = null, preset = {}) {
  const t = existing || { type: 'expense', date: today(), method: 'Cash', ...preset };
  const cats = (type) => (type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES);
  openSheet(
    existing ? 'Edit entry' : 'Add money in or out',
    `<div class="segmented" role="radiogroup">
       <input type="radio" name="type" id="ty-expense" value="expense" ${t.type !== 'income' ? 'checked' : ''} />
       <label for="ty-expense">Money out</label>
       <input type="radio" name="type" id="ty-income" value="income" ${t.type === 'income' ? 'checked' : ''} />
       <label for="ty-income">Money in</label>
     </div>
     ${amountInput('amount', 'Amount (MWK)', t.amount || '')}
     <label for="f-category">Category</label>
     <select id="f-category" name="category">${options(cats(t.type), t.category)}</select>
     <div class="grid2">
       <div><label for="f-date">Date</label><input id="f-date" type="date" name="date" value="${esc(t.date)}" max="${today()}" required /></div>
       <div><label for="f-method">Paid with</label><select id="f-method" name="method">${options(PAYMENT_METHODS, t.method)}</select></div>
     </div>
     <label for="f-note">Note (optional)</label>
     <input id="f-note" name="note" value="${esc(t.note)}" placeholder="e.g. Minibus to town" maxlength="80" />
     <div class="actions">
       <button class="btn block" value="save">${existing ? 'Save changes' : 'Save'}</button>
       ${existing ? '<button class="btn danger block" value="delete" formnovalidate>Delete entry</button>' : ''}
     </div>`,
    (f, action) => {
      if (action === 'delete') {
        data.transactions = data.transactions.filter((x) => x.id !== existing.id);
        commit('Entry deleted');
        return;
      }
      const amount = amountValue(f.amount);
      if (amount <= 0) {
        toast('Enter an amount greater than zero');
        return false;
      }
      const entry = { id: existing?.id || newId(), type: f.type, amount, category: f.category, date: f.date, method: f.method, note: f.note.trim() };
      if (existing) data.transactions = data.transactions.map((x) => (x.id === existing.id ? entry : x));
      else data.transactions.push(entry);
      commit(`${f.type === 'income' ? 'Income' : 'Expense'} of ${K(amount)} saved`);
    },
  );
  // Switch the category list when money in / out changes.
  sheet.querySelectorAll('input[name=type]').forEach((r) =>
    r.addEventListener('change', () => {
      sheet.querySelector('#f-category').innerHTML = options(cats(r.value));
    }),
  );
}

function transactionRow(t) {
  const sign = t.type === 'income' ? '+' : '−';
  return `<li class="row" data-action="edit-tx" data-id="${t.id}" role="button" tabindex="0">
    <div class="main">
      <div class="title">${esc(t.note || t.category)}</div>
      <div class="meta">${esc(t.category)} · ${prettyDate(t.date)} · ${esc(t.method || 'Cash')}</div>
    </div>
    <div class="amt ${t.type === 'income' ? 'pos' : ''}">${sign}${K(t.amount)}</div>
  </li>`;
}

function sortedTransactions(list) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

// ---------- views ----------

function homeView() {
  const now = today();
  const mk = monthOf(now);
  const safe = safeToSpend({ ...data, today: now });
  const summary = monthSummary(data.transactions, mk);
  const goals = goalWarnings({ ...data, today: now });
  const budgets = budgetStatus(data.budgets, data.transactions, now);
  const schedule = billSchedule(data.bills, now);
  const loans = loansSummary(data.loans, now);

  const warnings = [];
  for (const s of schedule) {
    if (s.status === 'overdue') warnings.push({ level: 'danger', message: `${s.bill.name} (${K(s.bill.amount)}) was due on ${prettyDate(s.dueDate)}.` });
  }
  for (const b of budgets) {
    if (b.status === 'over') warnings.push({ level: 'danger', message: `${b.category} is ${K(-b.left)} over budget this month.` });
  }
  const pacing = budgets.filter((b) => b.status === 'pace');
  if (pacing.length === 1) {
    const [b] = pacing;
    warnings.push({ level: 'warning', message: `At this pace ${b.category} will reach ${K(b.projected)}, above your ${K(b.limit)} budget.` });
  } else if (pacing.length) {
    warnings.push({ level: 'warning', message: `At this pace you will go over budget on ${pacing.map((b) => b.category).join(', ')}. See Budget for details.` });
  }
  warnings.push(...goals.warnings);
  if (loans.overdueCount) warnings.push({ level: 'warning', message: `${loans.overdueCount} loan${loans.overdueCount > 1 ? 's are' : ' is'} past the agreed repayment date.` });

  const name = data.settings.name ? `, ${esc(data.settings.name)}` : '';
  const soon = schedule.filter((s) => s.status === 'overdue' || s.status === 'due-soon');
  const recent = sortedTransactions(data.transactions).slice(0, 8);

  if (!data.transactions.length && !data.goals.length && !data.bills.length) {
    return `<h1>Moni${name}! 👋</h1>
      <div class="card">
        <p><strong>Ndalama</strong> helps you see where your Kwacha goes and how much you can safely spend each day.</p>
        <ol class="muted">
          <li>Tap <strong>+</strong> to record money you receive and spend.</li>
          <li>Add your monthly <strong>bills</strong> and <strong>savings goals</strong>.</li>
          <li>Check <strong>Home</strong> each day for your safe daily amount.</li>
        </ol>
        <div class="actions">
          <button class="btn" data-action="add-income">Record my income</button>
          <button class="btn secondary" data-action="demo">Try with sample data</button>
        </div>
      </div>
      <p class="muted">Everything is saved only on this phone and works without internet.</p>`;
  }

  const hero =
    safe.income === 0
      ? `<div class="card hero">
           <div class="label">Safe to spend today</div>
           <div class="big">—</div>
           <div class="sub">Record this month's income to see how much you can spend each day.</div>
           <div class="actions"><button class="btn secondary small" data-action="add-income">Add income</button></div>
         </div>`
      : `<div class="card hero ${safe.shortfall ? 'short' : ''}">
           <div class="label">${safe.shortfall ? 'Over your limit this month' : 'Safe to spend today'}</div>
           <div class="big">${safe.shortfall ? K(-safe.shortfall) : K(Math.max(0, safe.leftToday))}</div>
           <div class="sub">${
             safe.shortfall
               ? `After bills, debts and savings you are short by ${K(safe.shortfall)}. Spend only on essentials.`
               : safe.leftToday < 0
                 ? `You have spent ${K(-safe.leftToday)} more than today's ${K(safe.perDay)}. Tomorrow's amount will be lower.`
                 : `${K(safe.perDay)} a day for the next ${safe.daysLeft} day${safe.daysLeft > 1 ? 's' : ''}${safe.spentToday ? ` · ${K(safe.spentToday)} spent today` : ''}`
           }</div>
           <div class="breakdown">
             <span>Income this month</span><span>${K(safe.income)}</span>
             <span>Spent so far</span><span>−${K(safe.spent)}</span>
             ${safe.billsReserve ? `<span>Kept for unpaid bills</span><span>−${K(safe.billsReserve)}</span>` : ''}
             ${safe.debtReserve ? `<span>Kept for debts due</span><span>−${K(safe.debtReserve)}</span>` : ''}
             ${safe.savingsReserve ? `<span>Savings this month</span><span>−${K(safe.savingsReserve)}</span>` : ''}
           </div>
         </div>`;

  return `<h1>Moni${name}! 👋</h1>
    ${hero}
    <div class="tiles">
      <div class="tile"><div class="k">In (${esc(monthLabel(mk).split(' ')[0])})</div><div class="v pos">${K(summary.income)}</div></div>
      <div class="tile"><div class="k">Out</div><div class="v">${K(summary.expenses)}</div></div>
      <div class="tile"><div class="k">Left</div><div class="v ${summary.net < 0 ? 'neg' : ''}">${K(summary.net)}</div></div>
    </div>
    ${warnings.length ? `<h3>Needs attention</h3>${alerts(warnings)}` : ''}
    ${
      soon.length
        ? `<h3>Bills due</h3><div class="card"><ul class="list">${soon.map((s) => billRow(s)).join('')}</ul></div>`
        : ''
    }
    <h3>Recent</h3>
    <div class="card">${recent.length ? `<ul class="list">${recent.map(transactionRow).join('')}</ul>` : '<div class="empty">No entries yet. Tap + to add one.</div>'}</div>`;
}

function budgetView() {
  const now = today();
  const mk = monthOf(now);
  const status = budgetStatus(data.budgets, data.transactions, now);
  const summary = monthSummary(data.transactions, mk);
  const totalBudget = Object.entries(data.budgets).reduce((a, [c, v]) => a + (c === 'Savings' ? 0 : v), 0);
  const unbudgeted = Object.entries(summary.byCategory).filter(([c]) => !data.budgets[c]);

  return `<h1>Budget · ${esc(monthLabel(mk))}</h1>
    <div class="tiles">
      <div class="tile"><div class="k">Income</div><div class="v pos">${K(summary.income)}</div></div>
      <div class="tile"><div class="k">Budgeted</div><div class="v">${K(totalBudget)}</div></div>
      <div class="tile"><div class="k">Savings plan</div><div class="v">${K(data.budgets.Savings || 0)}</div></div>
    </div>
    ${
      summary.income && totalBudget + (data.budgets.Savings || 0) > summary.income
        ? alerts([{ level: 'warning', message: `Your budget (${K(totalBudget + (data.budgets.Savings || 0))}) is more than this month's income (${K(summary.income)}).` }])
        : ''
    }
    <div class="actions" style="margin-bottom:12px">
      <button class="btn" data-action="edit-budget">Set budget</button>
      <button class="btn secondary" data-action="suggest-budget">Suggest from my income</button>
    </div>
    ${
      status.length
        ? `<div class="card"><ul class="list">${status
            .map(
              (b) => `<li class="row" style="display:block">
                <div style="display:flex;justify-content:space-between;gap:8px">
                  <strong>${esc(b.category)}</strong>
                  <span>${K(b.spent)} <span class="muted">/ ${K(b.limit)}</span></span>
                </div>
                ${bar(b.pct, b.status)}
                <div class="meta">${
                  b.status === 'over'
                    ? `<span class="chip over">Over by ${K(-b.left)}</span>`
                    : b.status === 'pace'
                      ? `<span class="chip pace">On pace for ${K(b.projected)}</span> ${K(b.left)} left`
                      : `${K(b.left)} left`
                }</div>
              </li>`,
            )
            .join('')}</ul></div>`
        : '<div class="card empty">No budget yet. Tap “Suggest from my income” to start with a plan based on what you actually earn.</div>'
    }
    ${
      unbudgeted.length
        ? `<h3>Spending without a budget</h3><div class="card"><ul class="list">${unbudgeted
            .map(([c, v]) => `<li class="row"><div class="main">${esc(c)}</div><div class="amt">${K(v)}</div></li>`)
            .join('')}</ul></div>`
        : ''
    }`;
}

function budgetSheet(values = data.budgets, note = '') {
  const cats = [...EXPENSE_CATEGORIES.filter((c) => c !== 'Money lent'), 'Savings'];
  openSheet(
    'Monthly budget',
    `${note ? `<p class="muted">${esc(note)}</p>` : ''}
     <div class="budget-grid">
       ${cats
         .map(
           (c, i) => `<label for="b-${i}">${esc(c)}</label>
             <input id="b-${i}" name="${esc(c)}" inputmode="numeric" placeholder="K0" value="${values[c] ? values[c] : ''}" />`,
         )
         .join('')}
     </div>
     <div class="actions"><button class="btn block" value="save">Save budget</button></div>`,
    (f) => {
      const budgets = {};
      for (const [c, v] of Object.entries(f)) {
        const n = amountValue(v);
        if (n > 0) budgets[c] = n;
      }
      data.budgets = budgets;
      commit('Budget saved');
    },
  );
}

function suggestBudgetFlow() {
  const now = today();
  const mk = monthOf(now);
  const income = monthSummary(data.transactions, mk).income || monthlyAverages(data.transactions, mk)?.income || 0;
  openSheet(
    'Suggest a budget',
    `<p class="muted">We split your real monthly income like this. You can change any amount afterwards.</p>
     ${amountInput('income', 'Monthly income (MWK)', income ? Math.round(income) : '')}
     <ul class="list">${SUGGESTED_SPLIT.map(([c, p]) => `<li class="row"><div class="main">${esc(c)}</div><div class="meta">${p}%</div></li>`).join('')}</ul>
     <div class="actions"><button class="btn block" value="next">Next</button></div>`,
    (f) => {
      const value = amountValue(f.income);
      if (!value) {
        toast('Enter your monthly income');
        return false;
      }
      // Open the editor after this sheet has closed.
      setTimeout(() => budgetSheet(suggestBudget(value), `Suggested for an income of ${K(value)}. Adjust to fit your life, then save.`));
    },
  );
}

function goalsView() {
  const now = today();
  const { warnings, projectedSurplus, requiredTotal } = goalWarnings({ ...data, today: now });
  const byGoal = {};
  for (const w of warnings) if (w.goalId) (byGoal[w.goalId] ||= []).push(w);
  const tips = warnings.filter((w) => !w.goalId);

  const cards = data.goals.map((g) => {
    const p = goalPlan(g, now);
    return `<div class="card">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:baseline">
        <h2>${esc(g.name)}</h2>
        ${p.done ? '<span class="chip">Reached 🎉</span>' : g.deadline ? `<span class="muted">by ${prettyDate(g.deadline)}</span>` : ''}
      </div>
      ${bar(p.progress)}
      <div class="meta muted">${K(p.saved)} of ${K(p.target)} · ${Math.round(p.progress * 100)}%</div>
      ${
        !p.done && p.requiredMonthly
          ? `<p style="margin:8px 0 0">Save <strong>${K(p.requiredMonthly)}</strong> a month for ${p.monthsLeft} month${p.monthsLeft > 1 ? 's' : ''}
             (about ${K(p.requiredMonthly / 30)} a day).</p>`
          : ''
      }
      ${byGoal[g.id] ? `<div style="margin-top:8px">${alerts(byGoal[g.id])}</div>` : ''}
      <div class="actions">
        ${p.done ? '' : `<button class="btn small" data-action="contribute" data-id="${g.id}">Add savings</button>`}
        <button class="btn ghost small" data-action="edit-goal" data-id="${g.id}">Edit</button>
        <button class="btn ghost small" data-action="delete-goal" data-id="${g.id}">Delete</button>
      </div>
    </div>`;
  });

  return `<h1>Savings goals</h1>
    ${
      data.goals.length && projectedSurplus !== null
        ? `<div class="tiles" style="grid-template-columns:1fr 1fr">
             <div class="tile"><div class="k">Goals need / month</div><div class="v">${K(requiredTotal)}</div></div>
             <div class="tile"><div class="k">You're on course to have left</div><div class="v ${projectedSurplus < requiredTotal ? 'neg' : 'pos'}">${K(projectedSurplus)}</div></div>
           </div>`
        : ''
    }
    ${alerts(tips)}
    ${cards.join('') || '<div class="card empty">Saving for a phone, school fees, a car or a house? Add a goal and we will tell you how much to put aside each month, and warn you if your spending puts it at risk.</div>'}
    <button class="btn block" data-action="new-goal">+ New goal</button>`;
}

function goalSheet(goal = null) {
  openSheet(
    goal ? 'Edit goal' : 'New savings goal',
    `<label for="f-name">What are you saving for?</label>
     <input id="f-name" name="name" required maxlength="40" list="goal-ideas" value="${esc(goal?.name)}" placeholder="e.g. New phone" />
     <datalist id="goal-ideas"><option>New phone</option><option>School fees</option><option>Car</option><option>House / Plot</option><option>Emergency fund</option><option>Business stock</option><option>Wedding</option></datalist>
     ${amountInput('target', 'Target amount (MWK)', goal?.target || '')}
     <label for="f-deadline">Target date</label>
     <input id="f-deadline" type="date" name="deadline" min="${today()}" value="${esc(goal?.deadline)}" required />
     ${goal ? '' : amountInput('saved', 'Already saved (optional)', '', false)}
     <div class="actions"><button class="btn block" value="save">Save goal</button></div>`,
    (f) => {
      const target = amountValue(f.target);
      if (!target) {
        toast('Enter a target amount');
        return false;
      }
      if (goal) {
        Object.assign(goal, { name: f.name.trim(), target, deadline: f.deadline });
      } else {
        const saved = amountValue(f.saved);
        data.goals.push({
          id: newId(),
          name: f.name.trim(),
          target,
          deadline: f.deadline,
          // An opening balance is dated before this month so it doesn't count as this month's saving.
          contributions: saved ? [{ amount: saved, date: `${addMonths(monthOf(today()), -1)}-01` }] : [],
        });
      }
      commit('Goal saved');
    },
  );
}

function contributeSheet(goal) {
  const p = goalPlan(goal, today());
  openSheet(
    `Add to “${goal.name}”`,
    `${amountInput('amount', 'Amount saved (MWK)', p.requiredMonthly ? Math.round(p.requiredMonthly) : '')}
     <label for="f-date">Date</label><input id="f-date" type="date" name="date" value="${today()}" max="${today()}" required />
     <p class="muted">This money is set aside, so it is taken out of your safe daily amount.</p>
     <div class="actions"><button class="btn block" value="save">Save</button></div>`,
    (f) => {
      const amount = amountValue(f.amount);
      if (!amount) return false;
      goal.contributions = [...(goal.contributions || []), { amount, date: f.date }];
      commit(`${K(amount)} added to ${goal.name}`);
    },
  );
}

function billRow(s, editable = false) {
  const label = { overdue: 'Overdue', 'due-soon': s.daysLeft === 0 ? 'Due today' : `In ${s.daysLeft} day${s.daysLeft > 1 ? 's' : ''}`, upcoming: 'Upcoming', paid: 'Paid' }[s.status];
  return `<li class="row">
    <div class="main">
      <div class="title">${esc(s.bill.name)}</div>
      <div class="meta"><span class="chip ${s.status}">${label}</span> ${s.status === 'paid' ? 'next' : 'due'} ${prettyDate(s.dueDate)}</div>
    </div>
    <div style="text-align:right">
      <div class="amt">${K(s.bill.amount)}</div>
      ${s.status !== 'paid' ? `<button class="btn small secondary" data-action="pay-bill" data-id="${s.bill.id}">Mark paid</button>` : ''}
    </div>
    ${editable ? `<button class="btn ghost small" data-action="edit-bill" data-id="${s.bill.id}" aria-label="Edit ${esc(s.bill.name)}">✎</button>` : ''}
  </li>`;
}

function billsView() {
  const now = today();
  const schedule = billSchedule(data.bills, now);
  const unpaid = schedule.filter((s) => s.status !== 'paid').reduce((a, s) => a + s.bill.amount, 0);
  const notifyState = 'Notification' in window ? Notification.permission : 'unsupported';
  return `<h1>Bills & reminders</h1>
    <div class="tiles" style="grid-template-columns:1fr 1fr">
      <div class="tile"><div class="k">Monthly bills</div><div class="v">${K(data.bills.reduce((a, b) => a + b.amount, 0))}</div></div>
      <div class="tile"><div class="k">Still to pay this month</div><div class="v ${unpaid ? 'neg' : 'pos'}">${K(unpaid)}</div></div>
    </div>
    ${
      notifyState === 'default'
        ? `<div class="alert info">Get a reminder on your phone when a bill is due. <button class="btn small secondary" data-action="enable-notify">Turn on reminders</button></div>`
        : ''
    }
    <div class="card">${
      schedule.length
        ? `<ul class="list">${schedule.map((s) => billRow(s, true)).join('')}</ul>`
        : '<div class="empty">Add rent, ESCOM, water, school fees or any bill you pay every month. We will remind you before it is due.</div>'
    }</div>
    <button class="btn block" data-action="new-bill">+ New bill</button>`;
}

function billSheet(bill = null) {
  openSheet(
    bill ? 'Edit bill' : 'New monthly bill',
    `<label for="f-name">Bill name</label>
     <input id="f-name" name="name" required maxlength="40" value="${esc(bill?.name)}" placeholder="e.g. ESCOM electricity" />
     ${amountInput('amount', 'Amount (MWK)', bill?.amount || '')}
     <div class="grid2">
       <div><label for="f-day">Due day of month</label><input id="f-day" name="dueDay" type="number" min="1" max="31" required value="${esc(bill?.dueDay || '')}" /></div>
       <div><label for="f-category">Category</label><select id="f-category" name="category">${options(EXPENSE_CATEGORIES, bill?.category || 'Rent')}</select></div>
     </div>
     <div class="actions">
       <button class="btn block" value="save">Save bill</button>
       ${bill ? '<button class="btn danger block" value="delete" formnovalidate>Delete bill</button>' : ''}
     </div>`,
    (f, action) => {
      if (action === 'delete') {
        data.bills = data.bills.filter((b) => b.id !== bill.id);
        commit('Bill deleted');
        return;
      }
      const values = { name: f.name.trim(), amount: amountValue(f.amount), dueDay: Number(f.dueDay), category: f.category };
      if (bill) Object.assign(bill, values);
      else data.bills.push({ id: newId(), paidMonths: [], ...values });
      commit('Bill saved');
    },
  );
}

function payBillSheet(bill) {
  openSheet(
    `Pay ${bill.name}`,
    `${amountInput('amount', 'Amount paid (MWK)', bill.amount)}
     <div class="grid2">
       <div><label for="f-date">Date</label><input id="f-date" type="date" name="date" value="${today()}" max="${today()}" required /></div>
       <div><label for="f-method">Paid with</label><select id="f-method" name="method">${options(PAYMENT_METHODS, 'Airtel Money')}</select></div>
     </div>
     <label class="checkbox"><input type="checkbox" name="record" checked /> Also record as an expense</label>
     <div class="actions"><button class="btn block" value="save">Mark as paid</button></div>`,
    (f) => {
      const mk = monthOf(today());
      bill.paidMonths = [...new Set([...(bill.paidMonths || []), mk])];
      if (f.record) {
        data.transactions.push({ id: newId(), type: 'expense', amount: amountValue(f.amount), category: bill.category, date: f.date, method: f.method, note: bill.name });
      }
      commit(`${bill.name} marked as paid`);
    },
  );
}

function loansView() {
  const now = today();
  const s = loansSummary(data.loans, now);
  const list = data.loans
    .map((loan) => ({ loan, st: loanStatus(loan, now) }))
    .filter(({ st }) => (loanFilter === 'open' ? !st.settled : st.settled))
    .sort((a, b) => Number(b.st.overdue) - Number(a.st.overdue) || (a.loan.dueDate || '9').localeCompare(b.loan.dueDate || '9'));

  return `<h1>Loans & debts</h1>
    <div class="tiles" style="grid-template-columns:1fr 1fr">
      <div class="tile"><div class="k">People owe me</div><div class="v pos">${K(s.owedToMe)}</div></div>
      <div class="tile"><div class="k">I owe</div><div class="v ${s.iOwe ? 'neg' : ''}">${K(s.iOwe)}</div></div>
    </div>
    <div class="segmented" style="margin-bottom:12px">
      <input type="radio" name="lf" id="lf-open" ${loanFilter === 'open' ? 'checked' : ''} data-action="loan-filter" value="open" /><label for="lf-open">Open</label>
      <input type="radio" name="lf" id="lf-done" ${loanFilter === 'done' ? 'checked' : ''} data-action="loan-filter" value="done" /><label for="lf-done">Settled</label>
    </div>
    ${
      list.length
        ? list
            .map(
              ({ loan, st }) => `<div class="card">
          <div style="display:flex;justify-content:space-between;gap:8px">
            <div>
              <h2>${esc(loan.person)}</h2>
              <div class="muted">${loan.direction === 'lent' ? 'Owes you' : 'You owe'} · since ${prettyDate(loan.date)}</div>
            </div>
            <div style="text-align:right">
              <div class="amt ${loan.direction === 'lent' ? 'pos' : 'neg'}" style="font-size:1.15rem">${K(st.outstanding)}</div>
              <div class="muted">of ${K(loan.amount)}</div>
            </div>
          </div>
          ${bar(loan.amount ? st.repaid / loan.amount : 0)}
          <div class="meta muted">
            ${st.settled ? '<span class="chip">Settled</span>' : st.overdue ? `<span class="chip overdue">Overdue since ${prettyDate(loan.dueDate)}</span>` : loan.dueDate ? `Due ${prettyDate(loan.dueDate)}` : 'No due date'}
            ${loan.note ? ` · ${esc(loan.note)}` : ''}
          </div>
          ${
            (loan.repayments || []).length
              ? `<details style="margin-top:6px"><summary class="muted">${loan.repayments.length} repayment${loan.repayments.length > 1 ? 's' : ''}</summary>
                 <ul class="list">${loan.repayments.map((r) => `<li class="row"><div class="main meta">${prettyDate(r.date)}</div><div class="amt">${K(r.amount)}</div></li>`).join('')}</ul></details>`
              : ''
          }
          <div class="actions">
            ${st.settled ? '' : `<button class="btn small" data-action="repay" data-id="${loan.id}">Record repayment</button>`}
            <button class="btn ghost small" data-action="delete-loan" data-id="${loan.id}">Delete</button>
          </div>
        </div>`,
            )
            .join('')
        : `<div class="card empty">${loanFilter === 'open' ? 'No open loans. Record money you lend to friends and relatives, or money you borrow, so nothing is forgotten.' : 'No settled loans yet.'}</div>`
    }
    <div class="actions">
      <button class="btn" style="flex:1" data-action="new-loan" data-dir="lent">+ I lent money</button>
      <button class="btn secondary" style="flex:1" data-action="new-loan" data-dir="borrowed">+ I borrowed money</button>
    </div>`;
}

function loanSheet(direction) {
  const lent = direction === 'lent';
  openSheet(
    lent ? 'Money I lent' : 'Money I borrowed',
    `<label for="f-person">${lent ? 'Who did you lend to?' : 'Who did you borrow from?'}</label>
     <input id="f-person" name="person" required maxlength="40" placeholder="${lent ? 'e.g. Brother, Chisomo' : 'e.g. Village bank, Uncle'}" />
     ${amountInput('amount', 'Amount (MWK)')}
     <div class="grid2">
       <div><label for="f-date">Date</label><input id="f-date" type="date" name="date" value="${today()}" max="${today()}" required /></div>
       <div><label for="f-due">${lent ? 'Promised back by' : 'Must repay by'}</label><input id="f-due" type="date" name="dueDate" /></div>
     </div>
     <label for="f-note">Note (optional)</label><input id="f-note" name="note" maxlength="80" />
     <label class="checkbox"><input type="checkbox" name="record" checked /> Also record as ${lent ? 'an expense (money out)' : 'income (money in)'}</label>
     <div class="actions"><button class="btn block" value="save">Save</button></div>`,
    (f) => {
      const amount = amountValue(f.amount);
      if (!amount) return false;
      data.loans.push({ id: newId(), direction, person: f.person.trim(), amount, date: f.date, dueDate: f.dueDate || '', note: f.note.trim(), repayments: [] });
      if (f.record) {
        data.transactions.push({
          id: newId(),
          type: lent ? 'expense' : 'income',
          amount,
          category: lent ? 'Money lent' : 'Borrowed money',
          date: f.date,
          method: 'Cash',
          note: `${lent ? 'Lent to' : 'Borrowed from'} ${f.person.trim()}`,
        });
      }
      commit('Loan saved');
    },
  );
}

function repaySheet(loan) {
  const st = loanStatus(loan, today());
  const lent = loan.direction === 'lent';
  openSheet(
    lent ? `${loan.person} paid back` : `Repay ${loan.person}`,
    `${amountInput('amount', `Amount (outstanding ${K(st.outstanding)})`, st.outstanding)}
     <label for="f-date">Date</label><input id="f-date" type="date" name="date" value="${today()}" max="${today()}" required />
     <label class="checkbox"><input type="checkbox" name="record" checked /> Also record as ${lent ? 'income' : 'an expense'}</label>
     <div class="actions"><button class="btn block" value="save">Save repayment</button></div>`,
    (f) => {
      const amount = Math.min(amountValue(f.amount), st.outstanding);
      if (!amount) return false;
      loan.repayments = [...(loan.repayments || []), { amount, date: f.date }];
      if (f.record) {
        data.transactions.push({
          id: newId(),
          type: lent ? 'income' : 'expense',
          amount,
          category: lent ? 'Loan repaid to me' : 'Debt repayment',
          date: f.date,
          method: 'Cash',
          note: `${lent ? 'Repaid by' : 'Repaid to'} ${loan.person}`,
        });
      }
      commit(amount === st.outstanding ? 'Loan fully settled 🎉' : 'Repayment saved');
    },
  );
}

function reportView() {
  const mk = reportMonth || monthOf(today());
  const rep = monthlyReport({ ...data, monthKey: mk });
  const { current: c, previous: p } = rep;
  const isCurrent = mk === monthOf(today());
  const diff = (now, before) => {
    if (!before) return '';
    const d = now - before;
    return `<div class="meta">${d >= 0 ? '▲' : '▼'} ${K(Math.abs(d))} vs last month</div>`;
  };
  const txs = sortedTransactions(data.transactions.filter((t) => monthOf(t.date) === mk));
  const max = rep.categories[0]?.amount || 1;

  return `<div class="month-nav">
      <button class="btn ghost" data-action="month" data-step="-1" aria-label="Previous month">‹ Prev</button>
      <h1 style="margin:0">${esc(monthLabel(mk))}</h1>
      <button class="btn ghost" data-action="month" data-step="1" ${isCurrent ? 'disabled' : ''} aria-label="Next month">Next ›</button>
    </div>
    <div class="tiles">
      <div class="tile"><div class="k">Money in</div><div class="v pos">${K(c.income)}</div>${diff(c.income, p.income)}</div>
      <div class="tile"><div class="k">Money out</div><div class="v">${K(c.expenses)}</div>${diff(c.expenses, p.expenses)}</div>
      <div class="tile"><div class="k">Left over</div><div class="v ${c.net < 0 ? 'neg' : 'pos'}">${K(c.net)}</div></div>
    </div>
    <div class="card"><ul style="margin:0;padding-left:18px">${rep.insights.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
    ${
      rep.categories.length
        ? `<h3>Where the money went</h3><div class="card"><ul class="list">${rep.categories
            .map(
              (cat) => `<li class="row" style="display:block">
              <div style="display:flex;justify-content:space-between;gap:8px">
                <span>${esc(cat.category)} <span class="muted">${Math.round(cat.share * 100)}%</span></span>
                <strong>${K(cat.amount)}</strong>
              </div>
              ${bar(cat.amount / max, cat.budget && cat.amount > cat.budget ? 'over' : '')}
              ${cat.budget ? `<div class="meta">Budget ${K(cat.budget)}${cat.amount > cat.budget ? ` · over by ${K(cat.amount - cat.budget)}` : ''}</div>` : ''}
            </li>`,
            )
            .join('')}</ul></div>`
        : ''
    }
    ${
      Object.keys(c.incomeByCategory).length
        ? `<h3>Where the money came from</h3><div class="card"><ul class="list">${Object.entries(c.incomeByCategory)
            .sort((a, b) => b[1] - a[1])
            .map(([cat, v]) => `<li class="row"><div class="main">${esc(cat)}</div><div class="amt pos">${K(v)}</div></li>`)
            .join('')}</ul></div>`
        : ''
    }
    ${rep.saved ? `<h3>Saved towards goals</h3><div class="card"><strong>${K(rep.saved)}</strong></div>` : ''}
    <h3>All entries (${txs.length})</h3>
    <div class="card">${txs.length ? `<ul class="list">${txs.map(transactionRow).join('')}</ul>` : '<div class="empty">Nothing recorded this month.</div>'}</div>`;
}

function settingsSheet() {
  openSheet(
    'Settings',
    `<label for="f-name">Your name</label>
     <input id="f-name" name="name" value="${esc(data.settings.name)}" maxlength="30" placeholder="Optional" />
     <div class="actions"><button class="btn block" value="save">Save</button></div>
     <h3>Backup</h3>
     <p class="muted">Your data is stored only on this phone. Download a backup now and then, or to move to a new phone.</p>
     <div class="actions">
       <button type="button" class="btn secondary" data-action="export">Download backup</button>
       <label class="btn secondary" style="margin:0">Restore backup<input type="file" accept="application/json,.json" id="import-file" hidden /></label>
     </div>
     <h3>Other</h3>
     <div class="actions">
       <button type="button" class="btn secondary" data-action="demo">Load sample data</button>
       <button type="button" class="btn danger" data-action="wipe">Erase all data</button>
     </div>`,
    (f) => {
      data.settings.name = f.name.trim();
      commit('Saved');
    },
  );
  sheet.querySelector('#import-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      data = parseBackup(await file.text());
      sheet.close();
      commit('Backup restored');
    } catch (err) {
      toast(err.message || 'Could not read that file');
    }
  });
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ndalama-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ---------- reminders ----------

// Show a phone notification for overdue and soon-due bills, at most once a day.
async function remindBills() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = today();
  if (data.settings.lastReminder === now) return;
  const due = billSchedule(data.bills, now, 2).filter((s) => s.status === 'overdue' || s.status === 'due-soon');
  const owed = data.loans.filter((l) => loanStatus(l, now).overdue);
  if (!due.length && !owed.length) return;
  const lines = [
    ...due.map((s) => `${s.bill.name}: ${K(s.bill.amount)} ${s.status === 'overdue' ? 'overdue' : s.daysLeft === 0 ? 'due today' : `due in ${s.daysLeft} day(s)`}`),
    ...owed.map((l) => `${l.direction === 'lent' ? `${l.person} owes you` : `You owe ${l.person}`} ${K(loanStatus(l, now).outstanding)} (overdue)`),
  ];
  const reg = await navigator.serviceWorker?.getRegistration();
  const opts = { body: lines.join('\n'), icon: 'icons/icon.svg', tag: 'ndalama-bills' };
  if (reg) reg.showNotification('Ndalama reminders', opts);
  else new Notification('Ndalama reminders', opts);
  data.settings.lastReminder = now;
  save(data);
}

// ---------- rendering & events ----------

const views = { home: homeView, budget: budgetView, goals: goalsView, bills: billsView, loans: loansView, report: reportView };

function render() {
  view.innerHTML = views[tab]();
  document.querySelectorAll('.tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
}

document.querySelector('.tabbar').addEventListener('click', (e) => {
  const btn = e.target.closest('button[data-tab]');
  if (!btn) return;
  tab = btn.dataset.tab;
  if (tab === 'report') reportMonth = null;
  render();
  window.scrollTo(0, 0);
});

document.getElementById('add-btn').addEventListener('click', () => transactionSheet());
document.getElementById('settings-btn').addEventListener('click', settingsSheet);

const find = (list, id) => list.find((x) => x.id === id);

const actions = {
  'edit-tx': (el) => transactionSheet(find(data.transactions, el.dataset.id)),
  'add-income': () => transactionSheet(null, { type: 'income', category: 'Salary', method: 'Bank' }),
  demo: () => {
    const load = () => {
      data = demoData(today());
      sheet.close();
      commit('Sample data loaded');
    };
    if (data.transactions.length) confirmSheet('Load sample data?', 'This replaces everything you have recorded.', load, 'Replace my data');
    else load();
  },
  'edit-budget': () => budgetSheet(),
  'suggest-budget': suggestBudgetFlow,
  'new-goal': () => goalSheet(),
  'edit-goal': (el) => goalSheet(find(data.goals, el.dataset.id)),
  contribute: (el) => contributeSheet(find(data.goals, el.dataset.id)),
  'delete-goal': (el) => {
    const g = find(data.goals, el.dataset.id);
    confirmSheet('Delete goal?', `“${g.name}” and its savings history will be removed.`, () => {
      data.goals = data.goals.filter((x) => x !== g);
      commit('Goal deleted');
    });
  },
  'new-bill': () => billSheet(),
  'edit-bill': (el) => billSheet(find(data.bills, el.dataset.id)),
  'pay-bill': (el) => payBillSheet(find(data.bills, el.dataset.id)),
  'enable-notify': async () => {
    const result = await Notification.requestPermission();
    toast(result === 'granted' ? 'Bill reminders turned on' : 'Reminders not allowed');
    render();
    remindBills();
  },
  'new-loan': (el) => loanSheet(el.dataset.dir),
  repay: (el) => repaySheet(find(data.loans, el.dataset.id)),
  'delete-loan': (el) => {
    const l = find(data.loans, el.dataset.id);
    confirmSheet('Delete loan?', `The record for ${l.person} will be removed. Linked income and expense entries stay.`, () => {
      data.loans = data.loans.filter((x) => x !== l);
      commit('Loan deleted');
    });
  },
  'loan-filter': (el) => {
    loanFilter = el.value;
    render();
  },
  month: (el) => {
    reportMonth = addMonths(reportMonth || monthOf(today()), Number(el.dataset.step));
    render();
  },
  export: exportBackup,
  wipe: () =>
    confirmSheet('Erase all data?', 'Every entry, goal, bill and loan on this phone will be deleted. Download a backup first if you may need it.', () => {
      data = emptyData();
      commit('All data erased');
    }, 'Erase everything'),
};

function handleAction(e) {
  const el = e.target.closest('[data-action]');
  if (!el || !actions[el.dataset.action]) return;
  if (el.tagName === 'BUTTON' && el.type === 'submit') e.preventDefault();
  actions[el.dataset.action](el);
}

document.addEventListener('click', handleAction);
view.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button]')) {
    e.preventDefault();
    handleAction(e);
  }
});

// Re-render when the app comes back to the foreground on a new day.
let renderedDay = today();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && renderedDay !== today()) {
    renderedDay = today();
    render();
    remindBills();
  }
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

render();
remindBills();
