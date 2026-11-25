import { useState } from 'react';
import { Stack } from 'expo-router';
import { Callout, Card, MoneyInput, ResultHero, Screen, Segmented } from '../../components/ui.tsx';
import { RatesFooter } from '../../components/calc.tsx';
import { formatK, parseAmount } from '../../lib/format.ts';
import { transferLevy } from '../../lib/tax.ts';
import type { Channel } from '../../lib/tax.ts';
import { useApp } from '../../state/store.tsx';

export default function LevyCalculator() {
  const { t } = useApp();
  const [channel, setChannel] = useState<Channel>('mobile');
  const [text, setText] = useState('250,000');
  const amount = parseAmount(text);
  const r = transferLevy(amount, channel);

  return (
    <Screen>
      <Stack.Screen options={{ title: t('levy.title') }} />
      <Card>
        <Segmented
          options={[
            { value: 'mobile', label: t('levy.mobile') },
            { value: 'bank', label: t('levy.bank') },
          ]}
          value={channel}
          onChange={setChannel}
        />
        <MoneyInput label={t('levy.amount')} value={text} onChange={setText} />
      </Card>
      <Card>
        <ResultHero label={t('levy.levy')} value={formatK(r.levy)} sub={`${t('common.total')}: ${formatK(amount + r.levy)}`} tone="purple" />
        {r.exempt ? (
          <Callout tone="primary" icon="checkmark-circle">
            {t('levy.free')}
          </Callout>
        ) : null}
      </Card>
      <Callout tone="info">{t('levy.note')}</Callout>
      <RatesFooter />
    </Screen>
  );
}
