import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { dial, mapsSearch, openExternal, openWeb } from '../actions.ts';
import { Button, Callout, Card, Divider, ListRow, Screen, SectionTitle, Txt } from '../components/ui.tsx';
import { MRA, OFFICES } from '../data/content.ts';
import { RATES_CHECKED } from '../data/rates.ts';
import { mediumDate } from '../i18n/index.ts';
import type { TKey } from '../i18n/index.ts';
import { useApp } from '../state/store.tsx';
import { useTheme } from '../theme.ts';

const FAQ: [TKey, TKey][] = [
  ['help.q1', 'help.a1'],
  ['help.q2', 'help.a2'],
  ['help.q3', 'help.a3'],
  ['help.q4', 'help.a4'],
];

export default function Help() {
  const { t, toast } = useApp();
  const theme = useTheme();
  const [openQ, setOpenQ] = useState<TKey | null>('help.q1');
  const failIfNot = (ok: boolean) => !ok && toast(t('common.couldNotOpen'));

  return (
    <Screen>
      <Stack.Screen options={{ title: t('help.title') }} />
      <Card style={{ gap: 4 }}>
        <ListRow icon="call" tone="primary" title={`${t('help.call')} · 672`} subtitle={t('help.callDesc')} onPress={async () => failIfNot(await dial(MRA.callCentre))} />
        <Divider />
        <ListRow icon="mail" tone="info" title={t('help.email')} subtitle={MRA.email} onPress={async () => failIfNot(await openExternal(`mailto:${MRA.email}`))} />
        <Divider />
        <ListRow icon="globe" tone="purple" title={t('help.web')} subtitle={`www.mra.mw · ${t('help.webDesc')}`} onPress={() => openWeb(MRA.website)} />
      </Card>

      <Card style={{ gap: 4 }}>
        <SectionTitle title={t('help.offices')} />
        {OFFICES.map((o, i) => (
          <View key={o.label}>
            {i > 0 ? <Divider /> : null}
            <ListRow
              icon="location"
              tone="orange"
              title={t(o.label)}
              subtitle={o.place}
              onPress={async () => failIfNot(await openExternal(mapsSearch(o.query)))}
              right={<Txt variant="small" color={theme.primary} style={{ fontWeight: '800' }}>{t('common.directions')}</Txt>}
            />
          </View>
        ))}
      </Card>

      <Callout tone="danger" icon="megaphone" title={t('help.report')}>
        <Txt variant="small">{t('help.reportBody')}</Txt>
        <Button small kind="danger" icon="call" title={`${t('common.call')} 672`} onPress={async () => failIfNot(await dial(MRA.callCentre))} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
      </Callout>

      <Card style={{ gap: 4 }}>
        <SectionTitle title={t('help.faq')} />
        {FAQ.map(([q, a], i) => {
          const open = openQ === q;
          return (
            <View key={q}>
              {i > 0 ? <Divider /> : null}
              <Pressable
                onPress={() => setOpenQ(open ? null : q)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 }}
              >
                <Txt style={{ flex: 1, fontWeight: '800' }}>{t(q)}</Txt>
                <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={theme.faint} />
              </Pressable>
              {open ? (
                <Txt variant="small" muted style={{ paddingBottom: 10, lineHeight: 20 }}>
                  {t(a, { date: mediumDate(t, RATES_CHECKED) })}
                </Txt>
              ) : null}
            </View>
          );
        })}
      </Card>
    </Screen>
  );
}
