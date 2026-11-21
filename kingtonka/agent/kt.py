#!/usr/bin/env python3
"""King Tonka's hands: reads and writes the app's Supabase tables and storage.
Used by the scripts and by Claude in the "King Tonka agent" GitHub Action.
Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.

  python kt.py state                          everything waiting, as JSON
  python kt.py get <table> <id>               tables: projects clips commands activity config campaigns
  python kt.py list <table> [status]
  python kt.py update <table> <id> '<json>'
  python kt.py clips <project-id>             the project's clips (no words), best first
  python kt.py add-clips <project-id> <plan.json>   insert Claude's clip plan (see KING_TONKA.md)
  python kt.py edit-clip <clip-id> '<json>'   change a clip and queue it for rendering again
  python kt.py campaign-shots <campaign-id>    download the campaign's rule screenshots; prints their paths
  python kt.py fill-campaign <campaign-id> '<json>'   fill in a campaign from its screenshots (checked)
  python kt.py live-to-start                   live videos with no live job running (claims them); one id per line
  python kt.py command <id> <working|done|failed> "<result>"
  python kt.py agent <working|idle|error> "<message>"
  python kt.py log "<text>"
"""
import json
import os
import sys
import time
import urllib.parse

import requests

BUCKET = 'kingtonka'
TABLES = {'projects': 'kt_projects', 'clips': 'kt_clips', 'commands': 'kt_commands', 'activity': 'kt_activity', 'config': 'kt_config',
          'campaigns': 'kt_campaigns'}
WORK = os.environ.get('KT_WORK', os.path.join(os.getcwd(), 'kt-work'))


def _base():
    url, key = os.environ.get('SUPABASE_URL', '').strip(), os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '').strip()
    if not url or not key:
        sys.exit('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.')
    p = urllib.parse.urlparse(url)
    return f'{p.scheme}://{p.netloc}', key


BASE, KEY = _base()
H = {'apikey': KEY, 'Authorization': f'Bearer {KEY}'}


def now():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def _check(r):
    if r.status_code >= 300:
        raise RuntimeError(f'Supabase {r.status_code}: {r.text[:300]}')
    return r


def select(table, query=''):
    r = _check(requests.get(f'{BASE}/rest/v1/{table}?{query}', headers=H, timeout=60))
    return r.json()


def get(table, id_):
    rows = select(table, f'id=eq.{urllib.parse.quote(str(id_))}')
    return rows[0] if rows else None


def insert(table, rows):
    r = _check(requests.post(f'{BASE}/rest/v1/{table}', headers={**H, 'Prefer': 'return=representation'}, json=rows, timeout=60))
    return r.json()


def update(table, id_, patch, where=''):
    if table in ('kt_projects', 'kt_clips', 'kt_commands', 'kt_campaigns'):
        patch = {**patch, 'updated_at': now()}
    r = _check(requests.patch(f'{BASE}/rest/v1/{table}?id=eq.{urllib.parse.quote(str(id_))}{where}',
                              headers={**H, 'Prefer': 'return=representation'}, json=patch, timeout=60))
    rows = r.json()
    return rows[0] if rows else None


def upsert_config(id_, data):
    _check(requests.post(f'{BASE}/rest/v1/kt_config', headers={**H, 'Prefer': 'resolution=merge-duplicates'},
                         json={'id': id_, 'data': data, 'updated_at': now()}, timeout=60))


def log(text):
    insert('kt_activity', {'text': text, 'kind': 'agent'})


def agent(state, message):
    upsert_config('agent', {'state': state, 'message': message, 'at': now()})


def project_step(pid, status=None, step=None, percent=None, **extra):
    """Progress for the app. Never touches a video the owner cancelled."""
    patch = {k: v for k, v in {'status': status, 'step': step, 'percent': percent}.items() if v is not None}
    patch.update(extra)
    return update('kt_projects', pid, patch, where='&status=neq.cancelled')


class Cancelled(Exception):
    """The owner cancelled or deleted the video while King Tonka was working on it."""


_last_check = {}


def check_wanted(pid, every=5):
    """Raises Cancelled if the video was cancelled or deleted in the app.
    Asks the database at most once every `every` seconds."""
    t = time.time()
    if t - _last_check.get(pid, 0) < every:
        return
    _last_check[pid] = t
    try:
        p = get('kt_projects', pid)
    except Exception:  # a network hiccup is not a cancel: keep going, ask again next time
        return
    if not p or p.get('status') == 'cancelled':
        raise Cancelled(pid)


# ---- storage ----
def upload(local, path, content_type):
    with open(local, 'rb') as f:
        _check(requests.post(f'{BASE}/storage/v1/object/{BUCKET}/{urllib.parse.quote(path)}',
                             headers={**H, 'Content-Type': content_type, 'x-upsert': 'true', 'cache-control': '3600'},
                             data=f, timeout=900))
    return path


def download(path, local):
    with requests.get(f'{BASE}/storage/v1/object/{BUCKET}/{urllib.parse.quote(path)}', headers=H, stream=True, timeout=900) as r:
        _check(r)
        with open(local, 'wb') as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)
    return local


