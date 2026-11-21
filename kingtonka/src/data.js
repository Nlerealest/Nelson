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
const TABLES = { kt_projects: 200, kt_clips: 1000, kt_commands: 40, kt_activity: 80, kt_config: 10, kt_campaigns: 100 };
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

// A clip's light copy for watching in the app (made next to the clip since version 1.0.11).
export const previewOf = (path) => (path && path.endsWith('.mp4') ? `${path.slice(0, -4)}.preview.mp4` : null);

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
  cancelled: ['Cancelled', 'mute'], live: ['🔴 LIVE', 'bad'],
};
export const WORKING = ['queued', 'downloading', 'transcribing', 'finding', 'rendering', 'live'];

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

// ---------- campaigns ----------
// Content Rewards and most campaigns want the post link within 30 minutes of posting.
export const SUBMIT_WINDOW_MIN = 30;

// Settings for a new video made for a campaign: its rules, its clip length, and its
// creator kept on screen when the campaign needs that.
export function withCampaign(settings, campaign) {
  if (!campaign) return settings;
  const s = { ...settings, campaign: campaignSnapshot(campaign) };
  if (campaign.length && campaign.length !== 'auto') s.length = campaign.length;
  if (campaign.needs_face && !['auto', 'stream'].includes(s.framing)) s.framing = 'auto';
  return s;
}

// What a video keeps of its campaign (so Claude sees the rules even if the campaign changes later).
export function campaignSnapshot(c) {
  if (!c) return null;
  const { id, name, url, creator, rate, min_views, platforms, hashtags, mentions, rules, length, needs_face } = c;
  return { id, name, url, creator, rate, min_views, platforms, hashtags, mentions, rules, length, needs_face };
}

// The campaign a video belongs to: the live one if it still exists, else what the video kept.
export function campaignOf(project, campaigns) {
  const snap = project?.settings?.campaign;
  if (!snap) return null;
  return (campaigns || []).find((c) => c.id === snap.id) || snap;
}

const tagsIn = (text) => String(text || '').split(/[\s,]+/).map((t) => t.trim()).filter(Boolean);

// The full caption to paste when posting: Claude's caption, the campaign's @tags,
// then every hashtag once (the clip's and the campaign's required ones).
export function postCaption(clip, campaign) {
  const lines = [String(clip?.post_text || '').trim()];
  const mentions = tagsIn(campaign?.mentions).map((m) => (m.startsWith('@') ? m : `@${m}`));
  if (mentions.length) lines.push(mentions.join(' '));
  const seen = new Set();
  const tags = [...tagsIn(campaign?.hashtags), ...tagsIn(clip?.hashtags)]
    .map((h) => (h.startsWith('#') ? h : `#${h}`))
    .filter((h) => (seen.has(h.toLowerCase()) ? false : seen.add(h.toLowerCase())));
  if (tags.length) lines.push(tags.join(' '));
  return lines.filter(Boolean).join('\n\n');
}

// Minutes left to submit a posted campaign clip (negative once the window has passed), or null
// when there's nothing to submit (no post link saved yet, or already submitted).
export function submitMinutesLeft(clip, now = Date.now()) {
  if (!clip?.post_url || !clip?.posted_at || clip?.submitted_at) return null;
  return Math.floor(SUBMIT_WINDOW_MIN - (now - new Date(clip.posted_at).getTime()) / 60000);
}

// True when the database hasn't had the campaigns update yet (schema.sql not run again).
export const needsDbUpdate = (error) => !!error && /kt_campaigns|post_url|submitted_at|schema cache|does not exist/i.test(error.message || error);
