#!/usr/bin/env python3
"""Step 3 of a King Tonka run: turn every planned clip into a finished video.

For each clip waiting (planned, rerender, or stuck in rendering): cut it from
the source, reframe it (follow the speaker's face, a fixed crop, or the whole
picture on a blurred background), burn in animated captions and the hook title,
even out the loudness, and upload the MP4 and a still frame to the app.

  python render.py                 everything waiting
  python render.py --local SRC WORDS.json START END OUT.mp4 [style-json]   one clip, no database (for testing)
"""
import json
import os
import subprocess
import sys
import tempfile
import time
import traceback

import captions

SIZES = {'9:16': (1080, 1920), '1:1': (1080, 1080), '16:9': (1920, 1080), '4:5': (1080, 1350)}
FONTS = os.environ.get('KT_FONTS', os.path.expanduser('~/.local/share/fonts'))


def run(cmd):
    r = subprocess.run(cmd, text=True, capture_output=True)
    if r.returncode:
        raise RuntimeError(f'{os.path.basename(cmd[0])} failed: {r.stderr.strip()[-600:]}')
    return r.stdout


def probe(src):
    info = json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries',
                           'stream=width,height,r_frame_rate:stream_side_data=rotation:format=duration', '-of', 'json', src]))
    s = info['streams'][0]
    w, h = int(s['width']), int(s['height'])
    rot = next((abs(int(d.get('rotation', 0))) for d in s.get('side_data_list', []) if 'rotation' in d), 0)
    if rot in (90, 270):
        w, h = h, w
    num, den = (s.get('r_frame_rate') or '30/1').split('/')
    fps = float(num) / float(den or 1) if float(den or 1) else 30
    has_audio = bool(json.loads(run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'json', src])).get('streams'))
    return w, h, fps, float(info['format']['duration']), has_audio


# ---------- words ----------
def clip_words(all_words, start, end):
    """The words inside [start, end], made relative to the clip start."""
    out = []
    for s, e, t in all_words:
        if e > start + 0.05 and s < end - 0.05:
            out.append([round(max(0, s - start), 2), round(min(end, e) - start, 2), t])
    return out


def snap(all_words, start, end):
    """Moves the cut points to word edges so clips never start or stop mid-word."""
    if not all_words:
        return start, end
    first = next((w for w in all_words if w[1] > start + 0.05), None)
    if first and start - 1.5 <= first[0] <= start + 1.5:
        start = max(0.0, first[0] - 0.12)
    inside = [i for i, w in enumerate(all_words) if w[0] < end - 0.05]
    if inside:
        i = inside[-1]
        last = all_words[i]
        if end - 1.5 <= last[1] <= end + 1.5:
            nxt = all_words[i + 1][0] if i + 1 < len(all_words) else last[1] + 1
            end = last[1] + max(0.05, min(0.4, nxt - last[1] - 0.03))
    return round(start, 2), round(end, 2)


# ---------- framing ----------
def track_faces(src, start, end, w, h):
    """Where the main face is (x centre, 0–1), about 5 times a second. None when no face."""
    import cv2
    cap = cv2.VideoCapture(src)
    cap.set(cv2.CAP_PROP_POS_MSEC, start * 1000)
    fps = cap.get(cv2.CAP_PROP_FPS) or 30
    step = max(1, round(fps / 5))
    front = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    profile = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_profileface.xml')
    samples, n = [], 0
    scale = 640 / max(1, w)
    while True:
        ok = cap.grab()
        if not ok:
            break
        t = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000
        if t > end:
            break
        n += 1
        if n % step:
            continue
        ok, frame = cap.retrieve()
        if not ok:
            break
        small = cv2.cvtColor(cv2.resize(frame, None, fx=scale, fy=scale), cv2.COLOR_BGR2GRAY)
        min_size = max(24, int(small.shape[0] * 0.08))
        faces = list(front.detectMultiScale(small, 1.15, 5, minSize=(min_size, min_size)))
        if not faces:
            faces = list(profile.detectMultiScale(small, 1.15, 5, minSize=(min_size, min_size)))
        if faces:
            fx, fy, fw, fh = max(faces, key=lambda f: f[2] * f[3])
            samples.append((t - start, (fx + fw / 2) / small.shape[1]))
        else:
            samples.append((t - start, None))
    cap.release()
    return samples