def remove(paths):
    paths = [p for p in paths if p]
    if paths:
        requests.delete(f'{BASE}/storage/v1/object/{BUCKET}', headers=H, json={'prefixes': paths}, timeout=60)


def list_files(prefix):
    """Files directly inside a storage folder, by name."""
    r = _check(requests.post(f'{BASE}/storage/v1/object/list/{BUCKET}', headers=H, timeout=60,
                             json={'prefix': prefix.rstrip('/'), 'limit': 100, 'offset': 0, 'sortBy': {'column': 'name', 'order': 'asc'}}))
    return [f"{prefix.rstrip('/')}/{o['name']}" for o in r.json() if o.get('id')]  # folders have no id


# ---- campaigns ----
PLATFORMS = ('tiktok', 'youtube', 'instagram', 'x')
LENGTHS = ('auto', 'short', 'medium', 'long', 'xl')


def clean_campaign(patch):
    """Checks the fields Claude read from a campaign's screenshots."""
    out = {}
    for k, v in patch.items():
        if k in ('name', 'url', 'creator', 'hashtags', 'mentions', 'rules'):
            if v is not None and not isinstance(v, str):
                raise ValueError(f'{k} must be text')
            out[k] = (v or '').strip() or None
        elif k == 'rate':
            out[k] = None if v in (None, '') else round(float(str(v).replace('$', '').replace(',', '')), 4)
            if out[k] is not None and out[k] < 0:
                raise ValueError('rate must be 0 or more')
        elif k == 'min_views':
            out[k] = None if v in (None, '') else int(float(str(v).replace(',', '')))
        elif k == 'platforms':
            bad = [p for p in v if p not in PLATFORMS]
            if bad:
                raise ValueError(f'platforms can only be {", ".join(PLATFORMS)} (not {", ".join(bad)})')
            out[k] = list(dict.fromkeys(v))
        elif k == 'length':
            if v not in LENGTHS:
                raise ValueError(f'length must be one of {", ".join(LENGTHS)}')
            out[k] = v
        elif k in ('needs_face', 'active'):
            if not isinstance(v, bool):
                raise ValueError(f'{k} must be true or false')
            out[k] = v
        else:
            raise ValueError(f'{k} is not a campaign field')
    if out.get('name') is None and 'name' in out:
        del out['name']  # a campaign always keeps a name
    return out


def exists(path):
    r = requests.post(f'{BASE}/storage/v1/object/sign/{BUCKET}/{urllib.parse.quote(path)}', headers=H, json={'expiresIn': 60}, timeout=60)
    return r.status_code < 300


# ---- the clip plan Claude writes ----
SCORE_KEYS = ('hook', 'flow', 'value', 'trend')


