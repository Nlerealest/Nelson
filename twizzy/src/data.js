// Live data from Supabase, shared by the whole app: everything is loaded once,
// then one Realtime connection applies each change as it happens (no reloads),
// so the app stays smooth while Twizzy is busy.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { db } from './supabase';

const ToastContext = createContext(() => {});
export const ToastProvider = ToastContext.Provider;
export const useToast = () => useContext(ToastContext);

const TABLES = { concepts: 300, posts: 300, refs: 200, inbox: 200, commands: 40, activity: 100, config: 20 };
const ORDER = { activity: 'at', config: 'id' };
const DataContext = createContext(null);

export function DataProvider({ children }) {
  const [store, setStore] = useState({});
  const [errors, setErrors] = useState({});

  const loadTable = useCallback(async (table) => {
    const { data, error } = await db().from(table).select('*').order(ORDER[table] || 'created_at', { ascending: false }).limit(TABLES[table]);
    if (error) setErrors((e) => ({ ...e, [table]: error.message }));
    else {
      setErrors((e) => (e[table] ? { ...e, [table]: null } : e));
      setStore((s) => ({ ...s, [table]: data }));
    }
  }, []);
  const loadAll = useCallback(() => Promise.all(Object.keys(TABLES).map(loadTable)), [loadTable]);

  useEffect(() => {
    // Apply one change from Realtime to the table it belongs to.
    const apply = ({ table, eventType, new: row, old }) => {
      if (!TABLES[table]) return;
      setStore((s) => {
        const rows = s[table];
        if (!rows) return s;
        let next;
        if (eventType === 'DELETE') next = rows.filter((r) => r.id !== old?.id);
        else {
          const i = rows.findIndex((r) => r.id === row.id);
          next = i >= 0 ? rows.map((r, k) => (k === i ? row : r)) : [row, ...rows].slice(0, TABLES[table]);
        }
        return { ...s, [table]: next };
      });
    };
    // Load straight away, and again once live updates are connected (to catch
    // anything that changed in between). Lists work even if live updates fail.
    Promise.resolve().then(loadAll);
    const ch = db()
      .channel('twizzy-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, apply)
      .subscribe((status) => { if (status === 'SUBSCRIBED') loadAll(); });
    // Catch up after the phone was asleep or the app was in the background.
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') loadAll(); });
    return () => { sub.remove(); db().removeChannel(ch); };
  }, [loadAll]);

  const value = useMemo(() => ({ store, errors, loadAll }), [store, errors, loadAll]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

const matches = (row, filter) => !filter || Object.entries(filter).every(([col, val]) => (Array.isArray(val) ? val.includes(row[col]) : row[col] === val));

// Rows of a table, newest first, kept live.
export function useRows(table, { filter, limit = 200 } = {}) {
  const { store, errors, loadAll } = useContext(DataContext);
  const all = store[table];
  const key = JSON.stringify(filter || null);
  const rows = useMemo(() => {
    if (!all) return null;
    const f = JSON.parse(key);
    return all.filter((r) => matches(r, f)).slice(0, limit);
  }, [all, key, limit]);
  return { rows, error: errors[table] || null, reload: loadAll };
}

export function useConfig() {
  const { rows, reload } = useRows('config');
  const config = useMemo(() => Object.fromEntries((rows || []).map((r) => [r.id, r.data])), [rows]);
  return { config, loaded: !!rows, reload };
}

export async function saveConfig(id, patch) {
  const { data } = await db().from('config').select('data').eq('id', id).maybeSingle();
  const { error } = await db().from('config').upsert({ id, data: { ...(data?.data || {}), ...patch }, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Asks Twizzy to do something. The new row starts the agent on GitHub.
export async function tellTwizzy(text, kind = 'message', refId = null) {
  const { error } = await db().from('commands').insert({ text, kind, ref_id: refId });
  if (error) throw error;
}

export async function update(table, id, patch) {
  const { error } = await db().from(table).update(patch).eq('id', id);
  if (error) throw error;
}

export async function insert(table, row) {
  const { data, error } = await db().from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function logYou(text) {
  await db().from('activity').insert({ text, kind: 'you' });
}

export const nowIso = () => new Date().toISOString();

export function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
