import { StyleSheet, View } from 'react-native';
import { useNelson } from '../../nelson';
import { Banner, Button, Card, Empty, Pill, Row, Screen, T } from '../../components/ui';
import { C } from '../../theme';
import { money, pct, pipsText, price, signedMoney, timeAgo, timeUntil } from '../../format';
import { confirm, tell } from '../../confirm';

const RISK_STEPS = [0.25, 0.5, 0.75, 1.0];

function StatusPill({ snap }) {
  if (snap.halted) return <Pill tone="bad" icon="hand-left">HALTED</Pill>;
  if (!snap.trading) return <Pill tone="neutral" icon="eye">ANALYSIS ONLY</Pill>;
  if (snap.paused) return <Pill tone="warn" icon="pause">PAUSED</Pill>;
  if (snap.news?.blocked_now) return <Pill tone="warn" icon="newspaper">NEWS - WAITING</Pill>;
  return <Pill tone="good" icon="radio-button-on">HUNTING SETUPS</Pill>;
}

export default function Home() {
  const n = useNelson();
  const s = n.snap;
  if (!s || !s.ready) {
    return (
      <Screen>
        <Card><Empty>{n.error ? 'Waiting for Nelson…' : 'Nelson is starting - first data in a few seconds.'}</Empty></Card>
      </Screen>
    );
  }
  const today = s.today || {};
  const cur = s.account.currency;
  const riskOptions = RISK_STEPS.filter((r) => r <= s.limits.max_risk_pct);

  const doAction = async (fn, title) => {
    const r = await fn();
    tell(r.ok ? title : 'Not done', r.message);
  };

  return (
    <Screen>
      {/* status + price */}
      <Card>
        <View style={styles.between}>
          <StatusPill snap={s} />
          <Pill tone={s.mode === 'live' ? 'bad' : 'info'}>{s.mode.toUpperCase()}</Pill>
        </View>
        <View style={[styles.between, { marginTop: 14, alignItems: 'flex-end' }]}>
          <View>
            <T small muted>{s.symbol} bid</T>
            <T big mono color={C.gold}>{price(s.price.bid)}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T small muted>spread {price(s.price.spread)}</T>
            <T small muted>updated {timeAgo(s.updated)}</T>
          </View>
        </View>
        {s.halted ? <View style={{ marginTop: 10 }}><Banner tone="bad" icon="hand-left">{s.halted}</Banner></View> : null}
        {s.news?.blocked_now ? (
          <View style={{ marginTop: 10 }}><Banner tone="warn" icon="newspaper">No new trades: {s.news.reason}</Banner></View>
        ) : null}
      </Card>

      {/* account */}
      <Card title="Account">
        <View style={styles.between}>
          <View>
            <T small muted>Balance</T>
            <T bold mono style={{ fontSize: 22 }}>{money(s.account.balance, cur)}</T>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T small muted>Equity</T>
            <T bold mono style={{ fontSize: 22 }}>{money(s.account.equity, cur)}</T>
          </View>
        </View>
        <View style={[styles.today, { backgroundColor: today.pnl >= 0 ? C.greenSoft : C.redSoft }]}>
          <T bold color={today.pnl >= 0 ? C.green : C.red}>Today {signedMoney(today.pnl, cur)} ({pct(today.pct)})</T>
          <T small muted>{today.trades}/{s.limits.max_trades_per_day} trades · daily stop at -{s.limits.max_daily_loss_pct}%</T>
        </View>
      </Card>

      {/* open trades */}
      <Card title={`Open trades (${s.positions.length + s.orders.length})`}>
        {s.positions.length + s.orders.length === 0 ? <Empty icon="moon-outline">No open trades. Nelson is waiting for an A+ setup.</Empty> : null}
        {s.positions.map((p) => (
          <View key={p.ticket} style={styles.trade}>
            <View style={styles.between}>
              <Pill tone={p.side === 'BUY' ? 'good' : 'bad'}>{p.side} {p.lots}</Pill>
              <T bold mono color={p.profit >= 0 ? C.green : C.red} style={{ fontSize: 18 }}>{signedMoney(p.profit, cur)}</T>
            </View>
            <T small muted mono style={{ marginTop: 6 }}>
              Entry {price(p.open)} · SL {price(p.sl)} · TP {price(p.tp)}
            </T>
            <T small muted>
              {p.pips !== null && p.pips !== undefined ? `${pipsText(p.pips)} · ` : ''}
              {p.r !== null ? `${p.r > 0 ? '+' : ''}${p.r}R` : ''}{p.partial_taken ? ' · partial taken' : ''}
              {p.sl === p.open ? ' · risk-free (break-even)' : ''}
            </T>
          </View>
        ))}
        {s.orders.map((o) => (
          <View key={o.ticket} style={styles.trade}>
            <View style={styles.between}>
              <Pill tone="warn" icon="time">{o.side} LIMIT {o.lots}</Pill>
              <T small muted>{o.expires ? `expires ${timeUntil(o.expires)}` : ''}</T>
            </View>
            <T small muted mono style={{ marginTop: 6 }}>
              Entry {price(o.price)} · SL {price(o.sl)} · TP {price(o.tp)}
            </T>
          </View>
        ))}
      </Card>

      {/* controls */}
      <Card title="Controls">
        {s.paused ? (
          <Button title="Resume trading" icon="play" tone="good" disabled={n.busy || !s.trading}
            onPress={() => doAction(n.resume, 'Resumed')} />
        ) : (
          <Button title="Pause new trades" icon="pause" tone="warn" disabled={n.busy || !s.trading}
            onPress={async () => {
              if (await confirm('Pause Nelson?', 'No new trades will be opened. Open trades keep being managed.', 'Pause')) {
                doAction(n.pause, 'Paused');
              }
            }} />
        )}
        <T small muted style={{ marginTop: 14, marginBottom: 6 }}>Risk per trade</T>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {riskOptions.map((r) => {
            const on = Math.abs(r - s.limits.risk_pct) < 1e-9;
            return (
              <Button key={r} title={`${r}%`} tone="gold" outline={!on} disabled={n.busy}
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 4 }}
                onPress={async () => {
                  if (on) return;
                  const amount = money((s.account.balance * r) / 100, cur);
                  if (await confirm(`Risk ${r}% per trade?`, `A losing trade would cost about ${amount}.`, 'Set')) {
                    doAction(() => n.setRisk(r), 'Risk updated');
                  }
                }} />
            );
          })}
        </View>
        <Button title="Close all trades" icon="close-circle" tone="bad" outline style={{ marginTop: 14 }}
          disabled={n.busy || (s.positions.length + s.orders.length === 0)}
          onPress={async () => {
            const msg = `Closes ${s.positions.length} trade(s) at market and cancels ${s.orders.length} order(s). Nelson will then pause.`;
            if (await confirm('Close everything now?', msg, 'Close all', true)) doAction(n.closeAll, 'Closed');
          }} />
      </Card>

      {/* record */}
      <Card title="Track record (this bot)">
        <Row label="Closed trades" value={String(s.stats.closed_trades)} />
        <Row label="Win rate" value={s.stats.win_rate_pct === null ? '-' : `${s.stats.win_rate_pct}%`}
          sub={`${s.stats.wins} wins · ${s.stats.losses} losses`} />
        <Row label="Total result" value={signedMoney(s.stats.total_pnl, cur)}
          color={s.stats.total_pnl >= 0 ? C.green : C.red} />
        {s.stats.total_pips !== null && s.stats.total_pips !== undefined ? (
          <Row label="Total pips" value={pipsText(s.stats.total_pips)}
            color={s.stats.total_pips >= 0 ? C.green : C.red} />
        ) : null}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  today: { marginTop: 12, padding: 12, borderRadius: 12 },
  trade: { backgroundColor: C.card2, borderRadius: 12, padding: 12, marginBottom: 8 },
});
