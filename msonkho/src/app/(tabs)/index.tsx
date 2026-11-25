import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Badge, Button, Card, IconBubble, SectionTitle, Txt } from '../../components/ui.tsx';
import type { IconName } from '../../components/ui.tsx';
import { deadlineDesc, deadlineTitle, deadlineTone } from '../../components/brand.tsx';
import { countdown, longDate, shortDate } from '../../i18n/index.ts';
import type { TKey } from '../../i18n/index.ts';
import { useApp } from '../../state/store.tsx';
import { BRAND, LIME, useTheme } from '../../theme.ts';
import type { Tone } from '../../theme.ts';

const QUICK: { label: TKey; icon: IconName; tone: Tone; href: Href }[] = [
  { label: 'quick.paye', icon: 'people', tone: 'info', href: '/calc/paye' },
  { label: 'quick.vat', icon: 'receipt', tone: 'orange', href: '/calc/vat' },
  { label: 'quick.scan', icon: 'qr-code', tone: 'purple', href: '/scan' },
  { label: 'quick.pay', icon: 'card', tone: 'primary', href: '/pay' },
  { label: 'quick.wht', icon: 'cut', tone: 'info', href: '/calc/wht' },
  { label: 'quick.imports', icon: 'boat', tone: 'orange', href: '/calc/imports' },
  { label: 'quick.business', icon: 'storefront', tone: 'purple', href: '/business' },
  { label: 'quick.learn', icon: 'school', tone: 'primary', href: '/learn' },
];

const CHANGES: { key: 'vat' | 'paye' | 'threshold' | 'eis' | 'winnings' | 'levy'; icon: IconName; tone: Tone }[] = [
  { key: 'vat', icon: 'trending-up', tone: 'orange' },
  { key: 'paye', icon: 'people', tone: 'info' },
  { key: 'threshold', icon: 'storefront', tone: 'primary' },
  { key: 'eis', icon: 'qr-code', tone: 'purple' },
  { key: 'winnings', icon: 'trophy', tone: 'orange' },
  { key: 'levy', icon: 'swap-horizontal', tone: 'info' },
];

function greetingKey(): TKey {
  const hour = new Date().getHours();
  return hour < 12 ? 'greet.morning' : hour < 17 ? 'greet.afternoon' : 'greet.evening';
}

