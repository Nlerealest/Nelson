// Live data from Supabase, shared by the whole app: everything is loaded once,
// then one Realtime connection applies each change as it happens, so progress
// and new clips appear by themselves while King Tonka works.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import { db } from './supabase';

const ToastContext = createContext(() => {});
export const ToastProvider = ToastContext.Provider;
export const useToast = () => useContext(ToastContext);

export const BUCKET = 'kingtonka';
const TABLES = { kt_projects: 200, kt_clips: 1000, kt_commands: 40, kt_activity: 80, kt_config: 10 };
const ORDER = { kt_activity: 'at', kt_config: 'id' };
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
    Promise.resolve().then(loadAll);
    const ch = db()
      .channel('kingtonka-live')
      .on('postgres_changes', { event: '*', schema: 'public' }, apply)
      .subscribe((status) => { if (status === 'SUBSCRIBED') loadAll(); });
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') loadAll(); });
    return () => { sub.remove(); db().removeChannel(ch); };
  }, [loadAll]);

  const value = useMemo(() => ({ store, errors, loadAll }), [store, errors, loadAll]);
  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

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

export function useRow(table, id) {
  const { rows, error, reload } = useRows(table);
  return { row: rows ? rows.find((r) => r.id === id) || null : undefined, error, reload };
}

export function useConfig() {
  const { rows, reload } = useRows('kt_config');
  const config = useMemo(() => Object.fromEntries((rows || []).map((r) => [r.id, r.data])), [rows]);
  return { config, loaded: !!rows, reload };
}

export async function saveConfig(id, patch) {
  const { data } = await db().from('kt_config').select('data').eq('id', id).maybeSingle();
  const { error } = await db().from('kt_config').upsert({ id, data: { ...(data?.data || {}), ...patch }, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Asks King Tonka to do something. The new row starts the agent on GitHub.
export async function ask(kind, text, { projectId = null, clipId = null } = {}) {
  const { error } = await db().from('kt_commands').insert({ kind, text, project_id: projectId, clip_id: clipId });
  if (error) throw error;
}

export async function update(table, id, patch) {
  const { error } = await db().from(table).update({ ...patch, ...(table === 'kt_activity' || table === 'kt_config' ? {} : { updated_at: new Date().toISOString() }) }).eq('id', id);
  if (error) throw error;
}

export async function insert(table, row) {
  const { data, error } = await db().from(table).insert(row).select().single();
  if (error) throw error;
  return data;
}

export async function remove(table, id) {
  const { error } = await db().from(table).delete().eq('id', id);
  if (error) throw error;
}

export async function removeFiles(paths) {
  const list = paths.filter(Boolean);
  if (list.length) await db().storage.from(BUCKET).remove(list);
}

export async function logYou(text) {
  await db().from('kt_activity').insert({ text, kind: 'you' });
}

// Starts a new project from a link or an uploaded file.
export async function newProject({ url, path, title, settings }) {
  const p = await insert('kt_projects', {
    source_url: url || null, source_path: path || null, title: title || null, settings,
    status: 'queued', step: 'Waiting for King Tonka to start…', percent: 0,
  });
  await ask('process', `Find the best clips in ${title || url}`, { projectId: p.id });
  return p;
}

export function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// 754.2 → "12:34"
export function clock(sec) {
  if (sec == null || Number.isNaN(Number(sec))) return '–';
  const s = Math.max(0, Math.round(Number(sec)));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${r}` : `${m}:${r}`;
}

// "12:34" or "1:02:03" or "95" → seconds (null if empty or invalid).
export function parseClock(text) {
  const v = String(text || '').trim();
  if (!v) return null;
  if (!/^\d+(:\d{1,2}){0,2}$/.test(v)) return NaN;
  return v.split(':').reduce((acc, n) => acc * 60 + Number(n), 0);
}

export const STATUS = {
  queued: ['Waiting', 'info'], downloading: ['Downloading', 'warn'], transcribing: ['Transcribing', 'warn'],
  finding: ['Finding clips', 'warn'], rendering: ['Rendering', 'warn'], done: ['Ready', 'ok'], failed: ['Problem', 'bad'],
  cancelled: ['Cancelled', 'mute'],
};
export const WORKING = ['queued', 'downloading', 'transcribing', 'finding', 'rendering'];

// Closes everything still waiting for one video (after you cancel it).
export async function closeCommands(projectId, result) {
  const { error } = await db().from('kt_commands').update({ status: 'done', result, updated_at: new Date().toISOString() })
    .eq('project_id', projectId).in('status', ['queued', 'working']);
  if (error) throw error;
}
export const CLIP_STATUS = {
  planned: ['Queued', 'info'], rendering: ['Rendering', 'warn'], rerender: ['Updating', 'warn'], editing: ['Claude is editing', 'warn'],
  ready: ['Ready', 'ok'], failed: ['Failed', 'bad'],
};
