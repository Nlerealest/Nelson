import { View } from 'react-native';
import { useNelson } from '../../nelson';
import { Banner, Card, Empty, Pill, Row, Screen, T } from '../../components/ui';
import { C } from '../../theme';
import { price, timeUntil, trendLabel, utcClock } from '../../format';

export default function Market() {
  const { snap: s } = useNelson();
  const a = s?.analysis;
  if (!a) return <Screen><Card><Empty icon="compass">Analysis appears after the next candle closes.</Empty></Card></Screen>;
  const bias = a.trend > 0
    ? 'Bullish - Nelson only looks for BUYS, ideally from discount after sell-side liquidity is swept.'
    : a.trend < 0
      ? 'Bearish - Nelson only looks for SELLS, ideally from premium after buy-side liquidity is swept.'
      : 'Unclear structure - Nelson stands aside.';
  return (
    <Screen>
      <Card title="Nelson's read">
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
          <Pill tone={a.trend > 0 ? 'good' : a.trend < 0 ? 'bad' : 'neutral'}>H1 {trendLabel(a.trend)}</Pill>
          {a.zone ? <Pill tone={a.zone === 'premium' ? 'bad' : 'good'}>In {a.zone}</Pill> : null}
          <Pill tone="info">{a.session}</Pill>
        </View>
        <T>{bias}</T>
        <T small muted style={{ marginTop: 8 }}>As of {utcClock(a.time)} · price {price(a.price)}</T>
      </Card>

      <Card title="Structure & liquidity">
        <Row label="H1 range" value={`${price(a.range_low)} - ${price(a.range_high)}`} />
        <Row label="Equilibrium (50%)" value={price(a.equilibrium)} />
        <Row label="Previous day high" value={price(a.pdh)} />
        <Row label="Previous day low" value={price(a.pdl)} />
        <Row label="Asian high / low" value={`${price(a.asia_high)} / ${price(a.asia_low)}`} />
        {a.nearest_bsl ? <Row label="Nearest buy-side liquidity" value={price(a.nearest_bsl.price)} sub={a.nearest_bsl.name} /> : null}
        {a.nearest_ssl ? <Row label="Nearest sell-side liquidity" value={price(a.nearest_ssl.price)} sub={a.nearest_ssl.name} /> : null}
      </Card>

      <Card title="Order flow">
        <Row label="Delta, last hour" value={`${a.delta_1h > 0 ? '+' : ''}${a.delta_1h}`}
          color={a.delta_1h > 0 ? C.green : a.delta_1h < 0 ? C.red : undefined}
          sub={a.delta_1h > 0 ? 'buyers more aggressive' : a.delta_1h < 0 ? 'sellers more aggressive' : 'balanced'} />
        <Row label="Volume vs normal" value={`x${a.volume_1h}`} />
        <Row label="Point of control (24h)" value={price(a.poc)} sub="price with the most volume" />
        <Row label="Value area" value={`${price(a.val)} - ${price(a.vah)}`} />
        <Row label="ATR (5 min)" value={price(a.atr)} />
      </Card>

      {s.last_setup ? (
        <Card title="Last setup Nelson found">
          <Pill tone={s.last_setup.side === 'BUY' ? 'good' : 'bad'}>{s.last_setup.side} · {utcClock(s.last_setup.time)}</Pill>
          <T mono style={{ marginTop: 8 }}>
            Entry {price(s.last_setup.entry)} · SL {price(s.last_setup.sl)} · TP {price(s.last_setup.tp)}
          </T>
          {s.last_setup.reasons.map((r, i) => <T key={i} small muted style={{ marginTop: 4 }}>• {r}</T>)}
        </Card>
      ) : null}

      <Card title="High-impact USD news">
        {!s.news.available ? <Banner tone="bad" icon="alert-circle">{"News calendar unavailable - Nelson won't open trades until it loads."}</Banner> : null}
        {s.news.blocked_now ? <Banner tone="warn" icon="newspaper">Trading paused for news: {s.news.reason}</Banner> : null}
        {s.news.available && !s.news.events.length ? <Empty icon="checkmark-circle">No high-impact USD news in the next 3 days.</Empty> : null}
        {s.news.events.map((e, i) => (
          <View key={i} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: C.line }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <T bold style={{ flex: 1 }}>{e.title}</T>
              {e.tier1 ? <Pill tone="bad">TIER 1</Pill> : <Pill tone="warn">HIGH</Pill>}
            </View>
            <T small muted>{utcClock(e.time)} · {timeUntil(e.time)}
              {e.forecast ? ` · forecast ${e.forecast}` : ''}{e.previous ? ` · previous ${e.previous}` : ''}</T>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
