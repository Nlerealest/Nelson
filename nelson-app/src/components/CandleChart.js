// XAUUSD candles with Nelson's liquidity levels and the open trade's entry / stop / target.
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { G, Line, Rect, Text as SvgText } from 'react-native-svg';
import { C } from '../theme';
import { price, priceRange } from '../format';

const AXIS = 68;          // room on the right for price labels

export default function CandleChart({ candles, levels = [], lines = [], lastPrice, height = 320, showLevels = true }) {
  const [width, setWidth] = useState(0);
  const data = candles || [];
  const plotW = Math.max(width - AXIS, 10);
  const { lo, hi } = priceRange(data, lines.map((l) => l.price));
  const y = (p) => 8 + (1 - (p - lo) / (hi - lo)) * (height - 24);
  const step = data.length ? plotW / data.length : 0;
  const bodyW = Math.max(step * 0.62, 1);

  // levels sorted top to bottom; a label is dropped when it would overlap the one above it
  const shownLevels = (showLevels ? levels.filter((l) => l.price > lo && l.price < hi) : [])
    .sort((a, b) => b.price - a.price);
  const withLabels = shownLevels.reduce((acc, l) => {
    const above = acc.findLast((x) => x.showLabel);
    acc.push({ ...l, showLabel: !above || y(l.price) - y(above.price) >= 12 });
    return acc;
  }, []);
  return (
    <View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height }}>
      {width > 0 && (
        <Svg width={width} height={height}>
          {[0.25, 0.5, 0.75].map((f) => {
            const p = lo + (hi - lo) * f;
            return (
              <G key={f}>
                <Line x1={0} x2={plotW} y1={y(p)} y2={y(p)} stroke={C.line} strokeWidth={1} />
                <SvgText x={plotW + 4} y={y(p) + 4} fill={C.muted} fontSize={10}>{price(p)}</SvgText>
              </G>
            );
          })}
          {withLabels.map((l, i) => (
            <G key={`lv${i}`}>
              <Line x1={0} x2={plotW} y1={y(l.price)} y2={y(l.price)}
                stroke={l.side === 'BSL' ? '#7c8cff' : '#c084fc'} strokeWidth={1} strokeDasharray="2,4" opacity={0.8} />
              {l.showLabel ? (
                <SvgText x={4} y={y(l.price) - 3} fill={l.side === 'BSL' ? '#9aa6ff' : '#d4a5ff'} fontSize={9}>
                  {l.name}
                </SvgText>
              ) : null}
            </G>
          ))}
          {data.map((c, i) => {
            const [, o, h, l, cl] = c;
            const up = cl >= o;
            const x = i * step + step / 2;
            const top = y(Math.max(o, cl));
            const bh = Math.max(Math.abs(y(o) - y(cl)), 1);
            const col = up ? C.green : C.red;
            return (
              <G key={i}>
                <Line x1={x} x2={x} y1={y(h)} y2={y(l)} stroke={col} strokeWidth={1} />
                <Rect x={x - bodyW / 2} y={top} width={bodyW} height={bh} fill={col} />
              </G>
            );
          })}
          {lines.map((ln, i) => (
            <G key={`ln${i}`}>
              <Line x1={0} x2={plotW} y1={y(ln.price)} y2={y(ln.price)} stroke={ln.color} strokeWidth={1.5}
                strokeDasharray={ln.dashed ? '6,4' : undefined} />
              <Rect x={plotW} y={y(ln.price) - 8} width={AXIS} height={16} fill={ln.color} rx={3} />
              <SvgText x={plotW + 3} y={y(ln.price) + 4} fill={C.bg} fontSize={10} fontWeight="bold">
                {ln.label} {price(ln.price)}
              </SvgText>
            </G>
          ))}
          {lastPrice ? (
            <G>
              <Line x1={0} x2={plotW} y1={y(lastPrice)} y2={y(lastPrice)} stroke={C.gold} strokeWidth={1} opacity={0.7} />
              <Rect x={plotW} y={y(lastPrice) - 8} width={AXIS} height={16} fill={C.gold} rx={3} />
              <SvgText x={plotW + 4} y={y(lastPrice) + 4} fill={C.bg} fontSize={10} fontWeight="bold">{price(lastPrice)}</SvgText>
            </G>
          ) : null}
        </Svg>
      )}
    </View>
  );
}

// Entry / stop / target lines for open positions and pending orders
export function tradeLines(snap) {
  const out = [];
  for (const p of snap?.positions || []) {
    out.push({ price: p.open, color: C.blue, label: p.side === 'BUY' ? 'BUY' : 'SELL' });
    if (p.sl) out.push({ price: p.sl, color: C.red, label: 'SL', dashed: true });
    if (p.tp) out.push({ price: p.tp, color: C.green, label: 'TP', dashed: true });
  }
  for (const o of snap?.orders || []) {
    out.push({ price: o.price, color: C.orange, label: 'LMT', dashed: true });
    if (o.sl) out.push({ price: o.sl, color: C.red, label: 'SL', dashed: true });
    if (o.tp) out.push({ price: o.tp, color: C.green, label: 'TP', dashed: true });
  }
  return out;
}
