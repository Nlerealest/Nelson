import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useNelson } from '../../nelson';
import SignalCard from '../../components/SignalCard';
import { Card, Empty, Pill, Screen, T } from '../../components/ui';
import { C } from '../../theme';
import { hoursLabel, utcClock, windowText } from '../../format';

const FILTERS = [['trades', 'Would-be trades'], ['skipped', 'Skipped'], ['all', 'All']];

export default function Missed() {
  const { snap: s } = useNelson();
  const [filter, setFilter] = useState('trades');
  const [only, setOnly] = useState(null);
  const windows = s?.missed?.windows || [];
  const items = (s?.missed?.items || [])
    .filter((x) => !only || x.offline === only)
    .filter((x) => filter === 'all' || (filter === 'skipped' ? x.kind === 'skipped' : x.kind !== 'skipped'));

  return (
    <Screen>
      <Card title="While Nelson was off">
        <T>
          When Nelson starts again (or gets MT5 back), it reads the candles it did not see, finds every setup it would
          have spotted, and follows each one on the real prices: would it have filled, hit the target or the stop?
        </T>
        <T small muted style={{ marginTop: 6 }}>
          Nelson never places these late. They are here so you can see what was missed, and Nelson learns from them.
        </T>
      </Card>

      {!windows.length ? (
        <Card><Empty icon="moon-outline">Nothing missed yet. If Nelson is switched off and on again, what it missed shows here.</Empty></Card>
      ) : null}

      {windows.map((w) => (
        <Pressable key={w.id} onPress={() => setOnly(only === w.id ? null : w.id)} accessibilityRole="button">
          <Card style={only === w.id ? { borderColor: C.gold } : null}>
            <View style={styles.between}>
              <T bold>{w.first_run ? 'Before Nelson first started' : `Off ${utcClock(w.start)}`}</T>
              <Pill tone="neutral">{hoursLabel(w.market_hours)} of market</Pill>
            </View>
            <T small muted style={{ marginTop: 2 }}>
              {w.first_run ? 'Checked the last day of candles' : `Back ${utcClock(w.end)}`}
              {w.limited ? ' · only the candles MT5 still had could be checked' : ''}
            </T>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
              {w.wins ? <Pill tone="good" icon="checkmark">{w.wins} target</Pill> : null}
              {w.losses ? <Pill tone="bad" icon="close">{w.losses} stop</Pill> : null}
              {w.open ? <Pill tone="info">{w.open} still open</Pill> : null}
              {w.result_r ? <Pill tone={w.result_r > 0 ? 'good' : 'bad'}>{w.result_r > 0 ? '+' : ''}{w.result_r}R</Pill> : null}
            </View>
            <T style={{ marginTop: 8 }}>{windowText(w)}</T>
            <T small color={C.gold} style={{ marginTop: 4 }}>{only === w.id ? 'Showing only this time · tap to show all' : 'Tap to show only these'}</T>
          </Card>
        </Pressable>
      ))}

      {windows.length ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {FILTERS.map(([key, label]) => (
            <Pressable key={key} onPress={() => setFilter(key)}
              style={[styles.chip, filter === key && { backgroundColor: C.gold, borderColor: C.gold }]}>
              <T small bold color={filter === key ? C.bg : C.muted}>{label}</T>
            </Pressable>
          ))}
        </View>
      ) : null}

      {windows.length && !items.length ? (
        <Card><Empty icon="flash-outline">{filter === 'skipped' ? 'No skipped setups in this time.' : 'No setups Nelson would have traded.'}</Empty></Card>
      ) : null}
      {items.map((x) => <SignalCard key={x.id} sig={x} />)}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
});
