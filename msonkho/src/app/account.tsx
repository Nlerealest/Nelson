import { View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Bullets, Callout, Card, Divider, IconBubble, Row, Screen, SectionTitle, Txt } from '../components/ui.tsx';
import { formatK } from '../lib/format.ts';
import { useApp } from '../state/store.tsx';
import { useTheme } from '../theme.ts';

// Sample records only: they show what an account view connected to
// Msonkho Online could look like. Nothing here comes from MRA.
const RETURNS = [
  { tax: 'VAT', period: 'Oct 2026', date: '20 Nov 2026' },
  { tax: 'PAYE', period: 'Oct 2026', date: '12 Nov 2026' },
  { tax: 'WHT', period: 'Oct 2026', date: '12 Nov 2026' },
];
const PAYMENTS = [
  { tax: 'VAT', amount: 845_300, via: 'Airtel Money', date: '20 Nov 2026' },
  { tax: 'PAYE', amount: 412_000, via: 'Bank transfer', date: '12 Nov 2026' },
  { tax: 'WHT', amount: 58_500, via: 'TNM Mpamba', date: '12 Nov 2026' },
];

export default function Account() {
  const { t, data } = useApp();
  const theme = useTheme();
  return (
    <Screen>
      <Stack.Screen options={{ title: t('acc.title') }} />
      <Callout tone="warn" icon="flask">
        {t('acc.banner')}
      </Callout>

      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <IconBubble name="person" tone="primary" size={48} />
          <View style={{ flex: 1, gap: 2 }}>
            <Txt variant="heading">{data.settings.name || 'Demo Taxpayer'}</Txt>
            <Txt variant="small" muted>
              {`${t('acc.tpin')} 0000 0000 · ${t('acc.office')}: ${t('acc.officeValue')}`}
            </Txt>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, backgroundColor: theme.cardAlt, borderRadius: 14, padding: 12, gap: 6 }}>
            <Txt variant="label" muted>
              {t('acc.due')}
            </Txt>
            <Txt variant="number">K0.00</Txt>
            <Badge label={t('acc.noArrears')} tone="primary" />
          </View>
          <View style={{ flex: 1, backgroundColor: theme.cardAlt, borderRadius: 14, padding: 12, gap: 6 }}>
            <Txt variant="label" muted>
              {t('acc.tcc')}
            </Txt>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="checkmark-circle" size={20} color={theme.primary} />
              <Txt variant="small" style={{ flex: 1, fontWeight: '800' }}>
                {t('acc.tccValid')}
              </Txt>
            </View>
          </View>
        </View>
      </Card>

      <Card style={{ gap: 6 }}>
        <SectionTitle title={t('acc.returns')} />
        {RETURNS.map((r, i) => (
          <View key={r.tax} style={{ gap: 6 }}>
            {i > 0 ? <Divider /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <IconBubble name="document-text" tone="info" size={34} />
              <View style={{ flex: 1 }}>
                <Txt style={{ fontWeight: '800' }}>{`${r.tax} · ${r.period}`}</Txt>
                <Txt variant="small" muted>
                  {r.date}
                </Txt>
              </View>
              <Badge label={t('acc.filed')} tone="primary" />
            </View>
          </View>
        ))}
      </Card>

      <Card style={{ gap: 6 }}>
        <SectionTitle title={t('acc.payments')} />
        {PAYMENTS.map((p, i) => (
          <View key={p.tax} style={{ gap: 6 }}>
            {i > 0 ? <Divider /> : null}
            <Row label={`${p.tax} · ${p.via} · ${p.date}`} value={formatK(p.amount)} />
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle title={t('acc.future')} />
        <Bullets items={[t('acc.f1'), t('acc.f2'), t('acc.f3'), t('acc.f4'), t('acc.f5'), t('acc.f6')]} />
      </Card>
    </Screen>
  );
}