def camera_path(samples, duration, frac):
    """Turns face positions into calm camera moves: hold still, and cut to the
    new spot only when the face has really moved (like a multi-camera edit)."""
    lo, hi = frac / 2, 1 - frac / 2
    pts = [(t, min(hi, max(lo, x))) for t, x in samples if x is not None]
    if not pts:
        return [(0.0, 0.5)]
    # median of 5 to ignore single wrong detections
    xs = [x for _, x in pts]
    med = [sorted(xs[max(0, i - 2):i + 3])[len(xs[max(0, i - 2):i + 3]) // 2] for i in range(len(xs))]
    pts = [(pts[i][0], med[i]) for i in range(len(pts))]
    path = [(0.0, pts[0][1])]
    cur, pending_since = pts[0][1], None
    for t, x in pts:
        if abs(x - cur) > frac * 0.18:
            pending_since = pending_since if pending_since is not None else t
            if t - pending_since >= 0.6:
                cur = x
                path.append((round(pending_since, 2), cur))
                pending_since = None
        else:
            pending_since = None
    return path


def video_filter(src_info, out_size, framing, start, end, src, tmp):
    w, h, fps, _, _ = src_info
    ow, oh = out_size
    fps_f = ',fps=30' if fps > 31 else ''
    if framing == 'fit' or abs(w / h - ow / oh) < 0.03:
        if abs(w / h - ow / oh) < 0.03:
            return f'[0:v]scale={ow}:{oh}:flags=lanczos,setsar=1{fps_f}'
        return (f'[0:v]split[a][b];[a]scale={ow // 4}:{oh // 4}:force_original_aspect_ratio=increase,crop={ow // 4}:{oh // 4},'
                f'boxblur=12:2,eq=brightness=-0.06,scale={ow}:{oh}[bg];'
                f'[b]scale={ow}:{oh}:force_original_aspect_ratio=decrease:flags=lanczos[fg];'
                f'[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1{fps_f}')
    if w / h > ow / oh:  # wider source: crop the sides, follow the face
        cw, ch = int(h * ow / oh) // 2 * 2, h
        frac = cw / w
        if framing in ('left', 'right', 'center'):
            path = [(0.0, {'left': frac / 2, 'center': 0.5, 'right': 1 - frac / 2}[framing])]
        else:
            path = camera_path(track_faces(src, start, end, w, h), end - start, frac)
        to_x = lambda c: int(min(w - cw, max(0, c * w - cw / 2)))
        cmd = os.path.join(tmp, 'camera.txt')
        with open(cmd, 'w') as f:
            for t, c in path[1:]:
                f.write(f'{t:.2f} crop x {to_x(c)};\n')
        send = f"sendcmd=f='{cmd}'," if len(path) > 1 else ''
        return f'[0:v]{send}crop={cw}:{ch}:{to_x(path[0][1])}:0,scale={ow}:{oh}:flags=lanczos,setsar=1{fps_f}'
    # taller source into a wider frame: crop top and bottom, keep the upper middle
    cw, ch = w, int(w * oh / ow) // 2 * 2
    return f'[0:v]crop={cw}:{ch}:0:{int((h - ch) * 0.35)},scale={ow}:{oh}:flags=lanczos,setsar=1{fps_f}'


def render_clip(src, all_words, start, end, out, style=None, title=None, words=None):
    """Renders one clip to out (MP4) and out.jpg. Returns (start, end, words used)."""
    style = style or {}
    info = probe(src)
    start, end = max(0.0, float(start)), min(info[3], float(end))
    if words is None:
        start, end = snap(all_words, start, end)
        words = clip_words(all_words, start, end)
    dur = round(end - start, 2)
    size = SIZES.get(style.get('aspect', '9:16'), SIZES['9:16'])
    with tempfile.TemporaryDirectory() as tmp:
        ass = os.path.join(tmp, 'captions.ass')
        with open(ass, 'w') as f:
            f.write(captions.build(words, dur, size[0], size[1], style, title))
        vf = video_filter(info, size, style.get('framing', 'auto'), start, end, src, tmp)
        vf += f",ass='{ass}'" + (f":fontsdir='{FONTS}'" if os.path.isdir(FONTS) else '') + '[v]'
        # Stay under 45 MB so the clip always fits the storage limit.
        kbps = int(min(6000, max(1200, 45 * 8 * 1000 / max(dur, 1) - 160)))
        cmd = ['ffmpeg', '-v', 'error', '-y', '-ss', f'{start:.3f}', '-i', src, '-t', f'{dur:.3f}',
               '-filter_complex', vf, '-map', '[v]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21',
               '-maxrate', f'{kbps}k', '-bufsize', f'{kbps * 2}k', '-pix_fmt', 'yuv420p', '-movflags', '+faststart']
        if info[4]:
            cmd += ['-map', '0:a:0', '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000']
        run(cmd + [out])
    run(['ffmpeg', '-v', 'error', '-y', '-ss', str(min(1.0, dur / 2)), '-i', out, '-frames:v', '1', '-vf', 'scale=540:-2', '-q:v', '4',
         out.rsplit('.', 1)[0] + '.jpg'])
    return start, end, words


# ---------- the run ----------
def render_waiting():
    import kt
    import prepare
    clips = kt.select('kt_clips', 'status=in.(planned,rerender,rendering)&order=score.desc')
    if not clips:
        print('Nothing to render.')
        return 0
    by_project = {}
    for c in clips:
        by_project.setdefault(c['project_id'], []).append(c)
    done_projects = []
    total, n = len(clips), 0
    for pid, items in by_project.items():
        project = kt.get('kt_projects', pid)
        if not project or project['status'] == 'cancelled':
            continue  # the owner deleted or cancelled it: leave its clips alone
        d = os.path.join(kt.WORK, pid)
        try:
            kt.agent('working', f'Getting “{(project.get("title") or "the video")[:50]}” ready to cut…')
            prepare.get_source(project, d)
            prepare.restore_transcript(pid)
            with open(os.path.join(d, 'words.json')) as f:
                all_words = json.load(f)['words']
        except kt.Cancelled:
            prepare.stopped(project)
            continue
        except Exception as e:
            traceback.print_exc()
            for c in items:
                kt.update('kt_clips', c['id'], {'status': 'failed', 'error': f'Couldn’t get the source video again: {e}'[:400]})
            continue
        cancelled = False
        for c in items:
            n += 1
            try:
                kt.check_wanted(pid, every=0)
            except kt.Cancelled:
                cancelled = True
                break
            kt.agent('working', f'Rendering clip {n} of {total}: “{(c.get("title") or "")[:50]}”')
            kt.update('kt_clips', c['id'], {'status': 'rendering'})
            if project['status'] == 'rendering':
                kt.project_step(pid, step=f'Rendering clip {n} of {total}…', percent=70 + 29 * n // max(total, 1))
            try:
                out = os.path.join(d, f"{c['id']}.mp4")
                edited_words = c.get('words') if c['status'] == 'rerender' else None
                s, e, words = render_clip(os.path.join(d, 'source.mp4'), all_words, c['start_s'], c['end_s'], out,
                                          c.get('style') or {}, c.get('hook') if (c.get('style') or {}).get('hook_title', True) else None,
                                          words=edited_words)
                kt.check_wanted(pid, every=0)  # cancelled while this clip was rendering?
                stamp = time.strftime('%Y%m%d%H%M%S')
                path = kt.upload(out, f"clips/{c['id']}-{stamp}.mp4", 'video/mp4')
                thumb = kt.upload(out.rsplit('.', 1)[0] + '.jpg', f"clips/{c['id']}-{stamp}.jpg", 'image/jpeg')
                old = [c.get('media_path'), c.get('thumb_path')]
                kt.update('kt_clips', c['id'], {'status': 'ready', 'media_path': path, 'thumb_path': thumb, 'start_s': s, 'end_s': e,
                                                'words': words, 'transcript': ' '.join(w[2] for w in words)[:4000], 'error': None})
                kt.remove([p for p in old if p and p not in (path, thumb)])
                for f in (out, out.rsplit('.', 1)[0] + '.jpg'):
                    os.remove(f)
            except kt.Cancelled:
                cancelled = True
                kt.update('kt_clips', c['id'], {'status': c['status']})  # back to waiting, not failed
                break
            except Exception as e:
                traceback.print_exc()
                kt.update('kt_clips', c['id'], {'status': 'failed', 'error': str(e)[:400]})
        if cancelled:
            prepare.stopped(project)
            continue
        done_projects.append(project)

    # Finish projects and the commands that asked for them.
    for project in done_projects:
        pid = project['id']
        rows = kt.select('kt_clips', f'project_id=eq.{pid}&select=id,status,score,title')
        if any(r['status'] in ('planned', 'rendering', 'rerender', 'editing') for r in rows):
            continue
        ready = [r for r in rows if r['status'] == 'ready']
        best = max(ready, key=lambda r: r['score'] or 0) if ready else None
        if project['status'] in ('rendering', 'finding'):
            kt.project_step(pid, 'done', f'{len(ready)} clips ready', 100)
            kt.log(f'{len(ready)} clips ready from “{(project.get("title") or pid)[:60]}”' + (f'. Best: “{best["title"]}” ({best["score"]}).' if best else '.'))
        result = f'{len(ready)} clips ready' + (f'. Best: “{best["title"]}” scored {best["score"]}.' if best else '.')
        failed = len(rows) - len(ready)
        if failed:
            result += f' {failed} failed to render.'
        for cmd in kt.select('kt_commands', f'project_id=eq.{pid}&status=in.(queued,working)&kind=in.(process,more,rerender)'):
            kt.update('kt_commands', cmd['id'], {'status': 'done' if ready else 'failed', 'result': result})
    ids = {c['id'] for c in clips}
    for cmd in kt.select('kt_commands', 'status=in.(queued,working)&kind=in.(rerender,edit)'):
        if cmd.get('clip_id') in ids:
            row = kt.get('kt_clips', cmd['clip_id'])
            ok = row and row['status'] == 'ready'
            kt.update('kt_commands', cmd['id'], {'status': 'done' if ok else 'failed',
                                                 'result': 'Updated clip is ready.' if ok else f'Render failed: {(row or {}).get("error") or "unknown"}'})
    return 0


if __name__ == '__main__':
    if len(sys.argv) > 1 and sys.argv[1] == '--local':
        src, words_file, s, e, out = sys.argv[2:7]
        style = json.loads(sys.argv[7]) if len(sys.argv) > 7 else {}
        with open(words_file) as f:
            ws = json.load(f)['words']
        print(render_clip(src, ws, float(s), float(e), out, style, style.get('title'))[:2])
    else:
        sys.exit(render_waiting())
