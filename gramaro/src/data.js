// Live data from Supabase, shared by the whole app. Everything the signed-in
// person may see is loaded once, then one Realtime connection applies each
// change the moment it happens: a new fare, a payment check, a chat message.
// Supabase's row rules decide what each person receives, so customers only
// ever get their own trips while staff get every request.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { db } from './supabase';

const ToastContext = createContext(() => {});
export const ToastProvider = ToastContext.Provider;
export const useToast = () => useContext(ToastContext);

const TABLES = { requests: 500, quotes: 1000, payments: 1000, messages: 2000, events: 1000, deals: 100, settings: 20, profiles: 500 };
const ORDER = { settings: 'id' };
const DataContext = createContext(null);

export function DataProvider({ user, children }) {
  const toast = useToast();
  const [store, setStore] = useState({});
  const [errors, setErrors] = useState({});
  const [role, setRole] = useState(undefined); // 'staff' | 'customer'
  const [live, setLive] = useState(false);
  const roleRef = useRef(role);
  useEffect(() => { roleRef.current = role; }, [role]);

  const loadTable = useCallback(async (table) => {
    const { data, error } = await db().from(table).select('*').order(ORDER[table] || 'created_at', { ascending: false }).limit(TABLES[table]);
    if (error) setErrors((e) => ({ ...e, [table]: error.message }));
    else {
      setErrors((e) => (e[table] ? { ...e, [table]: null } : e));
      setStore((s) => ({ ...s, [table]: data }));
    }
  }, []);
  const loadAll = useCallback(() => Promise.all(Object.keys(TABLES).map(loadTable)), [loadTable]);

  // Staff or customer? Also make sure the customer has a profile row, using the
  // name and phone they gave when they created their account.
  useEffect(() => {
    (async () => {
      const { data: staff } = await db().rpc('is_staff');
      setRole(staff ? 'staff' : 'customer');
      if (!staff) {
        const { data: mine } = await db().from('profiles').select('id').eq('id', user.id).maybeSingle();
        if (!mine) {
          const meta = user.user_metadata || {};
          await db().from('profiles').insert({ id: user.id, full_name: meta.full_name || null, phone: meta.phone || null });
          loadTable('profiles');
        }
      }
    })();
  }, [user, loadTable]);

  useEffect(() => {
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
      // A short banner for the things people wait for.
      if (eventType !== 'INSERT') return;
      if (roleRef.current === 'customer' && table === 'events') toast(row.text);
      if (roleRef.current === 'customer' && table === 'messages' && row.from_staff) toast('New message from Gramaro');
      if (roleRef.current === 'staff' && table === 'requests') toast(`New request: ${row.destination || row.kind}`);
      if (roleRef.current === 'staff' && table === 'payments') toast(`Payment to check: MK ${Number(row.amount_mwk).toLocaleString('en-US')}`);
      if (roleRef.current === 'staff' && table === 'messages' && !row.from_staff) toast('New customer message');
    };
    Promise.resolve().then(loadAll);
    const ch = db()
      .channel('gramaro-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, apply)
      .subscribe((status) => {
        setLive(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') loadAll(); // catch anything that changed while connecting
      });
    // Catch up after the phone was asleep or the app was in the background.
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') loadAll(); });
    return () => { sub.remove(); db().removeChannel(ch); };
  }, [loadAll, toast]);

  const value = useMemo(() => ({ store, errors, loadAll, role, live, user }), [store, errors, loadAll, role, live, user]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export const useApp = () => useContext(DataContext);

const matches = (row, filter) => !filter || Object.entries(filter).every(([col, val]) => (Array.isArray(val) ? val.includes(row[col]) : row[col] === val));

// Rows of a table, newest first, kept live.
export function useRows(table, { filter, limit = 1000 } = {}) {
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

export function useSettings() {
  const { rows } = useRows('settings');
  return useMemo(() => Object.fromEntries((rows || []).map((r) => [r.id, r.data])), [rows]);
}

export function useMyProfile() {
  const { user } = useApp();
  const { rows } = useRows('profiles', { filter: { id: user.id } });
  return rows?.[0] || null;
}

// Re-render every `ms` so countdowns stay current.
export function useNow(ms = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

// Run a Supabase call and show its error (if any) as a banner. Returns true on success.
export async function run(toast, promise, okText) {
  const { error } = await promise;
  if (error) {
    toast(error.message.replace(/^.*?ERROR:\s*/, ''));
    return false;
  }
  if (okText) toast(okText);
  return true;
}
