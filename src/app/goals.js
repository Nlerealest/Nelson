import { View } from 'react-native';
import { formatKwacha as K, goalPlan, goalWarnings, shortDate } from '../logic';
import { useData } from '../data';
import { Actions, Alerts, Bar, Body, Button, Card, Chip, Empty, H1, H2, Screen, Tiles } from '../components/ui';

export default function Goals() {
  const { data, today, openSheet } = useData();
  const { warnings, projectedSurplus, requiredTotal } = goalWarnings({ ...data, today });
  const byGoal = {};
  for (const w of warnings) if (w.goalId) (byGoal[w.goalId] ||= []).push(w);
  const tips = warnings.filter((w) => !w.goalId);

  return (
    <Screen>
      <H1>Savings goals</H1>
      {data.goals.length > 0 && projectedSurplus !== null && (
        <Tiles
          items={[
            { label: 'Goals need / month', value: K(requiredTotal) },
            { label: 'On course to have left', value: K(projectedSurplus), tone: projectedSurplus < requiredTotal ? 'danger' : 'primary' },
          ]}
        />
      )}
      <Alerts list={tips} />
      {data.goals.length === 0 && (
        <Card>
          <Empty>
            Saving for a phone, school fees, a car or a house? Add a goal and we will tell you how much to put aside each month, and warn you if your spending puts it at risk.
          </Empty>
        </Card>
      )}
      {data.goals.map((g) => {
        const p = goalPlan(g, today);
        return (
          <Card key={g.id}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <H2 style={{ flex: 1 }}>{g.name}</H2>
              {p.done ? <Chip label="Reached 🎉" /> : g.deadline ? <Body muted small>by {shortDate(g.deadline, today)}</Body> : null}
            </View>
            <Bar fraction={p.progress} />
            <Body muted small>
              {K(p.saved)} of {K(p.target)} · {Math.round(p.progress * 100)}%
            </Body>
            {!p.done && p.requiredMonthly > 0 && (
              <Body style={{ marginTop: 8 }}>
                Save <Body bold>{K(p.requiredMonthly)}</Body> a month for {p.monthsLeft} month{p.monthsLeft > 1 ? 's' : ''} (about {K(p.requiredMonthly / 30)} a day).
              </Body>
            )}
            {byGoal[g.id] && (
              <View style={{ marginTop: 8 }}>
                <Alerts list={byGoal[g.id]} />
              </View>
            )}
            <Actions>
              {!p.done && <Button small title="Add savings" onPress={() => openSheet('contribute', { goalId: g.id })} />}
              <Button small kind="ghost" title="Edit" onPress={() => openSheet('goal', { goalId: g.id })} />
              <Button
                small
                kind="ghost"
                title="Delete"
                onPress={() =>
                  openSheet('confirm', { title: 'Delete goal?', message: `“${g.name}” and its savings history will be removed.`, action: 'deleteGoal', id: g.id })
                }
              />
            </Actions>
          </Card>
        );
      })}
      <Button block title="+ New goal" onPress={() => openSheet('goal')} />
    </Screen>
  );
}
