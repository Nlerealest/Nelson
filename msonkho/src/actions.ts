// Things that leave the app: opening websites, calling, copying and sharing.
// Each returns false instead of throwing, so a missing app never crashes ours.

import { Linking, Platform, Share } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';

/** Opens a website in an in-app browser tab. */
export async function openWeb(url: string): Promise<boolean> {
  try {
    await WebBrowser.openBrowserAsync(url);
    return true;
  } catch {
    return openExternal(url);
  }
}

/** tel:, mailto:, maps and other links handled by other apps. */
export async function openExternal(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}

/** Opens the phone dialler with a number or USSD code such as *211#. */
export function dial(code: string): Promise<boolean> {
  return openExternal(`tel:${encodeURIComponent(code)}`);
}

export async function copy(text: string): Promise<boolean> {
  try {
    await Clipboard.setStringAsync(text);
    return true;
  } catch {
    return false;
  }
}

/** Shares text; where sharing isn't available (some browsers), copies it instead. */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'failed'> {
  try {
    await Share.share({ message });
    return 'shared';
  } catch {
    return (await copy(message)) ? 'copied' : 'failed';
  }
}

export function buzz(kind: 'success' | 'warning' | 'error'): void {
  if (Platform.OS === 'web') return;
  const type = {
    success: Haptics.NotificationFeedbackType.Success,
    warning: Haptics.NotificationFeedbackType.Warning,
    error: Haptics.NotificationFeedbackType.Error,
  }[kind];
  Haptics.notificationAsync(type).catch(() => {});
}

export function mapsSearch(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
