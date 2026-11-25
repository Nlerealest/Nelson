import { StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { copy, dial } from '../actions.ts';
import { Button, Callout, Card, Field, IconBubble, Screen, SectionTitle, Txt } from '../components/ui.tsx';
import type { IconName } from '../components/ui.tsx';
import type { TKey } from '../i18n/index.ts';
import { useApp } from '../state/store.tsx';
import { useTheme } from '../theme.ts';
import type { Tone } from '../theme.ts';

const STEPS: { title: TKey; body: TKey }[] = [
  { title: 'pay.s1.title', body: 'pay.s1.body' },
  { title: 'pay.s2.title', body: 'pay.s2.body' },
  { title: 'pay.s3.title', body: 'pay.s3.body' },
];

const CHANNELS: { title: TKey; steps: TKey; icon: IconName; tone: Tone; code?: string }[] = [
  { title: 'pay.airtel', steps: 'pay.airtel.steps', icon: 'phone-portrait', tone: 'danger', code: '*211#' },
  { title: 'pay.mpamba', steps: 'pay.mpamba.steps', icon: 'phone-portrait', tone: 'info', code: '*444#' },
  { title: 'pay.bank', steps: 'pay.bank.steps', icon: 'business', tone: 'primary' },
];

export default function Pay() {
  const { t, data, update, toast } = useApp();
  const theme = useTheme();
  const setPrn = (prn: string) => update((d) => ({ ...d, prn: prn.replace(/\s/g, '').slice(0, 30) }));

  return (
    <Screen>
      <Stack.Screen options={{ title: t('pay.title') }} />
      <Card>
        <SectionTitle title={t('pay.steps')} />
        {STEPS.map((s, i) => (
          <View key={s.title} style={{ flexDirection: 'row', gap: 12 }}>
            <View style={[styles.step, { backgroundColor: theme.primary }]}>
              <Text style={{ color: theme.onPrimary, fontWeight: '800' }}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Txt style={{ fontWeight: '800' }}>{t(s.title)}</Txt>
              <Txt variant="small" muted>
                {t(s.body)}
              </Txt>
            </View>
          </View>
        ))}
      </Card>

      <Card>
        <SectionTitle title={t('pay.prn')} />
        <Txt variant="small" muted>
          {t('pay.prnHint')}
        </Txt>
        <Field value={data.prn} onChange={setPrn} placeholder={t('pay.prnPlaceholder')} autoCapitalize="characters" />
        <Button
          small
          kind="secondary"
          icon="copy"
          title={t('common.copy')}
          disabled={!data.prn}
          onPress={async () => {
            if (await copy(data.prn)) toast(t('common.copied'));
          }}
        />
      </Card>

      <SectionTitle title={t('pay.channels')} />
      {CHANNELS.map((c) => (
        <Card key={c.title}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <IconBubble name={c.icon} tone={c.tone} />
            <Txt variant="heading" style={{ flex: 1 }}>
              {t(c.title)}
            </Txt>
          </View>
          <Txt variant="small">{t(c.steps)}</Txt>
          {c.code ? <Button small kind="secondary" icon="keypad" title={t('pay.dial', { code: c.code })} onPress={() => dial(c.code!)} /> : null}
        </Card>
      ))}
      <Txt variant="small" muted align="center">
        {t('pay.menusChange')}
      </Txt>
      <Callout tone="danger" icon="shield">
        {t('pay.warning')}
      </Callout>
    </Screen>
  );
}

const styles = StyleSheet.create({
  step: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
});
