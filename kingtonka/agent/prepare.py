#!/usr/bin/env python3
"""Step 1 of a King Tonka run: get every new video ready for Claude.

For each queued project: download it (link via yt-dlp, or the file uploaded from
the phone), transcribe it word by word with faster-whisper, and save
transcript.txt (for Claude) and words.json (for the captions) in kt-work/<id>/,
plus a copy of both in storage so later edits don't need to transcribe again.
Projects with a "more" request or clips waiting for an edit get their saved
transcript back. Then the project moves to "finding" for Claude.
"""
import json
import os
import subprocess
import sys
import traceback

import kt

COOKIES = os.environ.get('KT_COOKIES_FILE')  # optional cookies.txt for YouTube


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw)


def probe_duration(path):
    r = run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', path])
    return float(r.stdout.strip())


def friendly_download_error(err):
    e = err.lower()
    if 'sign in to confirm' in e or 'not a bot' in e or 'cookies' in e:
        return ('YouTube blocked the download from GitHub’s servers. Upload the video file instead, '
                'or add your YouTube cookies (SETUP.md, “If YouTube blocks downloads”).')
    if 'private' in e or 'login' in e or 'members-only' in e:
        return 'This video is private or needs a login. Upload the file instead.'
    if 'unsupported url' in e:
        return 'This link isn’t supported. Paste the link to the video page itself, or upload the file.'
    if 'unavailable' in e or '404' in e:
        return 'The video is unavailable (deleted, blocked in this country, or the link is wrong).'
    return 'Couldn’t download the video: ' + err.strip().splitlines()[-1][:220]


def download_link(url, d):
    """Downloads up to 1080p into d/source.mp4 and returns yt-dlp's info."""
    base = ['yt-dlp', '--no-playlist', '--no-progress', '--restrict-filenames']
    if COOKIES and os.path.exists(COOKIES):
        base += ['--cookies', COOKIES]
    info = json.loads(run(base + ['-J', url]).stdout)
    if info.get('_type') == 'playlist':
        raise RuntimeError('That is a playlist. Paste the link to one video.')
    if (info.get('duration') or 0) > 4 * 3600:
        raise RuntimeError('The video is longer than 4 hours. Use “Only part of the video”, or trim it first.')
    run(base + ['-f', 'bv*[height<=1080][vcodec^=avc1]+ba[ext=m4a]/bv*[height<=1080]+ba/b[height<=1080]/b',
                '--merge-output-format', 'mp4', '-o', os.path.join(d, 'source.%(ext)s'), url])
    found = [f for f in os.listdir(d) if f.startswith('source.')]
    if not found:
        raise RuntimeError('The download finished but no video file was saved.')
    if found[0] != 'source.mp4':
        run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(d, found[0]), '-c', 'copy', os.path.join(d, 'source.mp4')])
    return info


def get_source(project, d):
    """Makes sure d/source.mp4 exists. Returns (title, info)."""
    os.makedirs(d, exist_ok=True)
    src = os.path.join(d, 'source.mp4')
    if os.path.exists(src):
        return project.get('title'), {}
    if project.get('source_path'):
        kt.download(project['source_path'], os.path.join(d, 'upload.bin'))
        run(['ffmpeg', '-v', 'error', '-y', '-i', os.path.join(d, 'upload.bin'), '-c', 'copy', '-movflags', '+faststart', src])
        os.remove(os.path.join(d, 'upload.bin'))
        return project.get('title') or os.path.basename(project['source_path']).split('-', 1)[-1], {}
    try:
        info = download_link(project['source_url'], d)
    except subprocess.CalledProcessError as e:
        raise RuntimeError(friendly_download_error(e.stderr or str(e))) from None
    return info.get('title'), info


def fmt(t):
    return f'{int(t // 60)}:{t % 60:04.1f}'


