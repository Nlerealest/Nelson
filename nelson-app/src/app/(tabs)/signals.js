import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNelson } from '../../nelson';
import NotifyCard from '../../components/NotifyCard';
import { Card, Empty, Pill, Screen, T } from '../../components/ui';
import { C } from '../../theme';
import { price, signalResult, signalStatus, timeAgo, trendLabel, utcClock } from '../../format';

const HOW = [
  ['H1 market structure', 'Only buy when the H1 trend is bullish, only sell when it is bearish.'],
  ['Premium / discount', 'Buy below the middle of the H1 range, sell above it.'],
  ['Liquidity sweep', 'Price wicks through a level where stops rest (previous day, Asian range, equal highs/lows) and closes back inside.'],
  ['Stop-run volume', 'The sweep candle trades more than normal: real stops were hit.'],
  ['Change of character', 'A strong candle breaks the swing that led into the sweep.'],
  ['Fair value gap', 'That move leaves a gap; Nelson places a limit order inside it.'],
  ['Order flow', 'Buying or selling pressure (delta) agrees with the new direction.'],
  ['Session and news', 'Only in the London or New York sessions, never around high-impact USD news.'],
  ['Risk', 'Stop beyond the sweep wick, target 2.5x the risk, a fixed small % of the balance.'],
];

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
            <T small muted style={{ marginTop: 10 }}>A signal needs every step. If one fails, it shows under Skipped with the reason.</T>
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

function SignalCard({ sig }) {
  const [open, setOpen] = useState(false);
  const st = signalStatus(sig.status);
  const result = signalResult(sig);
  const skipped = sig.kind === 'skipped';
  return (
    <Card style={skipped ? { opacity: 0.85 } : null}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button">
        <View style={styles.between}>
          <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
            <Pill tone={sig.side === 'BUY' ? 'good' : 'bad'}>{sig.side}</Pill>
            <Pill tone={st.tone}>{st.label}</Pill>
          </View>
          {result ? <T bold mono color={result.startsWith('-') ? C.red : C.green}>{result}</T> : (
            <T small muted>{timeAgo(sig.confirmed)}</T>
          )}
        </View>
        <T mono style={{ marginTop: 8 }}>
          Entry {price(sig.entry)} · SL {price(sig.sl)} · TP {price(sig.tp)}
        </T>
        <View style={[styles.between, { marginTop: 4 }]}>
          <T small muted>{utcClock(sig.confirmed)}{sig.level ? ` · swept ${sig.level}` : ''}</T>
          <T small color={C.gold}>{open ? 'Hide steps' : 'How it was found'}</T>
        </View>
        {sig.note ? <T small muted style={{ marginTop: 4 }}>{skipped ? 'Skipped: ' : 'Note: '}{sig.note}</T> : null}
      </Pressable>
      {open ? (
        <View style={{ marginTop: 10, borderTopWidth: 1, borderTopColor: C.line, paddingTop: 8 }}>
          {(sig.steps || []).map((step, i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 6 }}>
              <Ionicons name={step.off ? 'remove-circle-outline' : step.ok ? 'checkmark-circle' : 'close-circle'} size={20}
                color={step.off ? C.muted : step.ok ? C.green : C.red} style={{ marginRight: 10, marginTop: 1 }} />
              <View style={{ flex: 1 }}>
                <T bold>{step.title}</T>
                <T small muted>{step.detail}</T>
              </View>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  num: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.gold, alignItems: 'center', justifyContent: 'center', marginRight: 10, marginTop: 1 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
});
