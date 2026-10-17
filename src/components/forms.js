// Every form the app shows, presented in one bottom sheet. Screens open a form
// by name with openSheet('goal', { goalId }) and the host renders it here.

import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  PAYMENT_METHODS,
  SUGGESTED_SPLIT,
  addMonths,
  earnedIncome,
  formatKwacha as K,
  goalPlan,
  loanStatus,
  monthOf,
  monthSummary,
  monthlyAverages,
  suggestBudget,
} from '../logic';
import { newId, emptyData } from '../storage';
import { demoData } from '../demo';
import { exportBackup, importBackup } from '../backup';
import { useData } from '../data';
import { useTheme } from '../theme';
import {
  Actions,
  AmountField,
  Body,
  Button,
  Checkbox,
  DateField,
  Field,
  Grid2,
  Row,
  Section,
  Segmented,
  Select,
  amountValue,
} from './ui';

const asDate = (key) => new Date(`${key}T12:00:00`);

function TransactionForm({ id, preset = {}, close }) {
  const { data, today, update, toast } = useData();
  const existing = id ? data.transactions.find((t) => t.id === id) : null;
  const start = existing || { type: 'expense', date: today, method: 'Cash', category: 'Groceries', ...preset };
  const [f, setF] = useState({ ...start, amount: start.amount ? String(start.amount) : '', note: start.note || '' });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const cats = f.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const submit = () => {
    const amount = amountValue(f.amount);
    if (amount <= 0) return toast('Enter an amount greater than zero');
    const entry = { id: existing?.id || newId(), type: f.type, amount, category: f.category, date: f.date, method: f.method, note: f.note.trim() };
    update((d) => {
      d.transactions = existing ? d.transactions.map((x) => (x.id === entry.id ? entry : x)) : [...d.transactions, entry];
    }, `${f.type === 'income' ? 'Income' : 'Expense'} of ${K(amount)} saved`);
    close();
  };

  return (
    <>
      <Segmented
        value={f.type}
        onChange={(type) => setF((x) => ({ ...x, type, category: (type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES)[0] }))}
        options={[
          ['expense', 'Money out', 'danger'],
          ['income', 'Money in', 'primary'],
        ]}
      />
      <AmountField value={f.amount} onChangeText={set('amount')} autoFocus={!existing} />
      <Select label="Category" value={cats.includes(f.category) ? f.category : cats[0]} options={cats} onChange={set('category')} />
      <Grid2>
        <DateField value={f.date} onChange={set('date')} maximumDate={asDate(today)} />
        <Select label="Paid with" value={f.method} options={PAYMENT_METHODS} onChange={set('method')} />
      </Grid2>
      <Field label="Note (optional)" value={f.note} onChangeText={set('note')} placeholder="e.g. Minibus to town" maxLength={80} />
      <Actions>
        <Button block title={existing ? 'Save changes' : 'Save'} onPress={submit} style={{ flex: 1 }} />
      </Actions>
      {existing && (
        <Actions>
          <Button
            block
            kind="danger"
            title="Delete entry"
            style={{ flex: 1 }}
            onPress={() => {
              update((d) => {
                d.transactions = d.transactions.filter((x) => x.id !== existing.id);
              }, 'Entry deleted');
              close();
            }}
          />
        </Actions>
      )}
    </>
  );
}

const BUDGET_CATEGORIES = [...EXPENSE_CATEGORIES.filter((c) => c !== 'Money lent'), 'Savings'];

function BudgetForm({ values, note, close }) {
  const { data, update } = useData();
  const [f, setF] = useState(() =>
    Object.fromEntries(BUDGET_CATEGORIES.map((c) => [c, (values || data.budgets)[c] ? String((values || data.budgets)[c]) : ''])),
  );
  const t = useTheme();
  const total = Object.values(f).reduce((a, v) => a + amountValue(v), 0);
  return (
    <>
      {note ? <Body muted small>{note}</Body> : null}
      {BUDGET_CATEGORIES.map((c) => (
        <View key={c} style={styles.budgetRow}>
          <Text style={{ flex: 1, color: t.text }}>{c}</Text>
          <Field
            style={{ width: 130 }}
            value={f[c]}
            onChangeText={(v) => setF((x) => ({ ...x, [c]: v.replace(/[^0-9,.]/g, '') }))}
            keyboardType="numeric"
            placeholder="K0"
          />
        </View>
      ))}
      <Body muted small style={{ marginTop: 10 }}>Total: {K(total)}</Body>
      <Actions>
        <Button
          title="Save budget"
          style={{ flex: 1 }}
          onPress={() => {
            update((d) => {
              d.budgets = Object.fromEntries(Object.entries(f).map(([c, v]) => [c, amountValue(v)]).filter(([, v]) => v > 0));
            }, 'Budget saved');
            close();
          }}
        />
      </Actions>
    </>
  );
}

