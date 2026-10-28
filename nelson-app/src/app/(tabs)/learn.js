import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNelson } from '../../nelson';
import { Banner, Card, Empty, Pill, Row, Screen, T } from '../../components/ui';
import { C } from '../../theme';
import { price, recordText, timeAgo, utcClock } from '../../format';

const SOURCES = [['trade', 'Real trades'], ['paper', 'Paper signals'], ['offline', 'Missed while off'], ['filtered', 'Skipped / not taken']];

export default function Learn() {
  const { snap: s } = useNelson();
  const L = s?.learning;
  if (!L) {
    return <Screen><Card><Empty icon="school-outline">Waiting for Nelson…</Empty></Card></Screen>;
  }
  const taken = L.taken || {};
  return (
    <Screen>
      <Card title="What Nelson has learned">
        <T>
          Every setup ends with a real-market result: trades, paper signals, setups missed while Nelson was off, and
          setups it skipped. Nelson keeps a scorecard for each kind of setup and writes a lesson after every loss.
        </T>
        <View style={{ marginTop: 10 }}>
          <Row label="Results learned from" value={String(L.results)} />
          {SOURCES.map(([k, label]) => <Row key={k} label={`  ${label}`} value={String(L.by_source?.[k] || 0)} />)}
          <Row label="Setups that passed every step" value={taken.n ? `${taken.wins}W / ${taken.losses}L` : '-'}
            sub={taken.avg_r !== null && taken.avg_r !== undefined ? `${taken.avg_r > 0 ? '+' : ''}${taken.avg_r}R average` : null} />
        </View>
        <T small muted style={{ marginTop: 8 }}>
          With its current target Nelson needs to win about {L.breakeven_win_rate}% of trades to break even, so a
          40% win rate can still make money.
        </T>
      </Card>

      <Card title="Rules Nelson follows now">
        {!L.apply_lessons ? <Banner tone="warn" icon="pause">Learned rules are switched off in config.yaml (learning.apply_lessons).</Banner> : null}
        {!L.rules?.length ? (
          <T muted>
            None yet. A kind of setup is only avoided after at least {L.min_samples} results that are clearly losing.
            Until then Nelson trades its normal plan.
          </T>
        ) : L.rules.map((r) => (
          <View key={r.key} style={styles.rule}>
            <Ionicons name="hand-left" size={18} color={C.orange} style={{ marginRight: 10, marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <T bold>Avoiding: {r.label}</T>
              <T small muted>{r.text}</T>
            </View>
          </View>
        ))}
      </Card>

      {L.suggestions?.length ? (
        <Card title="Worth a look">
          {L.suggestions.map((x) => (
            <View key={x.title} style={styles.rule}>
              <Ionicons name={x.kind === 'filter_ok' ? 'shield-checkmark' : 'bulb'} size={18}
                color={x.kind === 'filter_ok' ? C.green : C.gold} style={{ marginRight: 10, marginTop: 2 }} />
              <View style={{ flex: 1 }}>
                <T bold>{x.title}</T>
                <T small muted>{x.text}</T>
              </View>
            </View>
          ))}
        </Card>
      ) : null}

      <Scorecard title="Working best" rows={L.strengths} tone="good" empty="Needs at least 5 results of a kind." />
      <Scorecard title="Working worst" rows={L.weaknesses} tone="bad" empty="Nothing is losing yet." />

      <Card title={`Lessons from losses (${L.lessons?.length || 0})`}>
        {L.causes?.length ? (
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {L.causes.map((c) => <Pill key={c.cause} tone="neutral">{c.label} ×{c.count}</Pill>)}
          </View>
        ) : null}
        {!L.lessons?.length ? <Empty icon="school-outline">No losses yet. Nelson writes a lesson after every one.</Empty> : null}
        {(L.lessons || []).map((les) => <Lesson key={les.id} les={les} />)}
      </Card>

      <T small muted style={{ textAlign: 'center' }}>
        Learning cuts out what keeps losing; it cannot promise profits. Keep testing on demo.
      </T>
    </Screen>
  );
}

function Scorecard({ title, rows, tone, empty }) {
  return (
    <Card title={title}>
      {!rows?.length ? <T muted>{empty}</T> : rows.map((b) => (
        <Row key={b.key} label={b.label} value={recordText(b)} color={tone === 'good' ? C.green : C.red}
          sub={`${b.n} results · ${b.win_rate}% won`} />
      ))}
    </Card>
  );
}

function Lesson({ les }) {
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen(!open)} accessibilityRole="button" style={styles.lesson}>
      <View style={styles.between}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', flexShrink: 1 }}>
          <Pill tone={les.side === 'BUY' ? 'good' : 'bad'}>{les.side}</Pill>
          <T bold style={{ flexShrink: 1 }}>{les.title}</T>
        </View>
        <T small muted>{timeAgo(les.time)}</T>
      </View>
      <T style={{ marginTop: 6 }}>{les.notes?.[0]}</T>
      {open ? (
        <View style={{ marginTop: 4 }}>
          {(les.notes || []).slice(1).map((n) => <T key={n} small muted style={{ marginTop: 3 }}>• {n}</T>)}
          <T small muted style={{ marginTop: 6 }}>
            {utcClock(les.time)} · swept {les.level || '?'} · entry {price(les.entry)}, stop {price(les.sl)}, target {price(les.tp)}
            {les.source === 'offline' ? ' · missed while off' : les.source === 'paper' ? ' · paper signal' : ''}
          </T>
        </View>
      ) : null}
      {les.follow_up ? (
        <View style={styles.follow}>
          <Ionicons name="time-outline" size={14} color={C.blue} style={{ marginRight: 6, marginTop: 2 }} />
          <T small color={C.blue} style={{ flex: 1 }}>{les.follow_up}</T>
        </View>
      ) : !les.reviewed ? <T small muted style={{ marginTop: 6 }}>Checking where price goes next…</T> : null}
      <T small color={C.gold} style={{ marginTop: 4 }}>{open ? 'Less' : 'More detail'}</T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  rule: { flexDirection: 'row', paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.line },
  lesson: { paddingVertical: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.line },
  follow: { flexDirection: 'row', marginTop: 8, padding: 8, borderRadius: 8, backgroundColor: C.blueSoft },
});
