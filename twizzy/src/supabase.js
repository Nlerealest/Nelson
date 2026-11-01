// The Supabase connection. The project URL and public (anon) key are built in
// from EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY, or typed in once
// on the sign-in screen and kept on the phone.
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

const KEY = 'twizzy.connection';
let client = null;

// Keep only https://<project>.supabase.co: people often paste the REST URL
// (…/rest/v1/) or add spaces, which breaks sign-in.
export function cleanUrl(url) {
  const raw = String(url || '').trim();
  try {
    return new URL(raw).origin;
  } catch {
    return raw.replace(/\/(rest|auth)\/v1.*$/i, '').replace(/\/+$/, '');
  }
}

export async function loadConnection() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const anon = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (url && anon) return { url: cleanUrl(url), anon: anon.trim(), builtIn: true };
  try {
    const saved = JSON.parse((await AsyncStorage.getItem(KEY)) || 'null');
    return saved?.url && saved?.anon ? { ...saved, url: cleanUrl(saved.url) } : null;
  } catch {
    return null;
  }
}

export async function saveConnection(url, anon) {
  const conn = { url: cleanUrl(url), anon: anon.trim() };
  await AsyncStorage.setItem(KEY, JSON.stringify(conn));
  return conn;
}

export async function forgetConnection() {
  await AsyncStorage.removeItem(KEY);
  client = null;
}

export function connect({ url, anon }) {
  if (client) return client;
  client = createClient(url, anon, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
  if (Platform.OS !== 'web') {
    // Keep the login fresh only while the app is open.
    AppState.addEventListener('change', (s) => (s === 'active' ? client.auth.startAutoRefresh() : client.auth.stopAutoRefresh()));
  }
  return client;
}

export const db = () => client;