function SuggestBudgetForm({ close }) {
  const { data, today, openSheet, toast } = useData();
  const mk = monthOf(today);
  const known = earnedIncome(monthSummary(data.transactions, mk)) || monthlyAverages(data.transactions, mk)?.income || 0;
  const [income, setIncome] = useState(known ? String(Math.round(known)) : '');
  return (
    <>
      <Body muted small>We split your real monthly income like this. You can change any amount afterwards.</Body>
      <AmountField label="Monthly income (MWK)" value={income} onChangeText={setIncome} />
      <View style={{ marginTop: 8 }}>
        {SUGGESTED_SPLIT.map(([c, p], i) => (
          <Row key={c} title={c} right={<Body muted small>{p}%{amountValue(income) ? ` · ${K((amountValue(income) * p) / 100)}` : ''}</Body>} last={i === SUGGESTED_SPLIT.length - 1} />
        ))}
      </View>
      <Actions>
        <Button
          title="Next"
          style={{ flex: 1 }}
          onPress={() => {
            const value = amountValue(income);
            if (!value) return toast('Enter your monthly income');
            openSheet('budget', { values: suggestBudget(value), note: `Suggested for an income of ${K(value)}. Adjust to fit your life, then save.` });
          }}
        />
      </Actions>
    </>
  );
}

function GoalForm({ goalId, close }) {
  const { data, today, update, toast } = useData();
  const goal = goalId ? data.goals.find((g) => g.id === goalId) : null;
  const [f, setF] = useState({
    name: goal?.name || '',
    target: goal ? String(goal.target) : '',
    deadline: goal?.deadline || `${addMonths(monthOf(today), 6)}-28`,
    saved: '',
  });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  const ideas = ['New phone', 'School fees', 'Car', 'House / Plot', 'Emergency fund', 'Business stock'];
  return (
    <>
      <Field label="What are you saving for?" value={f.name} onChangeText={set('name')} placeholder="e.g. New phone" maxLength={40} />
      {!goal && (
        <View style={styles.ideas}>
          {ideas.map((i) => (
            <Button key={i} small kind="secondary" title={i} onPress={() => set('name')(i)} />
          ))}
        </View>
      )}
      <AmountField label="Target amount (MWK)" value={f.target} onChangeText={set('target')} />
      <DateField label="Target date" value={f.deadline} onChange={set('deadline')} minimumDate={asDate(today)} />
      {!goal && <AmountField label="Already saved (optional)" value={f.saved} onChangeText={set('saved')} />}
      <Actions>
        <Button
          title="Save goal"
          style={{ flex: 1 }}
          onPress={() => {
            const target = amountValue(f.target);
            if (!f.name.trim()) return toast('Give your goal a name');
            if (!target) return toast('Enter a target amount');
            update((d) => {
              if (goal) {
                Object.assign(d.goals.find((g) => g.id === goal.id), { name: f.name.trim(), target, deadline: f.deadline });
              } else {
                const saved = amountValue(f.saved);
                d.goals.push({
                  id: newId(),
                  name: f.name.trim(),
                  target,
                  deadline: f.deadline,
                  // An opening balance is dated last month so it doesn't count as this month's saving.
                  contributions: saved ? [{ amount: saved, date: `${addMonths(monthOf(today), -1)}-01` }] : [],
                });
              }
            }, 'Goal saved');
            close();
          }}
        />
      </Actions>
    </>
  );
}

