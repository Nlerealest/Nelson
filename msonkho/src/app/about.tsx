import { Pressable, View } from 'react-native';
import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { openWeb } from '../actions.ts';
import { Badge, Callout, Card, Divider, Screen, SectionTitle, Txt } from '../components/ui.tsx';
import { BrandMark } from '../components/brand.tsx';
import { RATE_FACTS, RATES_CHECKED, SOURCES } from '../data/rates.ts';
import type { Confidence } from '../data/rates.ts';
import { key, mediumDate } from '../i18n/index.ts';
import { useApp } from '../state/store.tsx';
import { useTheme } from '../theme.ts';
import type { Tone } from '../theme.ts';

const CONFIDENCE: Record<Confidence, { label: 'about.official' | 'about.reported' | 'about.older'; tone: Tone }> = {
  official: { label: 'about.official', tone: 'primary' },
  reported: { label: 'about.reported', tone: 'info' },
  older: { label: 'about.older', tone: 'warn' },
};

export default function About() {
  const { t } = useApp();
  const theme = useTheme();
  const version = Constants.expoConfig?.version ?? '2.0.0';
  return (
    <Screen>
      <Stack.Screen options={{ title: t('about.title') }} />
      <Card style={{ alignItems: 'center' }}>
        <BrandMark size={64} />
        <Txt variant="title">{t('app.name')}</Txt>
        <Txt variant="small" muted>
          {t('about.version', { v: version })}
        </Txt>
        <Txt align="center" style={{ lineHeight: 22 }}>
          {t('about.what')}
        </Txt>
      </Card>

      <Callout tone="warn" icon="alert-circle">
        {t('about.disclaimer')}
      </Callout>

      <Card style={{ gap: 6 }}>
        <SectionTitle title={t('about.rates')} />
        <Txt variant="small" muted>
          {`${t('about.checked', { date: mediumDate(t, RATES_CHECKED) })}. ${t('about.legend')}`}
        </Txt>
        {RATE_FACTS.map((f, i) => {
          const c = CONFIDENCE[f.confidence];
          return (
            <View key={f.label} style={{ gap: 6 }}>
              {i > 0 ? <Divider /> : null}
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Txt style={{ flex: 1, fontWeight: '800' }}>{t(key(f.label))}</Txt>
                <Badge label={t(c.label)} tone={c.tone} />
              </View>
              <Txt variant="small">{f.value}</Txt>
              {f.effective ? (
                <Txt variant="small" muted>
                  {t('about.effective', { date: mediumDate(t, f.effective) })}
                </Txt>
              ) : null}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {f.sources
                  .filter((sid, i, all) => all.findIndex((other) => SOURCES[other].publisher === SOURCES[sid].publisher) === i)
                  .map((sid) => (
                  <Pressable key={sid} onPress={() => openWeb(SOURCES[sid].url)} accessibilityRole="link" hitSlop={6}>
                    <Txt variant="small" color={theme.primary} style={{ fontWeight: '700' }}>
                      {`${SOURCES[sid].publisher} ↗`}
                    </Txt>
                  </Pressable>
                ))}
              </View>
            </View>
          );
        })}
      </Card>

      <Card>
        <SectionTitle title={t('about.privacy')} />
        <Txt variant="small">{t('about.privacyBody')}</Txt>
      </Card>
    </Screen>
  );
}
