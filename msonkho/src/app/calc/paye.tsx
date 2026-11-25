import { useState } from 'react';
import { View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { Badge, Callout, Card, Divider, MoneyInput, Progress, ResultHero, Row, Screen, SectionTitle, Segmented, SwitchRow, Txt } from '../../components/ui.tsx';
import { RatesFooter, ShareButton } from '../../components/calc.tsx';
import { PENSION_EMPLOYEE } from '../../data/rates.ts';
import { formatK, formatKShort, formatPct, parseAmount } from '../../lib/format.ts';
import { calcPaye, grossFromNet } from '../../lib/tax.ts';
import type { Period } from '../../lib/tax.ts';
import { useApp } from '../../state/store.tsx';

export default function PayeCalculator() {
  const { t } = useApp();
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<'gross' | 'net'>(params.mode === 'net' ? 'net' : 'gross');
  const [period, setPeriod] = useState<Period>('month');
  const [text, setText] = useState(params.mode === 'net' ? '401,000' : '500,000');
  const [pension, setPension] = useState(false);

  const amount = parseAmount(text);
  const pensionRate = pension ? PENSION_EMPLOYEE : 0;
  const r = mode === 'gross' ? calcPaye(amount, period, pensionRate) : grossFromNet(amount, period, pensionRate);
  const per = period === 'month' ? t('common.perMonth') : t('common.perYear');
  const sub = `${t('paye.effective')}: ${formatPct(r.effectiveRate, 1)} · ${t('paye.marginal')}: ${formatPct(r.marginalRate)}`;

  return (
    <Screen>
      <Stack.Screen options={{ title: t('paye.title') }} />
      <Card>
        <Segmented
          options={[
            { value: 'gross', label: t('paye.modeGross') },
            { value: 'net', label: t('paye.modeNet') },
          ]}
          value={mode}
          onChange={setMode}
        />
        <Segmented
          options={[
            { value: 'month', label: t('common.monthly') },
            { value: 'year', label: t('common.yearly') },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <MoneyInput label={mode === 'gross' ? t('paye.gross') : t('paye.net')} value={text} onChange={setText} />
        <SwitchRow title={t('paye.pension')} subtitle={t('paye.pensionHint')} value={pension} onChange={setPension} />
      </Card>

      <Card>
        {mode === 'gross' ? (
          <ResultHero label={`${t('paye.payeLabel')} · ${per}`} value={formatK(r.paye)} sub={sub} tone="info" />
        ) : (
          <ResultHero label={`${t('paye.grossNeeded')} · ${per}`} value={formatK(r.gross)} sub={sub} tone="info" />
        )}
        <Row label={t('paye.gross')} value={formatK(r.gross)} />
        <Row label={t('paye.payeLabel')} value={`−${formatK(r.paye)}`} />
        {pension ? <Row label={t('paye.pensionLabel')} value={`−${formatK(r.pension)}`} /> : null}
        <Divider />
        <Row label={t('paye.takeHome')} value={formatK(r.net)} strong tone="primary" />
        {pension ? <Row label={t('paye.employerPension')} value={formatK(r.employerPension)} /> : null}
        <ShareButton text={t('paye.shareText', { gross: formatK(r.gross), period: per, paye: formatK(r.paye), net: formatK(r.net) })} />
      </Card>

      <Card>
        <SectionTitle title={t('paye.bands')} />
        {r.lines.map((line) => {
          const width = line.to - line.from;
          const fill = Number.isFinite(width) ? line.taxable / width : line.taxable > 0 ? 1 : 0;
          const label = Number.isFinite(line.to)
            ? t('paye.band', { from: formatKShort(line.from), to: formatKShort(line.to) })
            : t('paye.bandTop', { from: formatKShort(line.from) });
          return (
            <View key={line.from} style={{ gap: 6 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Badge label={formatPct(line.rate)} tone={line.taxable > 0 ? 'info' : 'neutral'} />
                <Txt variant="small" style={{ flex: 1, fontWeight: '700' }}>
                  {label}
                </Txt>
                <Txt variant="small" style={{ fontWeight: '800', fontVariant: ['tabular-nums'] }}>
                  {formatK(line.tax)}
                </Txt>
              </View>
              <Progress value={fill} tone={line.taxable > 0 ? 'info' : 'neutral'} />
              <Txt variant="small" muted>
                {`${formatK(line.taxable)} × ${formatPct(line.rate)}`}
              </Txt>
            </View>
          );
        })}
      </Card>

      <Callout tone="info">{t('paye.bandsNote')}</Callout>
      <RatesFooter />
    </Screen>
  );
}
