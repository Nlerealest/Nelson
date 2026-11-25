// App state: the profile, settings, "done" marks, recent checks and the sales
// record. Saved on the phone with AsyncStorage; nothing leaves the device.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { dateKey, deadlinesFor, openDeadlines } from '../lib/calendar.ts';
import type { Deadline, TaxpayerType } from '../lib/calendar.ts';
import type { Sale } from '../lib/sales.ts';
import type { Verdict } from '../lib/verify.ts';
import { makeT } from '../i18n/index.ts';
import type { Lang, T } from '../i18n/index.ts';
import { plannedReminders, syncReminders } from '../reminders.ts';

const STORAGE_KEY = 'msonkho:v2';

export type Settings = {
  lang: Lang;
  name: string;
  types: TaxpayerType[];
  /** The month the financial year ends (1–12). */
  yearEndMonth: number;
  reminders: boolean;
};

export type ScanRecord = { at: number; input: string; verdict: Verdict; host?: string };

export type AppData = {
  onboarded: boolean;
  /** The day the app was set up: deadlines before it never count as overdue. */
  startedOn: string;
  settings: Settings;
  done: Record<string, boolean>;
  scans: ScanRecord[];
  sales: Sale[];
  prn: string;
};

export function defaultData(): AppData {
  return {
    onboarded: false,
    startedOn: '',
    settings: { lang: 'en', name: '', types: ['employer', 'vat'], yearEndMonth: 6, reminders: false },
    done: {},
    scans: [],
    sales: [],
    prn: '',
  };
}

function merge(saved: Partial<AppData> | null): AppData {
  const base = defaultData();
  if (!saved || typeof saved !== 'object') return base;
  return { ...base, ...saved, settings: { ...base.settings, ...(saved.settings ?? {}) } };
}

type Ctx = {
  data: AppData;
  loaded: boolean;
  update: (fn: (d: AppData) => AppData) => void;
  reset: () => void;
  t: T;
  lang: Lang;
  today: string;
  /** Deadlines for the profile, 31 days back to 120 days ahead. */
  deadlines: Deadline[];
  /** Not done, and either upcoming or overdue. */
  open: Deadline[];
  toast: (message: string) => void;
};

const AppContext = createContext<Ctx | null>(null);

export function useApp(): Ctx {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

function useToday(): string {
  const [today, setToday] = useState(() => dateKey(new Date()));
  useEffect(() => {
    const refresh = () => setToday(dateKey(new Date()));
    const sub = AppState.addEventListener('change', (s) => s === 'active' && refresh());
    const timer = setInterval(refresh, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, []);
  return today;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(defaultData);
  const [loaded, setLoaded] = useState(false);
  const [toastText, setToastText] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const today = useToday();

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => setData(merge(raw ? JSON.parse(raw) : null)))
      .catch(() => setData(defaultData()))
      .finally(() => setLoaded(true));
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const timer = setTimeout(() => {
      AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data)).catch(() => {});
    }, 250);
    return () => clearTimeout(timer);
  }, [data, loaded]);

  const lang = data.settings.lang;
  const t = useMemo(() => makeT(lang), [lang]);
  const { types, yearEndMonth, reminders } = data.settings;
  // Someone who installs the app today hasn't "missed" last month's deadlines.
  const since = data.startedOn || today;
  const deadlines = useMemo(
    () => deadlinesFor(types, today, { yearEndMonth }).filter((d) => d.daysLeft >= 0 || d.due >= since),
    [types, today, yearEndMonth, since],
  );
  const open = useMemo(() => openDeadlines(deadlines, data.done), [deadlines, data.done]);

  useEffect(() => {
    if (!loaded) return;
    syncReminders(reminders ? plannedReminders(open, t) : []);
  }, [loaded, reminders, open, t]);

  const update = useCallback((fn: (d: AppData) => AppData) => setData((d) => fn(d)), []);
  const reset = useCallback(() => setData({ ...defaultData(), onboarded: false }), []);
  const toast = useCallback((message: string) => {
    setToastText(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastText(''), 2600);
  }, []);

  const value = useMemo<Ctx>(
    () => ({ data, loaded, update, reset, t, lang, today, deadlines, open, toast }),
    [data, loaded, update, reset, t, lang, today, deadlines, open, toast],
  );

  return (
    <AppContext.Provider value={value}>
      {children}
      {toastText ? (
        <View pointerEvents="none" style={styles.toastWrap} accessibilityLiveRegion="polite">
          <Text style={styles.toast}>{toastText}</Text>
        </View>
      ) : null}
    </AppContext.Provider>
  );
}

const styles = StyleSheet.create({
  toastWrap: { position: 'absolute', left: 16, right: 16, bottom: 96, alignItems: 'center' },
  toast: {
    backgroundColor: '#13201a',
    color: '#ffffff',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    overflow: 'hidden',
    fontSize: 14,
    fontWeight: '600',
  },
});