export default function Home() {
  const { data, t, today, open, update, toast } = useApp();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const next = open.find((d) => !d.informational) ?? open[0];
  const name = data.settings.name;

  const markDone = (k: string) => {
    update((d) => ({ ...d, done: { ...d.done, [k]: true } }));
    toast(t('cal.doneToast'));
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: 32 }}>
      <View style={[styles.hero, { paddingTop: insets.top + 18 }]}>
        <View style={[styles.circle, { width: 260, height: 260, top: -90, right: -90 }]} />
        <View style={[styles.circle, { width: 120, height: 120, bottom: 10, left: -50 }]} />
        <View style={styles.heroTop}>
          <Text style={styles.wordmark} accessibilityRole="header">
            Msonkho<Text style={{ color: LIME }}>Pocket</Text>
          </Text>
          <Pressable onPress={() => router.push('/about')} style={styles.demoPill} accessibilityRole="button" accessibilityLabel={t('app.disclaimer')}>
            <Text style={styles.demoText}>{t('app.demo').toUpperCase()}</Text>
          </Pressable>
        </View>
        <Text style={styles.greet}>
          {t(greetingKey())}
          {name ? `, ${name}` : ''}
        </Text>
        <Text style={styles.date}>{longDate(t, today)}</Text>
      </View>

      <View style={styles.body}>
        <Card style={{ gap: 10 }}>
          <Txt variant="label" color={theme.primary}>
            {t('home.nextDeadline')}
          </Txt>
          {next ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Txt variant="title">{deadlineTitle(t, next)}</Txt>
                  <Txt muted>{`${deadlineDesc(t, next)} · ${shortDate(t, next.due)}`}</Txt>
                </View>
                <Badge label={countdown(t, next.daysLeft)} tone={deadlineTone(next)} />
              </View>
              {next.informational ? (
                <Button small kind="secondary" title={t('common.learnMore')} icon="book" onPress={() => router.push('/learn/paye')} />
              ) : (
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <Button small kind="secondary" title={t('home.howToPay')} icon="card" onPress={() => router.push('/pay')} style={{ flex: 1 }} />
                  <Button small kind="ghost" title={t('home.markDone')} icon="checkmark" onPress={() => markDone(next.key)} style={{ flex: 1 }} />
                </View>
              )}
            </>
          ) : (
            <>
              <Txt muted>{t('home.noDeadlines')}</Txt>
              <Button small kind="secondary" title={t('home.setProfile')} icon="person" onPress={() => router.push('/settings')} />
            </>
          )}
        </Card>

        <SectionTitle title={t('home.quick')} />
        <View style={styles.grid}>
          {QUICK.map((q) => (
            <Pressable
              key={q.label}
              onPress={() => router.push(q.href)}
              accessibilityRole="button"
              accessibilityLabel={t(q.label)}
              style={({ pressed }) => [styles.quick, { backgroundColor: theme.card, borderColor: theme.line }, pressed && { opacity: 0.75 }]}
            >
              <IconBubble name={q.icon} tone={q.tone} size={42} />
              <Text style={[styles.quickLabel, { color: theme.text }]} numberOfLines={1} adjustsFontSizeToFit>
                {t(q.label)}
              </Text>
            </Pressable>
          ))}
        </View>

        <SectionTitle title={t('home.changes')} action={{ label: t('home.seeAll'), onPress: () => router.push('/learn/changes-2026') }} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 16 }} style={{ marginRight: -16 }}>
          {CHANGES.map((c) => (
            <Card key={c.key} style={styles.change} onPress={() => router.push('/learn/changes-2026')}>
              <IconBubble name={c.icon} tone={c.tone} size={36} />
              <Txt variant="heading" numberOfLines={1}>
                {t(`change.${c.key}.title` as TKey)}
              </Txt>
              <Txt variant="small" muted numberOfLines={3}>
                {t(`change.${c.key}.body` as TKey)}
              </Txt>
            </Card>
          ))}
        </ScrollView>

        <SectionTitle title={t('home.account')} />
        <Card onPress={() => router.push('/account')} accessibilityLabel={t('home.accountOpen')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <IconBubble name="wallet" tone="primary" />
            <View style={{ flex: 1 }}>
              <Txt style={{ fontWeight: '800' }}>{name || 'Demo Taxpayer'}</Txt>
              <Txt variant="small" muted>
                TPIN 0000 0000
              </Txt>
            </View>
            <Badge label={t('home.accountSample')} tone="warn" />
          </View>
          <View style={styles.stats}>
            <View style={[styles.stat, { backgroundColor: theme.cardAlt }]}>
              <Txt variant="label" muted>
                {t('home.accountBalance')}
              </Txt>
              <Txt variant="number">K0.00</Txt>
            </View>
            <View style={[styles.stat, { backgroundColor: theme.cardAlt }]}>
              <Txt variant="label" muted>
                {t('home.accountTcc')}
              </Txt>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="checkmark-circle" size={18} color={theme.primary} />
                <Txt variant="small" style={{ fontWeight: '800', flex: 1 }}>
                  {t('home.accountTccValue')}
                </Txt>
              </View>
            </View>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <Txt variant="small" color={theme.primary} style={{ fontWeight: '800' }}>
              {t('home.accountOpen')}
            </Txt>
            <Ionicons name="arrow-forward" size={14} color={theme.primary} />
          </View>
        </Card>

        <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: theme.warnSoft, borderColor: theme.warnSoft }}>
          <Ionicons name="lock-closed" size={22} color={theme.warn} />
          <View style={{ flex: 1, gap: 6 }}>
            <Txt variant="small">{t('home.safety')}</Txt>
            <Pressable onPress={() => router.push('/scan?mode=check')} accessibilityRole="button" hitSlop={8}>
              <Txt variant="small" color={theme.warn} style={{ fontWeight: '800' }}>
                {`${t('home.checkLink')} →`}
              </Txt>
            </Pressable>
          </View>
        </Card>

        <Txt variant="small" muted align="center" style={{ paddingHorizontal: 12 }}>
          {t('app.disclaimer')}
        </Txt>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: BRAND, paddingHorizontal: 20, paddingBottom: 66, gap: 4, overflow: 'hidden' },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  wordmark: { color: '#ffffff', fontSize: 26, fontWeight: '800', letterSpacing: -0.6 },
  demoPill: { backgroundColor: 'rgba(255,255,255,0.16)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  demoText: { color: '#ffffff', fontSize: 12, fontWeight: '800', letterSpacing: 0.8 },
  greet: { color: '#ffffff', fontSize: 22, fontWeight: '800' },
  date: { color: LIME, fontSize: 14, fontWeight: '700' },
  body: { paddingHorizontal: 16, marginTop: -46, gap: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  quick: {
    width: '22.6%',
    flexGrow: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickLabel: { fontSize: 13, fontWeight: '700' },
  change: { width: 230, gap: 8 },
  stats: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, borderRadius: 14, padding: 12, gap: 6 },
});
