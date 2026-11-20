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


# ---------- streamer on top, game below ----------
CORNERS = {'top-left': (0, 0), 'top-right': (1, 0), 'bottom-left': (0, 1), 'bottom-right': (1, 1)}


def find_facecam(src, start, end, w, h):
    """Looks for faces that stay in one place (a streamer's webcam stays put while the
    game moves; faces in the game move around, so they don't add up in one spot).
    Returns the steadiest spots first, each (share of frames with a face there,
    centre x, centre y, face width), all 0–1 of the picture."""
    import cv2
    cap = cv2.VideoCapture(src)
    dur = max(1.0, end - start)
    n = int(min(40, max(10, dur)))  # about one look per second
    scale = min(1.0, 960 / max(1, w))
    front = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
    found, looked = [], 0
    for i in range(n):
        cap.set(cv2.CAP_PROP_POS_MSEC, (start + dur * (i + 0.5) / n) * 1000)
        ok, frame = cap.read()
        if not ok:
            continue
        looked += 1
        small = cv2.cvtColor(cv2.resize(frame, None, fx=scale, fy=scale), cv2.COLOR_BGR2GRAY)
        H, W = small.shape
        side = max(18, int(H * 0.035))
        for (x, y, fw, fh) in front.detectMultiScale(small, 1.1, 6, minSize=(side, side)):
            found.append(((x + fw / 2) / W, (y + fh / 2) / H, fw / W, i))
    cap.release()
    spots, left = [], found
    while left and looked and len(spots) < 3:
        best = None
        for cx, cy, size, _ in left:
            near = [f for f in left if abs(f[0] - cx) < 0.04 and abs(f[1] - cy) < 0.06 and 0.6 < f[2] / size < 1.6]
            frames = len({f[3] for f in near})
            if not best or frames > best[0]:
                best = (frames, near)
        frames, near = best
        mid = lambda k, near=near: sorted(f[k] for f in near)[len(near) // 2]
        spots.append((frames / looked, mid(0), mid(1), mid(2)))
        left = [f for f in left if f not in near]
    return spots


def stream_boxes(src, start, end, w, h, style):
    """Where the webcam and the game are, when this clip should be laid out
    streamer-on-top. Returns (cam box, game box) as (x, y, width, height) in
    pixels, or None to use the normal framing."""
    framing = style.get('framing', 'auto')
    if framing not in ('auto', 'stream') or w <= h:
        return None
    corner = CORNERS.get(style.get('cam'))
    spots = find_facecam(src, start, end, w, h)
    hit = spots[0] if spots else None
    if hit:
        share, cx, cy, size = hit
        in_corner = (cx < 0.25 or cx > 0.75) and (cy < 0.3 or cy > 0.65)
        # Another face that stays put far away: people talking (a podcast), not a webcam over a game.
        others = any(o[0] >= 0.3 and (abs(o[1] - cx) > 0.2 or abs(o[2] - cy) > 0.25) for o in spots[1:])
        if corner:  # the owner said where the camera is: only accept a face on that side
            ok = size < 0.18 and share >= 0.2 and (cx < 0.5) == (corner[0] == 0) and (cy < 0.5) == (corner[1] == 0)
        elif framing == 'stream':
            ok = size < 0.18 and share >= 0.25
        elif style.get('_gaming'):  # a gaming video or a Twitch/Kick stream
            ok = size < 0.16 and share >= 0.35 and (cx < 0.4 or cx > 0.6) and not others
        else:  # anything else needs strong signs, so podcasts never get split
            ok = size < 0.14 and share >= 0.5 and in_corner and not others
        if not ok:
            hit = None
    if not hit and not corner:
        return None
    if hit:
        fw = size * w
        bw = min(w * 0.5, max(fw * 3.4, w * 0.16))
    else:  # no face found but the owner picked the corner: take a typical webcam-sized box there
        bw = w * 0.3
        cx = 0.02 + bw / w / 2 if corner[0] == 0 else 0.98 - bw / w / 2
        cy = None
    return bw, cx, cy, corner


def even(v):
    return max(2, int(v) // 2 * 2)


def stream_filter(src_info, out_size, boxes):
    w, h, fps, _, _ = src_info
    ow, oh = out_size
    fps_f = ',fps=30' if fps > 31 else ''
    bw, cx, cy, corner = boxes
    top_h = even(oh / 3)
    bot_h = oh - top_h
    # Camera box: same shape as the top panel, the face a little above its middle.
    bh = bw * top_h / ow
    if bh > h * 0.6:
        bh, bw = h * 0.6, h * 0.6 * ow / top_h
    if cy is None:  # corner without a face: hug that corner
        y = h * 0.02 if corner[1] == 0 else h * 0.98 - bh
    else:
        y = cy * h - bh * 0.45
    x = min(w - bw, max(0, cx * w - bw / 2))
    y = min(h - bh, max(0, y))
    # Game: the middle of the picture, as tall as it is, in the bottom panel's shape.
    gw = min(w, h * ow / bot_h)
    gx = (w - gw) / 2
    return (f'[0:v]split=2[cam][game];'
            f'[cam]crop={even(bw)}:{even(bh)}:{int(x)}:{int(y)},scale={ow}:{top_h}:flags=lanczos,setsar=1[top];'
            f'[game]crop={even(gw)}:{even(h)}:{int(gx)}:0,scale={ow}:{bot_h}:flags=lanczos,setsar=1[bottom];'
            f'[top][bottom]vstack=inputs=2{fps_f}'), top_h / oh


def video_filter(src_info, out_size, framing, start, end, src, tmp, style=None):
    """The ffmpeg picture filter for this framing. Returns (filter, seam), where seam
    is where the camera meets the game (0–1 of the height) in the streamer layout."""
    w, h, fps, _, _ = src_info
    ow, oh = out_size
    fps_f = ',fps=30' if fps > 31 else ''
    if ow < oh and framing in ('auto', 'stream'):
        boxes = stream_boxes(src, start, end, w, h, {**(style or {}), 'framing': framing})
        if boxes:
            return stream_filter(src_info, out_size, boxes)
        if framing == 'stream' or (style or {}).get('_gaming'):
            framing = 'fit'  # gameplay without a webcam: show the whole game
    return plain_filter(src_info, out_size, framing, start, end, src, tmp, fps_f), None


def plain_filter(src_info, out_size, framing, start, end, src, tmp, fps_f):
    w, h, fps, _, _ = src_info
    ow, oh = out_size
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
        vf, seam = video_filter(info, size, style.get('framing', 'auto'), start, end, src, tmp, style)
        with open(ass, 'w') as f:
            f.write(captions.build(words, dur, size[0], size[1], {**style, '_seam': seam}, title))
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
                style = {**(c.get('style') or {}), '_gaming': bool((project.get('settings') or {}).get('gaming'))}
                s, e, words = render_clip(os.path.join(d, 'source.mp4'), all_words, c['start_s'], c['end_s'], out,
                                          style, c.get('hook') if style.get('hook_title', True) else None,
                                          words=edited_words)
                kt.check_wanted(pid, every=0)  # cancelled while this clip was rendering?
                stamp = time.strftime('%Y%m%d%H%M%S')
                path = kt.upload(out, f"clips/{c['id']}-{stamp}.mp4", 'video/mp4')
                thumb = kt.upload(out.rsplit('.', 1)[0] + '.jpg', f"clips/{c['id']}-{stamp}.jpg", 'image/jpeg')
                old = [c.get('media_path'), c.get('thumb_path')]
                saved = kt.update('kt_clips', c['id'], {'status': 'ready', 'media_path': path, 'thumb_path': thumb, 'start_s': s, 'end_s': e,
                                                        'words': words, 'transcript': ' '.join(w[2] for w in words)[:4000], 'error': None})
                if saved is None:  # the owner deleted this clip while it was rendering
                    old += [path, thumb]
                kt.remove([p for p in old if p and (saved is None or p not in (path, thumb))])
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
