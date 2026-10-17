import { StyleSheet, Text, View } from 'react-native';
import {
  billSchedule,
  budgetStatus,
  formatKwacha as K,
  goalWarnings,
  loansSummary,
  monthLabel,
  monthOf,
  monthSummary,
  safeToSpend,
  shortDate,
} from '../logic';
import { demoData } from '../demo';
import { useData } from '../data';
import { Alerts, Body, Button, Card, Empty, H1, Section, Screen, Tiles, TransactionRow, Actions } from '../components/ui';
import { BillRow } from '../components/rows';

function Hero({ safe }) {
  const { openSheet } = useData();
  if (safe.income === 0) {
    return (
      <Card hero>
        <Text style={styles.heroLabel}>Safe to spend today</Text>
        <Text style={styles.heroBig}>—</Text>
        <Text style={styles.heroSub}>Record this month’s income to see how much you can spend each day.</Text>
        <Actions>
          <Button kind="light" small title="Add income" onPress={() => openSheet('transaction', { preset: { type: 'income', category: 'Salary', method: 'Bank' } })} />
        </Actions>
      </Card>
    );
  }
  const short = safe.shortfall > 0;
  const sub = short
    ? `After bills, debts and savings you are short by ${K(safe.shortfall)}. Spend only on essentials.`
    : safe.leftToday < 0
      ? `You have spent ${K(-safe.leftToday)} more than today's ${K(safe.perDay)}. Tomorrow's amount will be lower.`
      : `${K(safe.perDay)} a day for the next ${safe.daysLeft} day${safe.daysLeft > 1 ? 's' : ''}${safe.spentToday ? ` · ${K(safe.spentToday)} spent today` : ''}`;
  const lines = [
    ['Income this month', K(safe.income)],
    ['Spent so far', `−${K(safe.spent)}`],
    safe.billsReserve && ['Kept for unpaid bills', `−${K(safe.billsReserve)}`],
    safe.debtReserve && ['Kept for debts due', `−${K(safe.debtReserve)}`],
    safe.savingsReserve && ['Savings this month', `−${K(safe.savingsReserve)}`],
  ].filter(Boolean);
  return (
    <Card hero tone={short ? 'danger' : undefined}>
      <Text style={styles.heroLabel}>{short ? 'Over your limit this month' : 'Safe to spend today'}</Text>
      <Text style={styles.heroBig}>{short ? K(-safe.shortfall) : K(Math.max(0, safe.leftToday))}</Text>
      <Text style={styles.heroSub}>{sub}</Text>
      <View style={styles.breakdown}>
        {lines.map(([k, v]) => (
          <View key={k} style={styles.line}>
            <Text style={styles.lineText}>{k}</Text>
            <Text style={styles.lineText}>{v}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

function Welcome() {
  const { data, today, openSheet, replace } = useData();
  const name = data.settings.name ? `, ${data.settings.name}` : '';
  return (
    <Screen>
      <H1>Moni{name}! 👋</H1>
      <Card>
        <Body>
          <Text style={{ fontWeight: '700' }}>Ndalama</Text> helps you see where your Kwacha goes and how much you can safely spend each day.
        </Body>
        <Body muted small style={{ marginTop: 10 }}>1. Tap + to record money you receive and spend.</Body>
        <Body muted small>2. Add your monthly bills and savings goals.</Body>
        <Body muted small>3. Check Home each day for your safe daily amount.</Body>
        <Actions>
          <Button title="Record my income" onPress={() => openSheet('transaction', { preset: { type: 'income', category: 'Salary', method: 'Bank' } })} />
          <Button kind="secondary" title="Try with sample data" onPress={() => replace(demoData(today), 'Sample data loaded')} />
        </Actions>
      </Card>
      <Body muted small>Everything is saved only on this phone and works without internet.</Body>
    </Screen>
  );
}

export default function Home() {
  const { data, loaded, today, openSheet } = useData();
  if (!loaded) return <Screen fab={false} />;
  if (!data.transactions.length && !data.goals.length && !data.bills.length) return <Welcome />;

  const mk = monthOf(today);
  const safe = safeToSpend({ ...data, today });
  const summary = monthSummary(data.transactions, mk);
  const goals = goalWarnings({ ...data, today });
  const budgets = budgetStatus(data.budgets, data.transactions, today);
  const schedule = billSchedule(data.bills, today);
  const loans = loansSummary(data.loans, today);

  const warnings = [];
  for (const s of schedule) {
    if (s.status === 'overdue') warnings.push({ level: 'danger', message: `${s.bill.name} (${K(s.bill.amount)}) was due on ${shortDate(s.dueDate, today)}.` });
  }
  for (const b of budgets) {
    if (b.status === 'over') warnings.push({ level: 'danger', message: `${b.category} is ${K(-b.left)} over budget this month.` });
  }
  const pacing = budgets.filter((b) => b.status === 'pace');
  if (pacing.length === 1) {
    warnings.push({ level: 'warning', message: `At this pace ${pacing[0].category} will reach ${K(pacing[0].projected)}, above your ${K(pacing[0].limit)} budget.` });
  } else if (pacing.length) {
    warnings.push({ level: 'warning', message: `At this pace you will go over budget on ${pacing.map((b) => b.category).join(', ')}. See Budget for details.` });
  }
  warnings.push(...goals.warnings);
  if (loans.overdueCount) {
    warnings.push({ level: 'warning', message: `${loans.overdueCount} loan${loans.overdueCount > 1 ? 's are' : ' is'} past the agreed repayment date.` });
  }

  const soon = schedule.filter((s) => s.status === 'overdue' || s.status === 'due-soon');
  const recent = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 8);
  const name = data.settings.name ? `, ${data.settings.name}` : '';

  return (
    <Screen>
      <H1>Moni{name}! 👋</H1>
      <Hero safe={safe} />
      <Tiles
        items={[
          { label: `In (${monthLabel(mk).split(' ')[0]})`, value: K(summary.income), tone: 'primary' },
          { label: 'Out', value: K(summary.expenses) },
          { label: 'Left', value: K(summary.net), tone: summary.net < 0 ? 'danger' : undefined },
        ]}
      />
      {warnings.length > 0 && (
        <>
          <Section>Needs attention</Section>
          <Alerts list={warnings} />
        </>
      )}
      {soon.length > 0 && (
        <>
          <Section>Bills due</Section>
          <Card>
            {soon.map((s, i) => (
              <BillRow key={s.bill.id} item={s} last={i === soon.length - 1} />
            ))}
          </Card>
        </>
      )}
      <Section>Recent</Section>
      <Card>
        {recent.length ? (
          recent.map((tx, i) => (
            <TransactionRow key={tx.id} tx={tx} today={today} last={i === recent.length - 1} onPress={() => openSheet('transaction', { id: tx.id })} />
          ))
        ) : (
          <Empty>No entries yet. Tap + to add one.</Empty>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroLabel: { color: 'rgba(255,255,255,0.85)', fontSize: 14 },
  heroBig: { color: '#fff', fontSize: 38, fontWeight: '800', marginVertical: 2 },
  heroSub: { color: 'rgba(255,255,255,0.92)', fontSize: 14, lineHeight: 20 },
  breakdown: { marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.25)', gap: 3 },
  line: { flexDirection: 'row', justifyContent: 'space-between' },
  lineText: { color: '#fff', fontSize: 13.5 },
});
