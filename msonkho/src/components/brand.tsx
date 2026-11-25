// Pieces shared by several screens: the brand mark, taxpayer-type icons and
// a deadline row.

import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Deadline, TaxpayerType } from '../lib/calendar.ts';
import { parseKey } from '../lib/calendar.ts';
import { countdown, key, periodLabel } from '../i18n/index.ts';
import type { T } from '../i18n/index.ts';
import { useTheme } from '../theme.ts';
import type { Tone } from '../theme.ts';
import { Badge, Txt } from './ui.tsx';
import type { IconName } from './ui.tsx';

export function BrandMark({ size = 56 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/brand-mark.png')}
      style={{ width: size, height: size, borderRadius: size * 0.28 }}
      accessibilityIgnoresInvertColors
      accessible={false}
    />
  );
}

export const TYPE_ICONS: Record<TaxpayerType, IconName> = {
  employee: 'person',
  employer: 'people',
  vat: 'receipt',
  smallBusiness: 'storefront',
  company: 'business',
  importer: 'boat',
};

export const DEADLINE_ICONS: Record<Deadline['id'], IconName> = {
  payslip: 'person',
  paye: 'people',
  wht: 'cut',
  fbt: 'car',
  vat: 'receipt',
  presumptive: 'storefront',
  provisional: 'trending-up',
  annualReturn: 'document-text',
};

export function deadlineTone(d: Deadline): Tone {
  if (d.informational) return 'neutral';
  if (d.daysLeft < 0) return 'danger';
  if (d.daysLeft <= 3) return 'warn';
  return 'primary';
}

export function deadlineTitle(t: T, d: Deadline): string {
  return t(key(`dl.${d.id}`));
}

export function deadlineDesc(t: T, d: Deadline): string {
  return t(key(`dl.${d.id}.desc`), { period: periodLabel(t, d.period) });
}

/** One deadline: a date block, what it is, the countdown and a "done" tick. */
export function DeadlineRow({
  d,
  t,
  done,
  onToggleDone,
  onPress,
}: {
  d: Deadline;
  t: T;
  done?: boolean;
  onToggleDone?: () => void;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const { day, month } = parseKey(d.due);
  const tone = done ? 'neutral' : deadlineTone(d);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${deadlineTitle(t, d)}. ${deadlineDesc(t, d)}. ${countdown(t, d.daysLeft)}`}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.75 }]}
    >
      <View style={[styles.dateBlock, { backgroundColor: done ? theme.cardAlt : theme.primarySoft }]}>
        <Text style={[styles.day, { color: done ? theme.faint : theme.primary }]}>{day}</Text>
        <Text style={[styles.mon, { color: done ? theme.faint : theme.primary }]}>{t(key(`mon.${month}`))}</Text>
      </View>
      <View style={{ flex: 1, gap: 3 }}>
        <Txt style={[{ fontWeight: '800' }, done && { textDecorationLine: 'line-through', color: theme.faint }]} numberOfLines={1}>
          {deadlineTitle(t, d)}
        </Txt>
        <Txt variant="small" muted numberOfLines={2}>
          {deadlineDesc(t, d)}
        </Txt>
        {!done ? <Badge label={countdown(t, d.daysLeft)} tone={tone} /> : null}
      </View>
      {onToggleDone && !d.informational ? (
        <Pressable
          onPress={onToggleDone}
          hitSlop={8}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: !!done }}
          accessibilityLabel={done ? t('cal.undo') : t('cal.markDone')}
          style={[styles.tick, { borderColor: done ? theme.primary : theme.line, backgroundColor: done ? theme.primary : 'transparent' }]}
        >
          {done ? <Ionicons name="checkmark" size={18} color={theme.onPrimary} /> : null}
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  dateBlock: { width: 54, height: 58, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  day: { fontSize: 22, fontWeight: '800', lineHeight: 26 },
  mon: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' },
  tick: { width: 32, height: 32, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
});
