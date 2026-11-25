import { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, Callout, Card, Chip, Divider, Field, MoneyInput, Progress, Screen, SectionTitle, Txt } from '../components/ui.tsx';
import { ShareButton } from '../components/calc.tsx';
import { addDays } from '../lib/calendar.ts';
import { formatK, formatKShort, formatPct, parseAmount } from '../lib/format.ts';
import { sampleSales, summariseSales } from '../lib/sales.ts';
import type { Sale } from '../lib/sales.ts';
import { calcPresumptive, vatRegistration } from '../lib/tax.ts';
import { key, mediumDate } from '../i18n/index.ts';
import { useApp } from '../state/store.tsx';
import { useTheme } from '../theme.ts';

function confirm(message: string, onYes: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(message)) onYes();
    return;
  }
  Alert.alert(message, undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'OK', style: 'destructive', onPress: onYes },
  ]);
}

export default function Business() {
  const { t, data, update, today, toast } = useApp();
  const theme = useTheme();
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [note, setNote] = useState('');

  const s = summariseSales(data.sales, today);
  const reg = vatRegistration(s.last12Months);
  const pres = calcPresumptive(s.last12Months);
  const maxMonth = Math.max(1, ...s.byMonth.map(([, v]) => v));
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(date).getTime());

  const add = () => {
    const value = parseAmount(amount);
    if (!value) return;
    if (!dateOk) {
      toast(t('biz.badDate'));
      return;
    }
    const sale: Sale = { id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, date, amount: value, note: note.trim() || undefined };
    update((d) => ({ ...d, sales: [sale, ...d.sales] }));
    setAmount('');
    setNote('');
    toast(t('biz.added'));
  };

  const sorted = [...data.sales].sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <Screen>
      <Stack.Screen options={{ title: t('biz.title') }} />
      <Txt muted>{t('biz.intro')}</Txt>

      <View style={{ flexDirection: 'row', gap: 10 }}>
        {[
          [t('biz.month'), s.thisMonth],
          [t('biz.quarter'), s.thisQuarter],
          [t('biz.year'), s.last12Months],
        ].map(([label, value]) => (
          <Card key={String(label)} style={{ flex: 1, padding: 12, gap: 4 }}>
            <Txt variant="small" muted numberOfLines={2} style={{ fontWeight: '700' }}>
              {String(label)}
            </Txt>
            <Txt variant="heading" numberOfLines={1}>
              {formatKShort(Number(value))}
            </Txt>
          </Card>
        ))}
      </View>

      <Card>
        <SectionTitle title={t('biz.chart')} />
        <View style={styles.chart} accessibilityRole="image" accessibilityLabel={s.byMonth.map(([m, v]) => `${m}: ${formatK(v)}`).join(', ')}>
          {s.byMonth.map(([m, v]) => (
            <View key={m} style={styles.barCol}>
              <Txt variant="small" muted style={{ fontSize: 10 }} numberOfLines={1}>
                {v ? formatKShort(v >= 1_000_000 ? v : Math.round(v / 1000) * 1000) : ''}
              </Txt>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${Math.max(3, (v / maxMonth) * 100)}%`, backgroundColor: v ? theme.primary : theme.line }]} />
              </View>
              <Txt variant="small" muted style={{ fontSize: 11, fontWeight: '700' }}>
                {t(key(`mon.${Number(m.slice(5))}`))}
              </Txt>
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title={t('biz.vatMeter')} />
        <Progress value={reg.share} tone={reg.mustRegister ? 'danger' : reg.share > 0.8 ? 'warn' : 'primary'} />
        <Txt variant="small" muted>
          {reg.mustRegister ? t('reg.must.body') : `${t('reg.of', { share: formatPct(reg.share, 0) })} · ${t('reg.not.body', { remaining: formatK(reg.remaining) })}`}
        </Txt>
        <Divider />
        <Pressable onPress={() => router.push('/calc/presumptive')} accessibilityRole="button" style={{ gap: 4 }}>
          <Txt variant="label" muted>
            {t('biz.presumptive')}
          </Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Txt style={{ fontWeight: '800', flex: 1 }}>
              {pres.eligible
                ? pres.annualTax > 0
                  ? t('biz.presumptiveValue', { annual: formatK(pres.annualTax), quarterly: formatK(pres.quarterly) })
                  : t('biz.presumptiveFree')
                : t('biz.presumptiveOver')}
            </Txt>
            <Ionicons name="chevron-forward" size={16} color={theme.faint} />
          </View>
        </Pressable>
      </Card>

      <Card>
        <SectionTitle title={t('biz.add')} />
        <MoneyInput label={t('biz.amount')} value={amount} onChange={setAmount} />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Chip label={t('common.today')} selected={date === today} onPress={() => setDate(today)} />
          <Chip label={t('common.yesterday')} selected={date === addDays(today, -1)} onPress={() => setDate(addDays(today, -1))} />
        </View>
        <Field label={t('biz.date')} value={date} onChange={setDate} keyboardType="numbers-and-punctuation" maxLength={10} />
        <Field label={t('biz.note')} value={note} onChange={setNote} maxLength={60} />
        <Button title={t('biz.addButton')} icon="add" disabled={!parseAmount(amount)} onPress={add} />
      </Card>

      <Card style={{ gap: 6 }}>
        <SectionTitle title={`${t('biz.entries')} (${data.sales.length})`} />
        {sorted.length === 0 ? (
          <>
            <Txt muted>{t('biz.empty')}</Txt>
            <Button small kind="secondary" icon="sparkles" title={t('biz.sample')} onPress={() => update((d) => ({ ...d, sales: sampleSales(today) }))} />
          </>
        ) : (
          sorted.slice(0, 50).map((sale, i) => (
            <View key={sale.id}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                <View style={{ flex: 1 }}>
                  <Txt style={{ fontWeight: '800' }}>{formatK(sale.amount)}</Txt>
                  <Txt variant="small" muted>
                    {sale.note ? `${mediumDate(t, sale.date)} · ${sale.note}` : mediumDate(t, sale.date)}
                  </Txt>
                </View>
                <Pressable
                  onPress={() => update((d) => ({ ...d, sales: d.sales.filter((x) => x.id !== sale.id) }))}
                  accessibilityRole="button"
                  accessibilityLabel={t('common.delete')}
                  hitSlop={8}
                >
                  <Ionicons name="trash-outline" size={20} color={theme.faint} />
                </Pressable>
              </View>
            </View>
          ))
        )}
      </Card>

      {data.sales.length > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <ShareButton text={t('biz.shareText', { month: formatK(s.thisMonth), quarter: formatK(s.thisQuarter), year: formatK(s.last12Months) })} />
          <Button small kind="danger" icon="trash" title={t('biz.clear')} onPress={() => confirm(t('biz.clearConfirm'), () => update((d) => ({ ...d, sales: [] })))} />
        </View>
      ) : null}

      <Callout tone="neutral" icon="lock-closed">
        {t('help.a3')}
      </Callout>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chart: { flexDirection: 'row', alignItems: 'flex-end', height: 150, gap: 8 },
  barCol: { flex: 1, height: '100%', alignItems: 'center', gap: 4 },
  barTrack: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '70%', borderRadius: 8, minHeight: 4 },
});
