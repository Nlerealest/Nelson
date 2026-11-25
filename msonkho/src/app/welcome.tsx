import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, Callout, Card, Chip, Field, FieldLabel, Txt } from '../components/ui.tsx';
import { BrandMark, TYPE_ICONS } from '../components/brand.tsx';
import { TAXPAYER_TYPES } from '../lib/calendar.ts';
import type { TaxpayerType } from '../lib/calendar.ts';
import { key } from '../i18n/index.ts';
import type { Lang } from '../i18n/index.ts';
import { useApp } from '../state/store.tsx';
import { BRAND, LIME, useTheme } from '../theme.ts';

export default function Welcome() {
  const { data, update, t, today } = useApp();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [types, setTypes] = useState<TaxpayerType[]>(data.settings.types);
  const [name, setName] = useState(data.settings.name);

  const toggle = (type: TaxpayerType) => setTypes((cur) => (cur.includes(type) ? cur.filter((x) => x !== type) : [...cur, type]));
  const setLang = (lang: Lang) => update((d) => ({ ...d, settings: { ...d.settings, lang } }));
  const finish = (useChoices: boolean) => {
    update((d) => ({
      ...d,
      onboarded: true,
      startedOn: d.startedOn || today,
      settings: useChoices ? { ...d.settings, types, name: name.trim() } : d.settings,
    }));
    router.replace('/');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: theme.bg }} contentContainerStyle={{ paddingBottom: 32 + insets.bottom }} keyboardShouldPersistTaps="handled">
      <View style={[styles.hero, { paddingTop: insets.top + 36 }]}>
        <View style={[styles.circle, { width: 240, height: 240, top: -60, right: -80 }]} />
        <View style={[styles.circle, { width: 140, height: 140, top: 140, left: -60 }]} />
        <BrandMark size={76} />
        <Text style={styles.wordmark}>
          Msonkho<Text style={{ color: LIME }}>Pocket</Text>
        </Text>
        <Text style={styles.tagline}>{t('app.tagline')}</Text>
      </View>

      <View style={{ padding: 16, gap: 14, marginTop: -28 }}>
        <Card>
          <Txt variant="title">{t('welcome.title')}</Txt>
          <Txt muted>{t('welcome.body')}</Txt>
          <FieldLabel>{t('welcome.language')}</FieldLabel>
          <View style={styles.wrap}>
            <Chip label={t('lang.en')} selected={data.settings.lang === 'en'} onPress={() => setLang('en')} icon="language" />
            <Chip label={t('lang.ny')} selected={data.settings.lang === 'ny'} onPress={() => setLang('ny')} icon="language" />
          </View>
        </Card>

        <Card>
          <Txt variant="heading">{t('welcome.who')}</Txt>
          <Txt variant="small" muted>
            {t('welcome.whoHint')}
          </Txt>
          <View style={{ gap: 8 }}>
            {TAXPAYER_TYPES.map((type) => {
              const selected = types.includes(type);
              return (
                <Chip
                  key={type}
                  label={`${t(key(`type.${type}`))} · ${t(key(`type.${type}.hint`))}`}
                  selected={selected}
                  icon={TYPE_ICONS[type]}
                  onPress={() => toggle(type)}
                />
              );
            })}
          </View>
          <Field label={t('welcome.name')} value={name} onChange={setName} autoCapitalize="words" maxLength={40} />
        </Card>

        <Callout tone="warn" icon="shield-checkmark">
          {`${t('app.disclaimer')} ${t('app.noPassword')}`}
        </Callout>

        <Button title={t('welcome.start')} icon="arrow-forward" onPress={() => finish(true)} />
        <Button title={t('welcome.skip')} kind="ghost" onPress={() => finish(false)} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: BRAND, alignItems: 'center', paddingBottom: 56, gap: 10, overflow: 'hidden' },
  circle: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.06)' },
  wordmark: { color: '#ffffff', fontSize: 34, fontWeight: '800', letterSpacing: -0.8, marginTop: 6 },
  tagline: { color: 'rgba(255,255,255,0.85)', fontSize: 16, fontWeight: '600' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
