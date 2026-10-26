import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useNelson } from '../../nelson';
import CandleChart, { tradeLines } from '../../components/CandleChart';
import { Button, Card, Empty, Pill, Row, Screen, T } from '../../components/ui';
import { C } from '../../theme';
import { price, trendLabel, utcClock } from '../../format';

export default function Chart() {
  const { snap: s } = useNelson();
  const [levels, setLevels] = useState(true);
  if (!s?.chart?.length) return <Screen><Card><Empty icon="stats-chart">{"Chart appears after Nelson's first analysis."}</Empty></Card></Screen>;
  const a = s.analysis || {};
  const lines = tradeLines(s);
  return (
    <Screen>
      <Card style={{ paddingHorizontal: 8 }}>
        <View style={[styles.between, { paddingHorizontal: 8, marginBottom: 6 }]}>
          <T bold>XAUUSD · M5</T>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pill tone={a.trend > 0 ? 'good' : a.trend < 0 ? 'bad' : 'neutral'}>H1 {trendLabel(a.trend)}</Pill>
            {a.zone ? <Pill tone={a.zone === 'premium' ? 'bad' : 'good'}>{a.zone}</Pill> : null}
          </View>
        </View>
        <CandleChart candles={s.chart} levels={s.levels} lines={lines} lastPrice={s.price?.bid} showLevels={levels} height={360} />
        <T small muted style={{ paddingHorizontal: 8, marginTop: 4 }}>
          Last 10 hours · {utcClock(new Date(s.chart[s.chart.length - 1][0]).toISOString())}
        </T>
        <Button title={levels ? 'Hide liquidity levels' : 'Show liquidity levels'} tone="gold" outline icon="layers"
          style={{ marginTop: 10, marginHorizontal: 8, paddingVertical: 10 }} onPress={() => setLevels(!levels)} />
      </Card>

      <Card title="Legend">
        <Legend color="#9aa6ff" text="Buy-side liquidity: stops resting above highs" dashed />
        <Legend color="#d4a5ff" text="Sell-side liquidity: stops resting below lows" dashed />
        <Legend color={C.blue} text="Entry of an open trade" />
        <Legend color={C.orange} text="Pending limit order" dashed />
        <Legend color={C.red} text="Stop loss" dashed />
        <Legend color={C.green} text="Take profit" dashed />
      </Card>

      <Card title="Key levels">
        {a.nearest_bsl ? <Row label={`Next buy-side: ${a.nearest_bsl.name}`} value={price(a.nearest_bsl.price)}
          sub={`${(a.nearest_bsl.price - a.price).toFixed(2)} away`} /> : null}
        {a.nearest_ssl ? <Row label={`Next sell-side: ${a.nearest_ssl.name}`} value={price(a.nearest_ssl.price)}
          sub={`${(a.nearest_ssl.price - a.price).toFixed(2)} away`} /> : null}
        <Row label="H1 equilibrium" value={price(a.equilibrium)} />
        <Row label="Previous day high / low" value={`${price(a.pdh)} / ${price(a.pdl)}`} />
        <Row label="Asian range" value={`${price(a.asia_low)} - ${price(a.asia_high)}`} />
      </Card>
    </Screen>
  );
}

function Legend({ color, text, dashed }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 4 }}>
      <View style={{ width: 22, borderTopWidth: 2, borderColor: color, borderStyle: dashed ? 'dashed' : 'solid', marginRight: 10 }} />
      <T small>{text}</T>
    </View>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
