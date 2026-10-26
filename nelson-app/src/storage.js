// The connection (address + secret key) is kept in the phone's secure storage
// (Android Keystore / iOS Keychain). On web, where that doesn't exist, it falls
// back to localStorage.
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'nelson_connection_v1';

export async function loadConnection() {
  try {
    const raw = Platform.OS === 'web' ? globalThis.localStorage?.getItem(KEY) : await SecureStore.getItemAsync(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function saveConnection(conn) {
  const raw = JSON.stringify(conn);
  if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, raw);
  else await SecureStore.setItemAsync(KEY, raw);
}

export async function clearConnection() {
  if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
  else await SecureStore.deleteItemAsync(KEY);
}
