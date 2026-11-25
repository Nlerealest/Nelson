// Local deadline reminders. Scheduled on the phone itself, so they work offline
// and need no server. Rescheduled whenever the profile or "done" marks change.

import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { addDays, parseKey } from './lib/calendar.ts';
import type { Deadline } from './lib/calendar.ts';
import { key, mediumDate, periodLabel } from './i18n/index.ts';
import type { T } from './i18n/index.ts';

const CHANNEL = 'deadlines';
const REMIND_HOUR = 8;
// iOS keeps at most 64 pending notifications per app.
const MAX_SCHEDULED = 60;

// Expo Go on Android no longer ships every native part of expo-notifications,
// and importing the package there crashes. Load it only in the installed app;
// in Expo Go and on the web, reminders are simply unavailable.
export const remindersSupported = Platform.OS !== 'web' && !isRunningInExpoGo();

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Notifications: typeof import('expo-notifications') | null = remindersSupported ? require('expo-notifications') : null;

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getReminderPermission(): Promise<PermissionState> {
  if (!Notifications) return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status as PermissionState;
}

export async function requestReminderPermission(): Promise<PermissionState> {
  if (!Notifications) return 'unsupported';
  if (Platform.OS === 'android') {
    // Android only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Tax deadlines',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status as PermissionState;
}

function at(dateKey: string, hour: number): Date {
  const { year, month, day } = parseKey(dateKey);
  return new Date(year, month - 1, day, hour, 0, 0);
}

export type PlannedReminder = { date: Date; title: string; body: string };

/** A reminder three days before each deadline and one on the day. */
export function plannedReminders(deadlines: Deadline[], t: T, now = Date.now()): PlannedReminder[] {
  const list: PlannedReminder[] = [];
  for (const d of deadlines) {
    if (d.informational || d.daysLeft < 0) continue;
    const title = t(key(`dl.${d.id}`));
    const desc = t(key(`dl.${d.id}.desc`), { period: periodLabel(t, d.period) });
    const body = t('reminder.body', { desc, date: mediumDate(t, d.due) });
    list.push({ date: at(addDays(d.due, -3), REMIND_HOUR), title: t('reminder.before', { title }), body });
    list.push({ date: at(d.due, REMIND_HOUR), title: t('reminder.today', { title }), body });
  }
  return list.filter((r) => r.date.getTime() > now).slice(0, MAX_SCHEDULED);
}

let pending: ReturnType<typeof setTimeout> | undefined;

/** Replaces all scheduled reminders. Pass an empty list to turn them off. */
export function syncReminders(reminders: PlannedReminder[]): void {
  if (!Notifications) return;
  const N = Notifications;
  // Debounce: several quick changes only reschedule once.
  clearTimeout(pending);
  pending = setTimeout(async () => {
    try {
      await N.cancelAllScheduledNotificationsAsync();
      if (reminders.length === 0) return;
      if ((await N.getPermissionsAsync()).status !== 'granted') return;
      for (const r of reminders) {
        await N.scheduleNotificationAsync({
          content: { title: r.title, body: r.body, data: { url: '/calendar' } },
          trigger: { type: N.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL },
        });
      }
    } catch {
      // Reminders are a convenience; never let them break the app.
    }
  }, 800);
}

/** Opens the calendar when someone taps a reminder. */
export function onReminderTap(handler: (url: string) => void): () => void {
  if (!Notifications) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const url = response.notification.request.content.data?.url;
    if (typeof url === 'string') handler(url);
  });
  return () => sub.remove();
}
