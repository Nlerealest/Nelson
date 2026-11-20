// A phone reminder 20 minutes after you post a campaign clip, so you submit it
// before the campaign's 30-minute window closes. Scheduled on the phone itself.
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import { router } from 'expo-router';

// Expo Go and the web don't have every native part of expo-notifications.
const supported = Platform.OS !== 'web' && !isRunningInExpoGo();
const Notifications = supported ? require('expo-notifications') : null;
const CHANNEL = 'submit';
const REMIND_AFTER_MIN = 20;

if (Notifications) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
  });
}

async function allowed() {
  if (Platform.OS === 'android') {
    // Android only shows the permission prompt once a channel exists.
    await Notifications.setNotificationChannelAsync(CHANNEL, { name: 'Submit reminders', importance: Notifications.AndroidImportance.HIGH });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
  return status === 'granted';
}

// Returns true if a reminder was set.
export async function remindToSubmit(clip, campaignName) {
  if (!Notifications) return false;
  try {
    const at = new Date(clip.posted_at || Date.now()).getTime() + REMIND_AFTER_MIN * 60000;
    if (at < Date.now() + 30000 || !(await allowed())) return false;
    await Notifications.scheduleNotificationAsync({
      identifier: `submit-${clip.id}`,
      content: {
        title: 'Submit your clip now ⏰',
        body: `About 10 minutes left to submit “${clip.title}”${campaignName ? ` to ${campaignName}` : ''}. Tap to open it.`,
        data: { clipId: clip.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: new Date(at), channelId: CHANNEL },
    });
    return true;
  } catch {
    return false; // reminders are a convenience; never let them break the app
  }
}

export async function cancelSubmitReminder(clipId) {
  try {
    if (Notifications) await Notifications.cancelScheduledNotificationAsync(`submit-${clipId}`);
  } catch {
    // nothing to cancel
  }
}

// Tapping a reminder opens its clip (whether the app was open or not).
export function useReminderTaps() {
  useEffect(() => {
    if (!Notifications) return undefined;
    const open = (response) => {
      const id = response?.notification?.request?.content?.data?.clipId;
      if (!id) return;
      router.push(`/clip/${id}`);
      try {
        Notifications.clearLastNotificationResponse(); // so the same tap doesn't open it again later
      } catch {
        // older devices: nothing to clear
      }
    };
    try {
      open(Notifications.getLastNotificationResponse());
    } catch {
      // no earlier tap
    }
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
