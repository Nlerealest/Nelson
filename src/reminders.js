// Local bill reminders. Scheduled on the phone itself, so they work offline
// and need no server. Rescheduled every time the data changes.

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { billSchedule, formatKwacha as K, loanStatus, shortDate } from './logic';

const CHANNEL = 'bills';
const REMIND_HOUR = 8;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function getReminderPermission() {
  if (Platform.OS === 'web') return 'unsupported';
  const { status } = await Notifications.getPermissionsAsync();
  return status;
}

export async function requestReminderPermission() {
  if (Platform.OS === 'web') return 'unsupported';
  if (Platform.OS === 'android') {
    // Android only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Bill reminders',
      // eslint-disable-next-line import/namespace -- re-exported enum the rule cannot resolve
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status;
}

function at(dateKey, hour) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d, hour, 0, 0);
}

function shiftDays(dateKey, days) {
  const [y, m, d] = dateKey.split('-').map(Number);
  const date = new Date(y, m - 1, d + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// What to schedule: a reminder the day before and on the due date for each
// bill, and one on the repayment date for each loan.
export function plannedReminders(data, today) {
  const list = [];
  for (const { bill, dueDate, status } of billSchedule(data.bills, today)) {
    if (status === 'overdue') continue;
    list.push({ date: at(shiftDays(dueDate, -1), REMIND_HOUR), title: `${bill.name} is due tomorrow`, body: `${K(bill.amount)} due on ${shortDate(dueDate, today)}.` });
    list.push({ date: at(dueDate, REMIND_HOUR), title: `${bill.name} is due today`, body: `Remember to pay ${K(bill.amount)}. Mark it paid in Ndalama.` });
  }
  for (const loan of data.loans) {
    const s = loanStatus(loan, today);
    if (s.settled || !loan.dueDate) continue;
    list.push({
      date: at(loan.dueDate, REMIND_HOUR),
      title: loan.direction === 'lent' ? `${loan.person} should repay you today` : `Repayment to ${loan.person} is due today`,
      body: `${K(s.outstanding)} outstanding.`,
    });
  }
  const now = Date.now();
  return list.filter((r) => r.date.getTime() > now);
}

let pending = null;

export function scheduleReminders(data, today) {
  if (Platform.OS === 'web') return;
  // Debounce: several quick edits only reschedule once.
  clearTimeout(pending);
  pending = setTimeout(async () => {
    try {
      if ((await Notifications.getPermissionsAsync()).status !== 'granted') return;
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const r of plannedReminders(data, today)) {
        await Notifications.scheduleNotificationAsync({
          content: { title: r.title, body: r.body },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.date, channelId: CHANNEL },
        });
      }
    } catch {
      // Reminders are a convenience; never let them break the app.
    }
  }, 800);
}