def transcribe(src, d, language=None, duration=0, on_progress=None):
    from faster_whisper import WhisperModel
    size = os.environ.get('KT_WHISPER') or ('small' if duration <= 50 * 60 else 'base')
    model = WhisperModel(size, device='cpu', compute_type='int8', cpu_threads=os.cpu_count() or 4)
    segments, info = model.transcribe(src, language=None if language in (None, '', 'auto') else language,
                                      word_timestamps=True, vad_filter=True, beam_size=1,
                                      condition_on_previous_text=False)
    words, lines, last = [], [], 0
    for seg in segments:
        for w in seg.words or []:
            text = w.word.strip()
            if text:
                words.append([round(w.start, 2), round(w.end, 2), text])
        lines.append(f'[{fmt(seg.start)} → {fmt(seg.end)}] {seg.text.strip()}')
        if on_progress and duration and seg.end - last > 60:
            last = seg.end
            on_progress(min(99, int(seg.end * 100 / duration)))
    with open(os.path.join(d, 'words.json'), 'w') as f:
        json.dump({'language': info.language, 'words': words}, f)
    with open(os.path.join(d, 'transcript.txt'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    return info.language, len(words)


def thumbnail(src, d, at):
    out = os.path.join(d, 'thumb.jpg')
    run(['ffmpeg', '-v', 'error', '-y', '-ss', str(at), '-i', src, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', out])
    return out


def prepare(project):
    pid = project['id']
    d = os.path.join(kt.WORK, pid)
    settings = project.get('settings') or {}
    kt.agent('working', f'Downloading “{project.get("title") or project.get("source_url") or "your video"}”…')
    kt.project_step(pid, 'downloading', 'Downloading the video…', 5, error=None)
    title, info = get_source(project, d)
    src = os.path.join(d, 'source.mp4')
    duration = probe_duration(src)
    thumb = kt.upload(thumbnail(src, d, min(5, duration / 3)), f'projects/{pid}/thumb.jpg', 'image/jpeg')
    kt.project_step(pid, 'transcribing', 'Listening to every word…', 20, duration_s=round(duration, 1),
                    title=(project.get('title') or title or 'Untitled video')[:140], thumb_path=thumb)
    kt.agent('working', f'Transcribing “{(title or "your video")[:60]}” ({int(duration // 60)} min)…')
    lang, n = transcribe(src, d, settings.get('language'), duration,
                         lambda p: kt.project_step(pid, step=f'Listening to every word… {p}%', percent=20 + p * 40 // 100))
    if n < 20:
        raise RuntimeError('No speech found in this video. King Tonka clips videos where people talk.')
    kt.upload(os.path.join(d, 'transcript.txt'), f'projects/{pid}/transcript.txt', 'text/plain')
    kt.upload(os.path.join(d, 'words.json'), f'projects/{pid}/words.json', 'application/json')
    with open(os.path.join(d, 'meta.json'), 'w') as f:
        json.dump({'id': pid, 'title': title, 'duration_s': duration, 'language': lang, 'settings': settings,
                   'uploader': info.get('uploader'), 'description': (info.get('description') or '')[:1500]}, f, indent=1)
    kt.project_step(pid, 'finding', 'Claude is watching for the best moments…', 60)
    kt.log(f'Transcribed “{(title or pid)[:60]}”: {int(duration // 60)} min, {n} words ({lang}).')


def restore_transcript(pid):
    """Gets the saved transcript of an earlier project back into kt-work."""
    d = os.path.join(kt.WORK, pid)
    os.makedirs(d, exist_ok=True)
    for name in ('transcript.txt', 'words.json'):
        if not os.path.exists(os.path.join(d, name)):
            kt.download(f'projects/{pid}/{name}', os.path.join(d, name))


def main():
    os.makedirs(kt.WORK, exist_ok=True)
    commands = kt.select('kt_commands', 'status=eq.queued&order=created_at')
    # "Process" commands for projects that were reset: queue them again.
    for c in commands:
        if c['kind'] == 'process' and c.get('project_id'):
            p = kt.get('kt_projects', c['project_id'])
            if p and p['status'] in ('failed', 'done') and not kt.select('kt_clips', f"project_id=eq.{p['id']}&select=id&limit=1"):
                kt.project_step(p['id'], 'queued', 'Waiting…', 0)
            kt.update('kt_commands', c['id'], {'status': 'working'})
    failures = 0
    for p in kt.select('kt_projects', 'status=in.(queued,downloading,transcribing)&order=created_at'):
        try:
            prepare(p)
        except Exception as e:  # one bad video must not stop the others
            traceback.print_exc()
            failures += 1
            msg = str(e) if isinstance(e, RuntimeError) else f'Something went wrong while preparing the video: {e}'
            kt.project_step(p['id'], 'failed', 'Failed', 0, error=msg[:500])
            kt.log(f'Couldn’t prepare “{(p.get("title") or p.get("source_url") or p["id"])[:60]}”: {msg[:200]}')
            for c in kt.select('kt_commands', f"project_id=eq.{p['id']}&kind=eq.process&status=in.(queued,working)"):
                kt.update('kt_commands', c['id'], {'status': 'failed', 'result': msg[:300]})
    # Earlier projects Claude needs again: "find more" and free-text clip edits.
    need = {c['project_id'] for c in commands if c['kind'] in ('more', 'edit') and c.get('project_id')}
    need |= {c['project_id'] for c in kt.select('kt_clips', 'status=eq.editing&select=project_id')}
    for pid in need:
        try:
            restore_transcript(pid)
            p = kt.get('kt_projects', pid)
            if p and any(c['kind'] == 'more' and c.get('project_id') == pid for c in commands):
                kt.project_step(pid, 'finding', 'Claude is looking for more moments…', 60)
        except Exception as e:
            traceback.print_exc()
            kt.log(f'Couldn’t load the transcript of {pid}: {e}')
    return 1 if failures and failures == len(commands) else 0


if __name__ == '__main__':
    sys.exit(main())
