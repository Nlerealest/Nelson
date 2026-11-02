#!/usr/bin/env node
// Twizzy's hands: reads and writes the Twizzy app's Supabase database and media
// storage. Used by the agent in the "Twizzy agent" GitHub Action.
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.
//
//   node tw.mjs state                         everything waiting for Twizzy, as JSON
//   node tw.mjs list <table> [status]         tables: concepts posts refs inbox commands activity config
//   node tw.mjs get <table> <id>
//   node tw.mjs insert <table> '<json>'       prints the new row
//   node tw.mjs update <table> <id> '<json>'
//   node tw.mjs upload <local-file> <storage-path>     into the "media" bucket (overwrites; videos also get a .jpg still)
//   node tw.mjs attach <post-id> <video.mp4> [status]  upload a finished video, check it, point the post at it
//   node tw.mjs check                         posts whose video file is missing from storage
//   node tw.mjs download <storage-path> <local-file>
//   node tw.mjs log "<text>"                  one activity entry
//   node tw.mjs agent <state> "<message>"     what Twizzy is doing now (working / idle / error)
//   node tw.mjs command <id> <done|failed|working> "<result>"
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) { console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'); process.exit(1); }
// Keep only https://<project>.supabase.co, even if the secret holds the REST URL (…/rest/v1/).
const baseUrl = (() => { try { return new URL(SUPABASE_URL.trim()).origin; } catch { return SUPABASE_URL.trim(); } })();
const sb = createClient(baseUrl, SUPABASE_SERVICE_ROLE_KEY.trim(), { auth: { persistSession: false } });
const TABLES = ['concepts', 'posts', 'refs', 'inbox', 'commands', 'activity', 'config'];
const MIME = { '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };

const out = (x) => console.log(JSON.stringify(x, null, 1));
const must = ({ data, error }) => { if (error) { console.error(error.message); process.exit(1); } return data; };
const table = (t) => { if (!TABLES.includes(t)) { console.error('Unknown table ' + t); process.exit(1); } return t; };
const key = (t) => (t === 'commands' || t === 'activity' ? Number : String);

const [cmd, ...a] = process.argv.slice(2);
switch (cmd) {
  case 'state': {
    const q = (t, col, vals) => sb.from(t).select('*').in(col, vals).order('created_at');
    const [commands, concepts, posts, refs, inbox, config] = await Promise.all([
      q('commands', 'status', ['queued', 'working']), q('concepts', 'status', ['approved']),
      q('posts', 'status', ['making', 'changes_requested', 'approved']), q('refs', 'status', ['new']),
      q('inbox', 'status', ['approved']), sb.from('config').select('*'),
    ].map((p) => p.then(must)));
    const recent = must(await sb.from('concepts').select('id,title,status,created_at').order('created_at', { ascending: false }).limit(40));
    out({ now: new Date().toISOString(), commands, approved_concepts: concepts, posts_to_handle: posts, new_refs: refs,
      approved_replies: inbox, config: Object.fromEntries(config.map((c) => [c.id, c.data])), recent_concepts: recent });
    break;
  }
  case 'list': {
    let q = sb.from(table(a[0])).select('*');
    if (a[1]) q = q.eq('status', a[1]);
    out(must(await q.order(a[0] === 'activity' ? 'at' : a[0] === 'config' ? 'id' : 'created_at', { ascending: false }).limit(200)));
    break;
  }
  case 'get': out(must(await sb.from(table(a[0])).select('*').eq('id', key(a[0])(a[1])).maybeSingle())); break;
  case 'insert': out(must(await sb.from(table(a[0])).insert(JSON.parse(a[1])).select().single())); break;
  case 'update': {
    const patch = JSON.parse(a[2]);
    if (a[0] === 'commands') patch.updated_at = new Date().toISOString();
    if (a[0] === 'config') { // merge into data
      const cur = must(await sb.from('config').select('data').eq('id', a[1]).maybeSingle());
      out(must(await sb.from('config').upsert({ id: a[1], data: { ...(cur?.data || {}), ...patch }, updated_at: new Date().toISOString() }).select().single()));
    } else out(must(await sb.from(table(a[0])).update(patch).eq('id', key(a[0])(a[1])).select().single()));
    break;
  }
  case 'upload': {
    const [file, path] = a;
    must(await sb.storage.from('media').upload(path, readFileSync(file), { contentType: MIME[extname(file).toLowerCase()] || 'application/octet-stream', upsert: true }));
    console.log(path);
    // A still frame next to every video (same path, .jpg): the app shows it until you tap play.
    if (/^video\//.test(MIME[extname(file).toLowerCase()] || '')) {
      const jpg = join(tmpdir(), `poster-${process.pid}.jpg`);
      const r = spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', '4', '-i', file, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '4', jpg]);
      if (r.status === 0) {
        const posterPath = path.replace(/\.[a-z0-9]+$/i, '.jpg');
        must(await sb.storage.from('media').upload(posterPath, readFileSync(jpg), { contentType: 'image/jpeg', upsert: true }));
        console.log(posterPath);
      }
    }
    break;
  }
  case 'attach': {
    // Uploads a finished video (and its still frame), checks the file is really
    // there, and points the post at it, in one step so they can never mismatch.
    const [id, file, status = 'awaiting_approval'] = a;
    const ext = extname(file).toLowerCase() || '.mp4';
    const path = `posts/${id}-${new Date().toISOString().replace(/\D/g, '').slice(0, 12)}${ext}`;
    const kind = /^image\//.test(MIME[ext] || '') ? 'image' : 'video';
    must(await sb.storage.from('media').upload(path, readFileSync(file), { contentType: MIME[ext] || 'video/mp4', upsert: true }));
    if (kind === 'video') {
      const jpg = join(tmpdir(), `poster-${process.pid}.jpg`);
      if (spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', '4', '-i', file, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '4', jpg]).status === 0) {
        must(await sb.storage.from('media').upload(path.replace(/\.[a-z0-9]+$/i, '.jpg'), readFileSync(jpg), { contentType: 'image/jpeg', upsert: true }));
      }
    }
    const signed = must(await sb.storage.from('media').createSignedUrl(path, 120));
    const head = await fetch(signed.signedUrl, { method: 'HEAD' });
    if (!head.ok) { console.error(`Uploaded ${path} but it can't be read back (HTTP ${head.status}).`); process.exit(1); }
    out(must(await sb.from('posts').update({ media_path: path, media_kind: kind, status }).eq('id', id).select('id,title,status,media_path').single()));
    break;
  }
  case 'check': {
    // Every post that should have a video: is the file really in storage?
    const posts = must(await sb.from('posts').select('id,title,status,media_path,campaign').not('media_path', 'is', null));
    const bad = [];
    for (const p of posts) {
      const { data, error } = await sb.storage.from('media').createSignedUrl(p.media_path, 60);
      const ok = !error && (await fetch(data.signedUrl, { method: 'HEAD' })).ok;
      if (!ok) bad.push(p);
    }
    out({ checked: posts.length, missing: bad });
    break;
  }
  case 'download': {
    const blob = must(await sb.storage.from('media').download(a[0]));
    writeFileSync(a[1], Buffer.from(await blob.arrayBuffer()));
    console.log(a[1]);
    break;
  }
  case 'log': out(must(await sb.from('activity').insert({ text: a.join(' '), kind: 'twizzy' }).select().single())); break;
  case 'agent':
    must(await sb.from('config').upsert({ id: 'agent', data: { state: a[0], message: a.slice(1).join(' '), at: new Date().toISOString() }, updated_at: new Date().toISOString() }));
    console.log('agent', a[0]);
    break;
  case 'command':
    out(must(await sb.from('commands').update({ status: a[1], result: a.slice(2).join(' '), updated_at: new Date().toISOString() }).eq('id', Number(a[0])).select().single()));
    break;
  default:
    console.error(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//   ')).join('\n'));
    process.exit(1);
}
