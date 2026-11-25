import { useState } from 'react';
import { View } from 'react-native';
import { Stack } from 'expo-router';
import { Callout, Card, Chip, Divider, Field, FieldLabel, MoneyInput, ResultHero, Row, Screen } from '../../components/ui.tsx';
import { RatesFooter } from '../../components/calc.tsx';
import { formatK, parseAmount } from '../../lib/format.ts';
import { calcImport } from '../../lib/tax.ts';
import type { TKey } from '../../i18n/index.ts';
import { useApp } from '../../state/store.tsx';

// Example starting points only; the user can change both rates.
const PRESETS: { label: TKey; duty: string; excise: string }[] = [
  { label: 'imp.presetGeneral', duty: '25', excise: '0' },
  { label: 'imp.presetCar', duty: '25', excise: '15' },
  { label: 'imp.presetEv', duty: '0', excise: '0' },
];

export default function ImportEstimator() {
  const { t } = useApp();
  const [cif, setCif] = useState('6,000,000');
  const [duty, setDuty] = useState('25');
  const [excise, setExcise] = useState('15');
  const r = calcImport({ cif: parseAmount(cif), dutyRate: parseAmount(duty) / 100, exciseRate: parseAmount(excise) / 100 });

  return (
    <Screen>
      <Stack.Screen options={{ title: t('imp.title') }} />
      <Card>
        <MoneyInput label={t('imp.cif')} value={cif} onChange={setCif} hint={t('imp.cifHint')} />
        <FieldLabel>{t('imp.preset')}</FieldLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {PRESETS.map((p) => (
            <Chip
              key={p.label}
              label={t(p.label)}
              selected={duty === p.duty && excise === p.excise}
              onPress={() => {
                setDuty(p.duty);
                setExcise(p.excise);
              }}
            />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label={t('imp.duty')} value={duty} onChange={(v) => setDuty(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" maxLength={5} />
          </View>
          <View style={{ flex: 1 }}>
            <Field label={t('imp.excise')} value={excise} onChange={(v) => setExcise(v.replace(/[^0-9.]/g, ''))} keyboardType="decimal-pad" maxLength={5} />
          </View>
        </View>
      </Card>

      <Card>
        <ResultHero label={t('imp.taxes')} value={formatK(r.taxes)} tone="info" sub={t('common.estimate')} />
        <Row label={t('imp.cif')} value={formatK(r.cif)} />
        <Row label={`${t('imp.dutyAmount')} (${duty || 0}%)`} value={formatK(r.duty)} />
        <Row label={`${t('imp.exciseAmount')} (${excise || 0}%)`} value={formatK(r.excise)} />
        <Row label={t('imp.vatAmount')} value={formatK(r.vat)} />
        <Divider />
        <Row label={t('imp.landed')} value={formatK(r.landed)} strong />
      </Card>

      <Callout tone="warn" icon="alert-circle">
        {t('imp.note')}
      </Callout>
      <RatesFooter />
    </Screen>
  );
}
