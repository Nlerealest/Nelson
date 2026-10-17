import { View } from 'react-native';
import { budgetStatus, formatKwacha as K, monthLabel, monthOf, monthSummary } from '../logic';
import { useData } from '../data';
import { Actions, Alert, Bar, Body, Button, Card, Chip, Empty, H1, Row, Screen, Section, Tiles } from '../components/ui';

export default function Budget() {
  const { data, today, openSheet } = useData();
  const mk = monthOf(today);
  const status = budgetStatus(data.budgets, data.transactions, today);
  const summary = monthSummary(data.transactions, mk);
  const savings = data.budgets.Savings || 0;
  const totalBudget = Object.entries(data.budgets).reduce((a, [c, v]) => a + (c === 'Savings' ? 0 : v), 0);
  const unbudgeted = Object.entries(summary.byCategory).filter(([c]) => !data.budgets[c]);

  return (
    <Screen>
      <H1>Budget · {monthLabel(mk)}</H1>
      <Tiles
        items={[
          { label: 'Income', value: K(summary.income), tone: 'primary' },
          { label: 'Budgeted', value: K(totalBudget) },
          { label: 'Savings plan', value: K(savings) },
        ]}
      />
      {summary.income > 0 && totalBudget + savings > summary.income && (
        <Alert level="warning">{`Your budget (${K(totalBudget + savings)}) is more than this month's income (${K(summary.income)}).`}</Alert>
      )}
      <Actions style={{ marginTop: 0, marginBottom: 12 }}>
        <Button title="Set budget" onPress={() => openSheet('budget')} />
        <Button kind="secondary" title="Suggest from my income" onPress={() => openSheet('suggestBudget')} />
      </Actions>
      <Card>
        {status.length ? (
          status.map((b, i) => (
            <Row key={b.category} last={i === status.length - 1}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Body bold>{b.category}</Body>
                <Body>
                  {K(b.spent)} <Body muted small>/ {K(b.limit)}</Body>
                </Body>
              </View>
              <Bar fraction={b.pct} tone={b.status} />
              {b.status === 'over' ? (
                <Chip label={`Over by ${K(-b.left)}`} tone="over" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  {b.status === 'pace' && <Chip label={`On pace for ${K(b.projected)}`} tone="pace" />}
                  <Body muted small>{K(b.left)} left</Body>
                </View>
              )}
            </Row>
          ))
        ) : (
          <Empty>No budget yet. Tap “Suggest from my income” to start with a plan based on what you actually earn.</Empty>
        )}
      </Card>
      {unbudgeted.length > 0 && (
        <>
          <Section>Spending without a budget</Section>
          <Card>
            {unbudgeted.map(([c, v], i) => (
              <Row key={c} title={c} right={<Body bold>{K(v)}</Body>} last={i === unbudgeted.length - 1} />
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}
