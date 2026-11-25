import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { Badge, Button, Callout, Card, Divider, Screen, SectionTitle, SwitchRow, Txt } from '../../components/ui.tsx';
import { DeadlineRow } from '../../components/brand.tsx';
import type { Deadline } from '../../lib/calendar.ts';
import { parseKey } from '../../lib/calendar.ts';
import { key } from '../../i18n/index.ts';
import { getReminderPermission, remindersSupported, requestReminderPermission } from '../../reminders.ts';
import type { PermissionState } from '../../reminders.ts';
import { useApp } from '../../state/store.tsx';

export default function Calendar() {
  const { t, data, update, deadlines, toast } = useApp();
  const [permission, setPermission] = useState<PermissionState>('undetermined');
  const { types, reminders } = data.settings;

  useEffect(() => {
    getReminderPermission().then(setPermission).catch(() => {});
  }, []);

  // Overdue items stay until marked done; done items stay visible (crossed out) until their date passes.
  const visible = deadlines.filter((d) => d.daysLeft >= 0 || (!d.informational && !data.done[d.key]));
  const overdue = visible.filter((d) => d.daysLeft < 0);
  const upcoming = visible.filter((d) => d.daysLeft >= 0);
  const months = new Map<string, Deadline[]>();
  for (const d of upcoming) {
    const m = d.due.slice(0, 7);
    months.set(m, [...(months.get(m) ?? []), d]);
  }

  const toggleDone = (d: Deadline) => {
    const wasDone = !!data.done[d.key];
    update((s) => {
      const done = { ...s.done };
      if (wasDone) delete done[d.key];
      else done[d.key] = true;
      return { ...s, done };
    });
    if (!wasDone) toast(t('cal.doneToast'));
  };

  const setReminders = async (on: boolean) => {
    if (!on) {
      update((s) => ({ ...s, settings: { ...s.settings, reminders: false } }));
      return;
    }
    if (!remindersSupported) {
      toast(t('cal.remindersWeb'));
      return;
    }
    const status = await requestReminderPermission();
    setPermission(status);
    if (status !== 'granted') {
      toast(t('cal.remindersDenied'));
      return;
    }
    update((s) => ({ ...s, settings: { ...s.settings, reminders: true } }));
  };

  return (
    <Screen>
      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Txt variant="label" muted style={{ flex: 1 }}>
            {t('cal.for')}
          </Txt>
          <Button small kind="ghost" icon="create" title={t('common.edit')} onPress={() => router.push('/settings')} />
        </View>
        {types.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {types.map((type) => (
              <Badge key={type} label={t(key(`type.${type}`))} tone="primary" />
            ))}
          </View>
        ) : (
          <Txt muted>{t('cal.noProfile')}</Txt>
        )}
        <Divider />
        <SwitchRow
          title={t('cal.reminders')}
          subtitle={!remindersSupported ? t('cal.remindersWeb') : permission === 'denied' ? t('cal.remindersDenied') : t('cal.remindersBody')}
          value={reminders && permission === 'granted'}
          onChange={setReminders}
          disabled={!remindersSupported}
        />
      </Card>

      {overdue.length ? (
        <Card style={{ gap: 4 }}>
          <SectionTitle title={t('cal.overdue')} />
          {overdue.map((d) => (
            <DeadlineRow key={d.key} d={d} t={t} done={!!data.done[d.key]} onToggleDone={() => toggleDone(d)} onPress={() => router.push('/pay')} />
          ))}
        </Card>
      ) : null}

      {[...months.entries()].map(([month, list]) => {
        const { year, month: m } = parseKey(`${month}-01`);
        return (
          <Card key={month} style={{ gap: 4 }}>
            <SectionTitle title={`${t(key(`month.${m}`))} ${year}`} />
            {list.map((d, i) => (
              <View key={d.key}>
                {i > 0 ? <Divider /> : null}
                <DeadlineRow
                  d={d}
                  t={t}
                  done={!!data.done[d.key]}
                  onToggleDone={() => toggleDone(d)}
                  onPress={d.informational ? () => router.push('/learn/paye') : () => router.push('/pay')}
                />
              </View>
            ))}
          </Card>
        );
      })}

      {types.length > 0 && upcoming.length === 0 ? (
        <Card>
          <Txt muted>{t('cal.nothing')}</Txt>
        </Card>
      ) : null}

      <Callout tone="neutral" icon="information-circle">
        {t('cal.note')}
      </Callout>
    </Screen>
  );
}
