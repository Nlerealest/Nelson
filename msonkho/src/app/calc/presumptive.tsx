import { useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { Badge, Button, Callout, Card, Divider, MoneyInput, ResultHero, Row, Screen, SectionTitle, Txt } from '../../components/ui.tsx';
import { RatesFooter } from '../../components/calc.tsx';
import { PRESUMPTIVE_BANDS } from '../../data/rates.ts';
import { formatK, formatKShort, formatTyping, parseAmount } from '../../lib/format.ts';
import { summariseSales } from '../../lib/sales.ts';
import { calcPresumptive } from '../../lib/tax.ts';
import { useApp } from '../../state/store.tsx';
import { useTheme } from '../../theme.ts';

export default function PresumptiveCalculator() {
  const { t, data, today } = useApp();
  const theme = useTheme();
  const [text, setText] = useState('8,500,000');
  const r = calcPresumptive(parseAmount(text));
  const fromSales = data.sales.length ? summariseSales(data.sales, today).last12Months : 0;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('pres.title') }} />
      <Card>
        <MoneyInput label={t('pres.turnover')} value={text} onChange={setText} />
        {fromSales > 0 ? (
          <Button small kind="secondary" icon="storefront" title={t('pres.useSales', { amount: formatK(fromSales) })} onPress={() => setText(formatTyping(String(Math.round(fromSales))))} />
        ) : null}
      </Card>

      <Card>
        {r.eligible ? (
          <>
            <ResultHero label={t('pres.annual')} value={formatK(r.annualTax)} sub={`${t('pres.quarterly')}: ${formatK(r.quarterly)}`} tone="primary" />
            {r.annualTax === 0 ? <Callout tone="primary" icon="checkmark-circle">{t('pres.free')}</Callout> : null}
            <Row label={t('pres.turnover')} value={formatK(r.turnover)} />
            <Row label={t('pres.quarterly')} value={formatK(r.quarterly)} />
            <Divider />
            <Row label={t('pres.annual')} value={formatK(r.annualTax)} strong />
          </>
        ) : (
          <>
            <Callout tone="warn" icon="alert-circle" title={t('pres.over.title')}>
              {t('pres.over.body')}
            </Callout>
            {r.mustRegisterVat ? (
              <Callout tone="danger" icon="receipt">
                {t('pres.vat')}
              </Callout>
            ) : null}
          </>
        )}
      </Card>

      <Card style={{ gap: 8 }}>
        <SectionTitle title={t('pres.table')} />
        {PRESUMPTIVE_BANDS.map((band, i) => {
          const from = i === 0 ? 0 : PRESUMPTIVE_BANDS[i - 1].upTo;
          const active = r.eligible && r.bandIndex === i;
          return (
            <View
              key={band.upTo}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 10,
                borderRadius: 12,
                backgroundColor: active ? theme.primarySoft : 'transparent',
              }}
            >
              <Txt variant="small" style={{ flex: 1, fontWeight: active ? '800' : '600' }}>
                {t('pres.bandRow', { from: formatKShort(from), to: formatKShort(band.upTo) })}
              </Txt>
              <Txt variant="small" style={{ fontWeight: '800' }}>
                {formatK(band.annualTax)}
              </Txt>
              {active ? <Badge label="✓" tone="primary" /> : null}
            </View>
          );
        })}
      </Card>

      <Callout tone="info" icon="calendar">
        {t('pres.due')}
      </Callout>
      <Callout tone="warn" icon="time">
        {t('pres.note')}
      </Callout>
      <RatesFooter />
    </Screen>
  );
}