def clean_plan(project, plan):
    """Checks Claude's plan and turns it into kt_clips rows. Raises on bad input."""
    clips = plan.get('clips') if isinstance(plan, dict) else plan
    if not isinstance(clips, list) or not clips:
        raise ValueError('The plan needs a non-empty "clips" list.')
    dur = float(project.get('duration_s') or 1e9)
    defaults = project.get('settings') or {}
    style = {k: defaults[k] for k in ('aspect', 'captions', 'position', 'framing', 'cam', 'hook_title', 'color', 'watermark', 'tighten', 'punch')
             if k in defaults}
    rows = []
    for i, c in enumerate(clips):
        start, end = float(c['start']), float(c['end'])
        if not (0 <= start < end <= dur + 1):
            raise ValueError(f'Clip {i + 1}: start/end {start}-{end} is outside the video (0-{dur}).')
        if end - start < 5 or end - start > 600:
            raise ValueError(f'Clip {i + 1}: {end - start:.0f}s long; clips must be 5 s to 10 min.')
        scores = {k: max(0, min(100, int(c.get('scores', {}).get(k, 0)))) for k in SCORE_KEYS}
        score = int(c.get('score') or round(sum(scores.values()) / len(scores)))
        emphasis = [str(w).strip() for w in (c.get('emphasis') or []) if str(w).strip()][:5]
        rows.append({
            'project_id': project['id'], 'title': str(c['title'])[:120], 'hook': c.get('hook'),
            'start_s': round(start, 2), 'end_s': round(end, 2), 'score': max(0, min(100, score)), 'scores': scores,
            'why': c.get('why'), 'post_text': c.get('post_text'), 'hashtags': c.get('hashtags'),
            'style': {**style, **({'emphasis': emphasis} if emphasis else {})}, 'status': 'planned',
        })
    rows.sort(key=lambda r: -r['score'])
    return rows


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    cmd, a = argv[0], argv[1:]
    out = lambda x: print(json.dumps(x, indent=1, ensure_ascii=False, default=str))
    T = lambda name: TABLES.get(name) or sys.exit(f'Unknown table {name}')

    if cmd == 'state':
        commands = select('kt_commands', 'status=in.(queued,working)&order=created_at')
        finding = select('kt_projects', 'status=eq.finding&order=created_at')
        editing = select('kt_clips', 'status=eq.editing&order=updated_at&select=id,project_id,title,start_s,end_s,score,style')
        for p in finding:
            d = os.path.join(WORK, p['id'])
            p['transcript_file'] = os.path.join(d, 'transcript.txt') if os.path.exists(os.path.join(d, 'transcript.txt')) else None
            p['existing_clips'] = select('kt_clips', f"project_id=eq.{p['id']}&select=id,title,start_s,end_s,score&order=start_s")
        for c in editing:
            c['transcript_file'] = os.path.join(WORK, c['project_id'], 'transcript.txt')
        # Campaigns whose rule screenshots the owner wants read ('campaign' commands; project_id holds the campaign id).
        to_read = []
        for c in commands:
            if c['kind'] == 'campaign' and c.get('project_id'):
                camp = get('kt_campaigns', c['project_id'])
                if camp:
                    to_read.append({'command_id': c['id'], 'campaign': camp,
                                    'screenshots': len(list_files(f"campaigns/{camp['id']}"))})
        out({'now': now(), 'work_dir': WORK, 'commands': commands, 'projects_to_clip': finding, 'clips_to_edit': editing,
             'campaigns_to_read': to_read})
    elif cmd == 'get':
        out(get(T(a[0]), a[1]))
    elif cmd == 'list':
        q = 'order=id.desc&limit=100' if a[0] in ('commands', 'activity', 'config') else 'order=created_at.desc&limit=100'
        if len(a) > 1:
            q += f'&status=eq.{a[1]}'
        out(select(T(a[0]), q))
    elif cmd == 'update':
        out(update(T(a[0]), a[1], json.loads(a[2])))
    elif cmd == 'clips':
        out(select('kt_clips', f'project_id=eq.{a[0]}&select=id,title,hook,start_s,end_s,score,scores,status,why&order=score.desc'))
    elif cmd == 'add-clips':
        project = get('kt_projects', a[0]) or sys.exit(f'No project {a[0]}: the owner deleted it. Skip it.')
        if project['status'] not in ('finding', 'live'):
            sys.exit(f'Not accepted: this video is "{project["status"]}" now (the owner cancelled it or it is no longer '
                     'waiting for clips). Skip it.')
        with open(a[1]) as f:
            plan = json.load(f)
        try:
            rows = clean_plan(project, plan)
        except (ValueError, KeyError, TypeError) as e:
            sys.exit(f'Plan not accepted: {e}')
        saved = insert('kt_clips', rows)
        if isinstance(plan, dict) and plan.get('title') and not project.get('title'):
            update('kt_projects', a[0], {'title': plan['title'][:140]})
        if project['status'] != 'live':  # a live stream stays live; its clips render as they come
            project_step(a[0], 'rendering', f'Rendering {len(saved)} clips…', 70)
        out([{'id': r['id'], 'title': r['title'], 'score': r['score']} for r in saved])
    elif cmd == 'edit-clip':
        patch = json.loads(a[1])
        allowed = {'title', 'hook', 'start_s', 'end_s', 'score', 'scores', 'why', 'post_text', 'hashtags', 'style', 'words'}
        bad = set(patch) - allowed
        if bad:
            sys.exit(f'Not editable: {", ".join(sorted(bad))}')
        if 'style' in patch:
            cur = get('kt_clips', a[0]) or {}
            patch['style'] = {**(cur.get('style') or {}), **patch['style']}
        if 'start_s' in patch or 'end_s' in patch:
            patch.setdefault('words', None)  # the words come again from the new range
        out(update('kt_clips', a[0], {**patch, 'status': 'rerender', 'error': None}))
    elif cmd == 'campaign-shots':
        d = os.path.join(WORK, 'campaigns', a[0])
        os.makedirs(d, exist_ok=True)
        got = []
        for path in list_files(f'campaigns/{a[0]}'):
            local = os.path.join(d, os.path.basename(path))
            download(path, local)
            got.append(local)
        out(got)
    elif cmd == 'fill-campaign':
        if not get('kt_campaigns', a[0]):
            sys.exit(f'No campaign {a[0]}: the owner deleted it. Skip it.')
        try:
            patch = clean_campaign(json.loads(a[1]))
        except (ValueError, TypeError) as e:
            sys.exit(f'Not accepted: {e}')
        out(update('kt_campaigns', a[0], patch))
    elif cmd == 'live-to-start':
        # A live job updates live_seen_at every minute; none for 10 minutes means none is running.
        stale = time.time() - 10 * 60
        for p in select('kt_projects', 'status=eq.live&select=id,settings'):
            seen = (p.get('settings') or {}).get('live_seen_at') or 0
            if seen < stale:
                update('kt_projects', p['id'], {'settings': {**(p.get('settings') or {}), 'live_seen_at': time.time()}})
                print(p['id'])
    elif cmd == 'command':
        out(update('kt_commands', int(a[0]), {'status': a[1], 'result': ' '.join(a[2:])}))
    elif cmd == 'agent':
        agent(a[0], ' '.join(a[1:]))
        print('agent', a[0])
    elif cmd == 'log':
        log(' '.join(a))
        print('logged')
    else:
        print(__doc__)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
