import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNelson } from '../../nelson';
import NotifyCard from '../../components/NotifyCard';
import SignalCard from '../../components/SignalCard';
import { Card, Empty, Pill, Screen, T } from '../../components/ui';
import { C } from '../../theme';
import { price, trendLabel, utcClock } from '../../format';

const HOW = [
  ['Daily bias', 'Only buy when the daily structure is bullish, only sell when it is bearish (the last daily close beyond a swing).'],
  ['Liquidity sweep', 'Price wicks through a level where stops rest (previous day, Asian or London range, equal highs/lows) and closes back inside.'],
  ['Break of structure', 'A candle then closes through the swing that led into the sweep: the market has turned.'],
  ['Fair value gap', 'That move leaves a gap; Nelson places a limit order inside it.'],
  ['Premium / discount', 'Buy only in the lower half of the leg from the sweep to the break, sell only in the upper half.'],
  ['Session and news', 'Any session (Asia, London, New York). No trading on CPI, PPI, FOMC or NFP days, half size on other news days.'],
  ['Targets', 'The next liquidity levels: half closed at the first (stop to break-even), the rest at the next, up to 3R.'],
  ['Risk', 'Stop beyond the sweep wick, a fixed small % of the balance per trade.'],
  ['More strategies', 'Nelson also trades mean reversion, break and retest and momentum. TJR 2026, ICT, opening range and trend setups are followed on price to learn from, without trading them yet.'],
]

const FILTERS = [['signals', 'Signals'], ['skipped', 'Skipped'], ['all', 'All']];

export default function Signals() {
  const { snap: s } = useNelson();
  const [filter, setFilter] = useState('signals');
  const [showHow, setShowHow] = useState(false);
  const all = s?.signals || [];
  const list = all.filter((x) => filter === 'all' || (filter === 'skipped' ? x.kind === 'skipped' : x.kind !== 'skipped'));

  return (
    <Screen>
      <Watching snap={s} />

      <Card>
        <Pressable onPress={() => setShowHow(!showHow)} style={styles.between} accessibilityRole="button">
          <T bold>How Nelson finds a setup</T>
          <Ionicons name={showHow ? 'chevron-up' : 'chevron-down'} size={20} color={C.muted} />
        </Pressable>
        {showHow ? (
          <View style={{ marginTop: 10 }}>
            {HOW.map(([title, text], i) => (
              <View key={title} style={{ flexDirection: 'row', marginTop: 8 }}>
                <View style={styles.num}><T small bold color={C.bg}>{i + 1}</T></View>
                <View style={{ flex: 1 }}>
                  <T bold>{title}</T>
                  <T small muted>{text}</T>
                </View>
              </View>
            ))}
            <T small muted style={{ marginTop: 10 }}>This is the TJR bootcamp method. A signal needs every step; if one fails, it shows under Skipped with the reason.</T>
          </View>
        ) : null}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {FILTERS.map(([key, label]) => (
          <Pressable key={key} onPress={() => setFilter(key)}
            style={[styles.chip, filter === key && { backgroundColor: C.gold, borderColor: C.gold }]}>
            <T small bold color={filter === key ? C.bg : C.muted}>{label}</T>
          </Pressable>
        ))}
      </View>

      {!list.length ? (
        <Card>
          <Empty icon="flash-outline">
            {filter === 'skipped' ? 'No skipped setups yet.' : 'No signals yet. Nelson waits for every step to line up; quiet days are normal.'}
          </Empty>
        </Card>
      ) : null}
      {list.map((x) => <SignalCard key={x.id} sig={x} />)}

      <NotifyCard notify={s?.notify} />
    </Screen>
  );
}

function Watching({ snap }) {
  const a = snap?.analysis;
  if (!a) return null;
  let text;
  if (a.trend > 0) {
    text = `H1 is bullish, so Nelson looks for BUYS: a sweep of sell-side liquidity${a.nearest_ssl ? ` (next: ${a.nearest_ssl.name} ${price(a.nearest_ssl.price)})` : ''}, then a shift back up.`;
  } else if (a.trend < 0) {
    text = `H1 is bearish, so Nelson looks for SELLS: a sweep of buy-side liquidity${a.nearest_bsl ? ` (next: ${a.nearest_bsl.name} ${price(a.nearest_bsl.price)})` : ''}, then a shift back down.`;
  } else {
    text = 'H1 structure is unclear, so Nelson is standing aside.';
  }
  return (
    <Card title="Watching now">
      <View style={{ flexDirection: 'row', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        <Pill tone={a.trend > 0 ? 'good' : a.trend < 0 ? 'bad' : 'neutral'}>H1 {trendLabel(a.trend)}</Pill>
        {a.zone ? <Pill tone={a.zone === 'premium' ? 'bad' : 'good'}>In {a.zone}</Pill> : null}
        <Pill tone="info">{a.session}</Pill>
        {snap.news?.blocked_now ? <Pill tone="warn" icon="newspaper">News pause</Pill> : null}
      </View>
      <T>{text}</T>
      <T small muted style={{ marginTop: 6 }}>Price {price(a.price)} · {utcClock(a.time)}</T>
    </Card>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  num: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
});
