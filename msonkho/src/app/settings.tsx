import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { Button, Card, Chip, Field, ListRow, Screen, SectionTitle, SwitchRow } from '../components/ui.tsx';
import { TYPE_ICONS } from '../components/brand.tsx';
import { TAXPAYER_TYPES } from '../lib/calendar.ts';
import type { TaxpayerType } from '../lib/calendar.ts';
import { key } from '../i18n/index.ts';
import type { Lang } from '../i18n/index.ts';
import { getReminderPermission, remindersSupported, requestReminderPermission } from '../reminders.ts';
import { useApp } from '../state/store.tsx';
import type { Settings as SettingsData } from '../state/store.tsx';

const YEAR_ENDS = [3, 6, 9, 12];

export default function Settings() {
  const { t, data, update, reset, toast } = useApp();
  const { settings } = data;
  const [name, setName] = useState(settings.name);
  const [permission, setPermission] = useState('undetermined');

  useEffect(() => {
    getReminderPermission().then(setPermission).catch(() => {});
  }, []);

  const set = (patch: Partial<SettingsData>) => update((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const toggleType = (type: TaxpayerType) =>
    set({ types: settings.types.includes(type) ? settings.types.filter((x) => x !== type) : [...settings.types, type] });

  const setReminders = async (on: boolean) => {
    if (!on) return set({ reminders: false });
    const status = await requestReminderPermission();
    setPermission(status);
    if (status === 'granted') set({ reminders: true });
    else toast(t('cal.remindersDenied'));
  };

  const doReset = () => {
    const go = () => {
      reset();
      toast(t('set.resetDone'));
      router.replace('/welcome');
    };
    if (Platform.OS === 'web') {
      if (globalThis.confirm?.(t('set.resetConfirm'))) go();
      return;
    }
    Alert.alert(t('set.reset'), t('set.resetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('set.reset'), style: 'destructive', onPress: go },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: t('set.title') }} />
      <Card>
        <SectionTitle title={t('set.language')} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['en', 'ny'] as Lang[]).map((lang) => (
            <Chip key={lang} label={t(key(`lang.${lang}`))} icon="language" selected={settings.lang === lang} onPress={() => set({ lang })} />
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle title={t('set.profile')} />
        <Field label={t('set.name')} value={name} onChange={setName} autoCapitalize="words" maxLength={40} />
        {name !== settings.name ? <Button small kind="secondary" icon="checkmark" title={t('common.save')} onPress={() => set({ name: name.trim() })} /> : null}
        <SectionTitle title={t('set.types')} />
        <View style={{ gap: 8 }}>
          {TAXPAYER_TYPES.map((type) => (
            <Chip key={type} label={t(key(`type.${type}`))} icon={TYPE_ICONS[type]} selected={settings.types.includes(type)} onPress={() => toggleType(type)} />
          ))}
        </View>
        {settings.types.includes('company') ? (
          <>
            <SectionTitle title={t('set.yearEnd')} />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {YEAR_ENDS.map((m) => (
                <Chip key={m} label={t(key(`month.${m}`))} selected={settings.yearEndMonth === m} onPress={() => set({ yearEndMonth: m })} />
              ))}
            </View>
          </>
        ) : null}
      </Card>

      <Card>
        <SwitchRow
          title={t('set.reminders')}
          subtitle={!remindersSupported ? t('cal.remindersWeb') : permission === 'denied' ? t('cal.remindersDenied') : t('cal.remindersBody')}
          value={settings.reminders && permission === 'granted'}
          onChange={setReminders}
          disabled={!remindersSupported}
        />
      </Card>

      <Card style={{ gap: 4 }}>
        <ListRow icon="information-circle" tone="neutral" title={t('more.about')} subtitle={t('more.about.desc')} onPress={() => router.push('/about')} />
      </Card>

      <Card>
        <SectionTitle title={t('set.data')} />
        <Button kind="danger" icon="refresh" title={t('set.reset')} onPress={doReset} />
      </Card>
    </Screen>
  );
}
