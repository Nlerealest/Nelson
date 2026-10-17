import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { addMonths, formatKwacha as K, monthLabel, monthOf, monthlyReport } from '../logic';
import { useData } from '../data';
import { Amount, Bar, Body, Button, Card, Empty, H1, Row, Screen, Section, Tiles, TransactionRow } from '../components/ui';

function change(now, before) {
  if (!before) return undefined;
  const d = now - before;
  return `${d >= 0 ? '▲' : '▼'} ${K(Math.abs(d))} vs last month`;
}

export default function Report() {
  const { data, today, openSheet } = useData();
  const current = monthOf(today);
  const [month, setMonth] = useState(current);
  // Each visit to the tab starts on the current month.
  useFocusEffect(useCallback(() => setMonth(current), [current]));

  const rep = monthlyReport({ ...data, monthKey: month });
  const { current: c, previous: p } = rep;
  const txs = data.transactions
    .filter((t) => monthOf(t.date) === month)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const max = rep.categories[0]?.amount || 1;
  const incomes = Object.entries(c.incomeByCategory).sort((a, b) => b[1] - a[1]);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <Button kind="ghost" title="‹ Prev" onPress={() => setMonth(addMonths(month, -1))} />
        <H1 style={{ marginBottom: 0 }}>{monthLabel(month)}</H1>
        <Button kind="ghost" title="Next ›" disabled={month >= current} onPress={() => setMonth(addMonths(month, 1))} />
      </View>
      <Tiles
        items={[
          { label: 'Money in', value: K(c.income), tone: 'primary', sub: change(c.income, p.income) },
          { label: 'Money out', value: K(c.expenses), sub: change(c.expenses, p.expenses) },
          { label: 'Left over', value: K(c.net), tone: c.net < 0 ? 'danger' : 'primary' },
        ]}
      />
      <Card>
        {rep.insights.map((i) => (
          <Body key={i} style={{ marginVertical: 2 }}>
            • {i}
          </Body>
        ))}
      </Card>
      {rep.categories.length > 0 && (
        <>
          <Section>Where the money went</Section>
          <Card>
            {rep.categories.map((cat, i) => {
              const over = cat.budget && cat.amount > cat.budget;
              return (
                <Row key={cat.category} last={i === rep.categories.length - 1}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Body>
                      {cat.category} <Body muted small>{Math.round(cat.share * 100)}%</Body>
                    </Body>
                    <Body bold>{K(cat.amount)}</Body>
                  </View>
                  <Bar fraction={cat.amount / max} tone={over ? 'over' : undefined} />
                  {cat.budget ? (
                    <Body muted small>
                      Budget {K(cat.budget)}
                      {over ? ` · over by ${K(cat.amount - cat.budget)}` : ''}
                    </Body>
                  ) : null}
                </Row>
              );
            })}
          </Card>
        </>
      )}
      {incomes.length > 0 && (
        <>
          <Section>Where the money came from</Section>
          <Card>
            {incomes.map(([cat, v], i) => (
              <Row key={cat} title={cat} right={<Amount value={v} tone="primary" />} last={i === incomes.length - 1} />
            ))}
          </Card>
        </>
      )}
      {rep.saved > 0 && (
        <>
          <Section>Saved towards goals</Section>
          <Card>
            <Amount value={rep.saved} size={17} />
          </Card>
        </>
      )}
      <Section>All entries ({txs.length})</Section>
      <Card>
        {txs.length ? (
          txs.map((tx, i) => (
            <TransactionRow key={tx.id} tx={tx} today={today} last={i === txs.length - 1} onPress={() => openSheet('transaction', { id: tx.id })} />
          ))
        ) : (
          <Empty>Nothing recorded this month.</Empty>
        )}
      </Card>
    </Screen>
  );
}
