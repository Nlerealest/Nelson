import { useState } from 'react';
import { Stack } from 'expo-router';
import { Button, Callout, Card, MoneyInput, Progress, Screen, Txt } from '../../components/ui.tsx';
import { RatesFooter } from '../../components/calc.tsx';
import { formatK, formatPct, formatTyping, parseAmount } from '../../lib/format.ts';
import { summariseSales } from '../../lib/sales.ts';
import { vatRegistration } from '../../lib/tax.ts';
import { useApp } from '../../state/store.tsx';

export default function VatRegistrationCheck() {
  const { t, data, today } = useApp();
  const fromSales = data.sales.length ? summariseSales(data.sales, today).last12Months : 0;
  const [text, setText] = useState(fromSales > 0 ? formatTyping(String(Math.round(fromSales))) : '32,000,000');
  const r = vatRegistration(parseAmount(text));

  return (
    <Screen>
      <Stack.Screen options={{ title: t('reg.title') }} />
      <Card>
        <MoneyInput label={t('reg.turnover')} value={text} onChange={setText} />
        {fromSales > 0 ? (
          <Button small kind="secondary" icon="storefront" title={t('pres.useSales', { amount: formatK(fromSales) })} onPress={() => setText(formatTyping(String(Math.round(fromSales))))} />
        ) : null}
      </Card>
      <Card>
        <Callout tone={r.mustRegister ? 'danger' : 'primary'} icon={r.mustRegister ? 'alert-circle' : 'checkmark-circle'} title={r.mustRegister ? t('reg.must.title') : t('reg.not.title')}>
          {r.mustRegister ? t('reg.must.body') : t('reg.not.body', { remaining: formatK(r.remaining) })}
        </Callout>
        <Progress value={r.share} tone={r.mustRegister ? 'danger' : r.share > 0.8 ? 'warn' : 'primary'} />
        <Txt variant="small" muted>
          {t('reg.of', { share: formatPct(Math.min(r.share, 9.99), 0) })}
        </Txt>
      </Card>
      <Callout tone="info">{t('reg.note')}</Callout>
      <RatesFooter />
    </Screen>
  );
}
