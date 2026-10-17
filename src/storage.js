// Persists app data on the phone with AsyncStorage. Nothing leaves the device.

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ndalama:v1';

export function emptyData() {
  return { transactions: [], budgets: {}, goals: [], bills: [], loans: [], settings: { name: '' } };
}

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function load() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...emptyData(), ...JSON.parse(raw) } : emptyData();
  } catch {
    return emptyData();
  }
}

export async function save(data) {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function parseBackup(text) {
  const parsed = JSON.parse(text);
  if (!parsed || !Array.isArray(parsed.transactions)) throw new Error('Not an Ndalama backup file');
  return { ...emptyData(), ...parsed };
}