function ContributeForm({ goalId, close }) {
  const { data, today, update } = useData();
  const goal = data.goals.find((g) => g.id === goalId);
  const plan = goalPlan(goal, today);
  const [amount, setAmount] = useState(plan.requiredMonthly ? String(Math.round(plan.requiredMonthly)) : '');
  const [date, setDate] = useState(today);
  return (
    <>
      <AmountField label="Amount saved (MWK)" value={amount} onChangeText={setAmount} />
      <DateField value={date} onChange={setDate} maximumDate={asDate(today)} />
      <Body muted small style={{ marginTop: 10 }}>This money is set aside, so it comes out of your safe daily amount.</Body>
      <Actions>
        <Button
          title="Save"
          style={{ flex: 1 }}
          onPress={() => {
            const value = amountValue(amount);
            if (!value) return;
            update((d) => {
              const g = d.goals.find((x) => x.id === goalId);
              g.contributions = [...(g.contributions || []), { amount: value, date }];
            }, `${K(value)} added to ${goal.name}`);
            close();
          }}
        />
      </Actions>
    </>
  );
}

function BillForm({ billId, close }) {
  const { data, update, toast } = useData();
  const bill = billId ? data.bills.find((b) => b.id === billId) : null;
  const [f, setF] = useState({
    name: bill?.name || '',
    amount: bill ? String(bill.amount) : '',
    dueDay: bill ? String(bill.dueDay) : '',
    category: bill?.category || 'Rent',
  });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <>
      <Field label="Bill name" value={f.name} onChangeText={set('name')} placeholder="e.g. ESCOM electricity" maxLength={40} />
      <AmountField value={f.amount} onChangeText={set('amount')} />
      <Field label="Due day of the month (1–31)" value={f.dueDay} onChangeText={(v) => set('dueDay')(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" placeholder="e.g. 5" />
      <Select label="Category" value={f.category} options={EXPENSE_CATEGORIES} onChange={set('category')} />
      <Actions>
        <Button
          title="Save bill"
          style={{ flex: 1 }}
          onPress={() => {
            const dueDay = Number(f.dueDay);
            const values = { name: f.name.trim(), amount: amountValue(f.amount), dueDay, category: f.category };
            if (!values.name || !values.amount) return toast('Enter a name and amount');
            if (!(dueDay >= 1 && dueDay <= 31)) return toast('Due day must be between 1 and 31');
            update((d) => {
              if (bill) Object.assign(d.bills.find((b) => b.id === bill.id), values);
              else d.bills.push({ id: newId(), paidMonths: [], ...values });
            }, 'Bill saved');
            close();
          }}
        />
      </Actions>
      {bill && (
        <Actions>
          <Button
            kind="danger"
            title="Delete bill"
            style={{ flex: 1 }}
            onPress={() => {
              update((d) => {
                d.bills = d.bills.filter((b) => b.id !== bill.id);
              }, 'Bill deleted');
              close();
            }}
          />
        </Actions>
      )}
    </>
  );
}

function PayBillForm({ billId, close }) {
  const { data, today, update } = useData();
  const bill = data.bills.find((b) => b.id === billId);
  const [f, setF] = useState({ amount: String(bill.amount), date: today, method: 'Airtel Money', record: true });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <>
      <AmountField label="Amount paid (MWK)" value={f.amount} onChangeText={set('amount')} />
      <Grid2>
        <DateField value={f.date} onChange={set('date')} maximumDate={asDate(today)} />
        <Select label="Paid with" value={f.method} options={PAYMENT_METHODS} onChange={set('method')} />
      </Grid2>
      <Checkbox label="Also record as an expense" value={f.record} onChange={set('record')} />
      <Actions>
        <Button
          title="Mark as paid"
          style={{ flex: 1 }}
          onPress={() => {
            update((d) => {
              const b = d.bills.find((x) => x.id === billId);
              b.paidMonths = [...new Set([...(b.paidMonths || []), monthOf(today)])];
              if (f.record) {
                d.transactions.push({ id: newId(), type: 'expense', amount: amountValue(f.amount), category: b.category, date: f.date, method: f.method, note: b.name });
              }
            }, `${bill.name} marked as paid`);
            close();
          }}
        />
      </Actions>
    </>
  );
}

