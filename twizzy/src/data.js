// Live data from Supabase: every list updates by itself when Twizzy (or you)
// changes something.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { db } from './supabase';

const ToastContext = createContext(() => {});
export const ToastProvider = ToastContext.Provider;
export const useToast = () => useContext(ToastContext);

const ORDER = { activity: 'at', config: 'id' };

// rows of a table, newest first, kept live with Realtime.
export function useRows(table, { filter, limit = 200 } = {}) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const key = JSON.stringify(filter || null);
  const load = useCallback(async () => {
    let q = db().from(table).select('*');
    if (filter) for (const [col, val] of Object.entries(filter)) q = Array.isArray(val) ? q.in(col, val) : q.eq(col, val);
    const { data, error: e } = await q.order(ORDER[table] || 'created_at', { ascending: false }).limit(limit);
    if (e) setError(e.message);
    else { setError(null); setRows(data); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [table, key, limit]);

  const timer = useRef(null);
  useEffect(() => {
    Promise.resolve().then(load);
    const ch = db()
      .channel(`live-${table}-${key}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {
        clearTimeout(timer.current);
        timer.current = setTimeout(load, 250);
      })
      .subscribe();
    return () => { clearTimeout(timer.current); db().removeChannel(ch); };
  }, [load, table, key]);

  return { rows, error, reload: load };
}

export function useConfig() {
  const { rows, reload } = useRows('config');
  const map = Object.fromEntries((rows || []).map((r) => [r.id, r.data]));
  return { config: map, loaded: !!rows, reload };
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
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}
