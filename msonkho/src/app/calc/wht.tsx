import { useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { Callout, Card, Chip, Divider, FieldLabel, MoneyInput, ResultHero, Row, Screen } from '../../components/ui.tsx';
import { RatesFooter } from '../../components/calc.tsx';
import { WHT_RATES } from '../../data/rates.ts';
import type { WhtId } from '../../data/rates.ts';
import { formatK, formatPct, parseAmount } from '../../lib/format.ts';
import { calcWht } from '../../lib/tax.ts';
import { key } from '../../i18n/index.ts';
import { useApp } from '../../state/store.tsx';

export default function WhtCalculator() {
  const { t } = useApp();
  const [type, setType] = useState<WhtId>('services');
  const [text, setText] = useState('250,000');
  const r = calcWht(type, parseAmount(text));

  return (
    <Screen>
      <Stack.Screen options={{ title: t('wht.title') }} />
      <Card>
        <FieldLabel>{t('wht.type')}</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {WHT_RATES.map((w) => (
            <Chip key={w.id} label={`${t(key(`wht.${w.id}`))} · ${formatPct(w.rate)}`} selected={w.id === type} onPress={() => setType(w.id)} />
          ))}
        </View>
        <MoneyInput label={t('wht.amount')} value={text} onChange={setText} />
      </Card>

      <Card>
        <ResultHero label={t('wht.withhold')} value={formatK(r.wht)} sub={`${t(key(`wht.${type}`))} · ${t('wht.rate')} ${formatPct(r.type.rate)}`} tone="purple" />
        <Row label={t('wht.amount')} value={formatK(r.amount)} />
        <Row label={`${t('wht.withhold')} (${formatPct(r.applies ? r.type.rate : 0)})`} value={`−${formatK(r.wht)}`} />
        <Divider />
        <Row label={t('wht.payPayee')} value={formatK(r.netToPayee)} strong tone="primary" />
        {!r.applies && r.type.exemptUpTo !== undefined ? (
          <Callout tone="primary" icon="checkmark-circle">
            {t('wht.exempt', { limit: formatK(r.type.exemptUpTo) })}
          </Callout>
        ) : null}
        <Callout tone="neutral" icon={r.type.final ? 'lock-closed' : 'swap-horizontal'}>
          {r.type.final ? t('wht.final') : t('wht.credit')}
        </Callout>
        {type === 'produce' ? <Callout tone="info">{t('wht.produceNote')}</Callout> : null}
      </Card>

      <Callout tone="info" icon="calendar">
        {t('wht.remit')}
      </Callout>
      <Callout tone="warn" icon="document-text">
        {t('wht.note')}
      </Callout>
      <RatesFooter />
    </Screen>
  );
}