function LoanForm({ direction, close }) {
  const { today, update, toast } = useData();
  const lent = direction === 'lent';
  const [f, setF] = useState({ person: '', amount: '', date: today, dueDate: '', note: '', record: true });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <>
      <Field label={lent ? 'Who did you lend to?' : 'Who did you borrow from?'} value={f.person} onChangeText={set('person')} placeholder={lent ? 'e.g. Brother, Chisomo' : 'e.g. Village bank, Uncle'} maxLength={40} />
      <AmountField value={f.amount} onChangeText={set('amount')} />
      <DateField value={f.date} onChange={set('date')} maximumDate={asDate(today)} />
      <DateField label={lent ? 'Promised back by (optional)' : 'Must repay by (optional)'} value={f.dueDate} onChange={set('dueDate')} minimumDate={asDate(today)} optional />
      <Field label="Note (optional)" value={f.note} onChangeText={set('note')} maxLength={80} />
      <Checkbox label={`Also record as ${lent ? 'an expense (money out)' : 'income (money in)'}`} value={f.record} onChange={set('record')} />
      <Actions>
        <Button
          title="Save"
          style={{ flex: 1 }}
          onPress={() => {
            const amount = amountValue(f.amount);
            const person = f.person.trim();
            if (!person || !amount) return toast('Enter a name and amount');
            update((d) => {
              d.loans.push({ id: newId(), direction, person, amount, date: f.date, dueDate: f.dueDate, note: f.note.trim(), repayments: [] });
              if (f.record) {
                d.transactions.push({
                  id: newId(),
                  type: lent ? 'expense' : 'income',
                  amount,
                  category: lent ? 'Money lent' : 'Borrowed money',
                  date: f.date,
                  method: 'Cash',
                  note: `${lent ? 'Lent to' : 'Borrowed from'} ${person}`,
                });
              }
            }, 'Loan saved');
            close();
          }}
        />
      </Actions>
    </>
  );
}

function RepayForm({ loanId, close }) {
  const { data, today, update } = useData();
  const loan = data.loans.find((l) => l.id === loanId);
  const st = loanStatus(loan, today);
  const lent = loan.direction === 'lent';
  const [f, setF] = useState({ amount: String(st.outstanding), date: today, record: true });
  const set = (k) => (v) => setF((x) => ({ ...x, [k]: v }));
  return (
    <>
      <AmountField label={`Amount (outstanding ${K(st.outstanding)})`} value={f.amount} onChangeText={set('amount')} />
      <DateField value={f.date} onChange={set('date')} maximumDate={asDate(today)} />
      <Checkbox label={`Also record as ${lent ? 'income' : 'an expense'}`} value={f.record} onChange={set('record')} />
      <Actions>
        <Button
          title="Save repayment"
          style={{ flex: 1 }}
          onPress={() => {
            const amount = Math.min(amountValue(f.amount), st.outstanding);
            if (!amount) return;
            update((d) => {
              const l = d.loans.find((x) => x.id === loanId);
              l.repayments = [...(l.repayments || []), { amount, date: f.date }];
              if (f.record) {
                d.transactions.push({
                  id: newId(),
                  type: lent ? 'income' : 'expense',
                  amount,
                  category: lent ? 'Loan repaid to me' : 'Debt repayment',
                  date: f.date,
                  method: 'Cash',
                  note: `${lent ? 'Repaid by' : 'Repaid to'} ${loan.person}`,
                });
              }
            }, amount === st.outstanding ? 'Loan fully settled 🎉' : 'Repayment saved');
            close();
          }}
        />
      </Actions>
    </>
  );
}

function SettingsForm({ close }) {
  const { data, today, update, replace, openSheet, toast } = useData();
  const [name, setName] = useState(data.settings.name || '');
  return (
    <>
      <Field label="Your name" value={name} onChangeText={setName} placeholder="Optional" maxLength={30} />
      <Actions>
        <Button
          title="Save"
          style={{ flex: 1 }}
          onPress={() => {
            update((d) => {
              d.settings.name = name.trim();
            }, 'Saved');
            close();
          }}
        />
      </Actions>
      <Section>Backup</Section>
      <Body muted small>
        Your data is stored only on this phone. Save a backup to WhatsApp, Google Drive or email now and then, or to move to a new phone.
      </Body>
      <Actions>
        <Button kind="secondary" icon="share-outline" title="Save backup" onPress={() => exportBackup(data, today).catch(() => toast('Could not create the backup'))} />
        <Button
          kind="secondary"
          icon="download-outline"
          title="Restore backup"
          onPress={async () => {
            try {
              const restored = await importBackup();
              if (!restored) return;
              replace(restored, 'Backup restored');
              close();
            } catch (e) {
              toast(e.message || 'Could not read that file');
            }
          }}
        />
      </Actions>
      <Section>Other</Section>
      <Actions>
        <Button
          kind="secondary"
          title="Load sample data"
          onPress={() =>
            openSheet('confirm', {
              title: 'Load sample data?',
              message: 'This replaces everything you have recorded with a sample month.',
              yesLabel: 'Replace my data',
              action: 'demo',
            })
          }
        />
        <Button
          kind="danger"
          title="Erase all data"
          onPress={() =>
            openSheet('confirm', {
              title: 'Erase all data?',
              message: 'Every entry, goal, bill and loan on this phone will be deleted. Save a backup first if you may need it.',
              yesLabel: 'Erase everything',
              action: 'wipe',
            })
          }
        />
      </Actions>
    </>
  );
}

// Confirm actions are referenced by name so the sheet state stays serialisable.
function ConfirmForm({ message, yesLabel = 'Delete', action, id, close }) {
  const { today, update, replace } = useData();
  const actions = {
    demo: () => replace(demoData(today), 'Sample data loaded'),
    wipe: () => replace(emptyData(), 'All data erased'),
    deleteGoal: () =>
      update((d) => {
        d.goals = d.goals.filter((g) => g.id !== id);
      }, 'Goal deleted'),
    deleteLoan: () =>
      update((d) => {
        d.loans = d.loans.filter((l) => l.id !== id);
      }, 'Loan deleted'),
  };
  return (
    <>
      <Body>{message}</Body>
      <Actions>
        <Button
          kind="danger"
          title={yesLabel}
          onPress={() => {
            actions[action]();
            close();
          }}
        />
        <Button kind="secondary" title="Cancel" onPress={close} />
      </Actions>
    </>
  );
}

const FORMS = {
  transaction: [TransactionForm, (p) => (p.id ? 'Edit entry' : 'Add money in or out')],
  budget: [BudgetForm, () => 'Monthly budget'],
  suggestBudget: [SuggestBudgetForm, () => 'Suggest a budget'],
  goal: [GoalForm, (p) => (p.goalId ? 'Edit goal' : 'New savings goal')],
  contribute: [ContributeForm, () => 'Add to savings'],
  bill: [BillForm, (p) => (p.billId ? 'Edit bill' : 'New monthly bill')],
  payBill: [PayBillForm, () => 'Pay bill'],
  loan: [LoanForm, (p) => (p.direction === 'lent' ? 'Money I lent' : 'Money I borrowed')],
  repay: [RepayForm, () => 'Record repayment'],
  settings: [SettingsForm, () => 'Settings'],
  confirm: [ConfirmForm, (p) => p.title],
};

export function SheetHost() {
  const { sheet, closeSheet } = useData();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Keep the last form mounted while the sheet slides away.
  const [shown, setShown] = useState(sheet);
  if (sheet && sheet !== shown) setShown(sheet);
  const entry = shown && FORMS[shown.name];
  const Form = entry?.[0];

  return (
    <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={closeSheet}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeSheet} accessibilityLabel="Close" />
        <View style={[styles.sheet, { backgroundColor: t.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.head}>
            <Text style={{ color: t.text, fontSize: 18, fontWeight: '700', flex: 1 }}>{entry ? entry[1](shown.props) : ''}</Text>
            <Pressable onPress={closeSheet} hitSlop={12} accessibilityLabel="Close">
              <Ionicons name="close" size={24} color={t.muted} />
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
            {Form ? <Form key={JSON.stringify(shown)} {...shown.props} close={closeSheet} /> : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: '92%',
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
  ideas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
});
