"""Makes finished clips again with the latest fixes. Run by hand: the agent workflow with the
task "redo-clips" (render.py then does the rendering, in the same run).

- Clips from a video: marked to be made again (your edits are kept).
- Clips from a live stream: the recording is deleted once the stream ends, so they are moved onto
  the stream's replay first. The replay starts when the stream started, King Tonka's recording
  some time later: the exact difference is found by matching the words heard in both.
Clips already posted are left as they are.

    python kingtonka/agent/redo.py
"""
import json
import os
import re
import sys
import tempfile
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kt  # noqa: E402
import prepare  # noqa: E402

SEARCH = 240      # seconds of the replay searched on each side of the first guess
NEAR = 60         # seconds of the live transcript (each side of a clip) matched against it
MIN_VOTES = 12    # words that must agree on the same shift


def norm(word):
    return re.sub(r"[^\w']", '', word.lower())


def find_shift(live_words, replay_words, guess, search=SEARCH):
    """Seconds to add to a live (stream) time to get the same moment in the replay: the shift on
    which the most words agree. Returns (shift, votes, best other) or (None, 0, 0)."""
    at = {}
    for s, _, w in replay_words:
        k = norm(w)
        if len(k) >= 3:
            at.setdefault(k, []).append(float(s))
    votes = {}
    for s, _, w in live_words:
        for r in at.get(norm(w), ()):
            d = r - float(s)
            if abs(d - guess) <= search:
                votes.setdefault(round(d / 0.2), []).append(d)
    if not votes:
        return None, 0, 0

    def pooled(b):
        return votes.get(b - 1, []) + votes[b] + votes.get(b + 1, [])
    best = max(votes, key=lambda b: len(pooled(b)))
    pool = sorted(pooled(best))
    other = max((len(pooled(b)) for b in votes if abs(b - best) > 3), default=0)
    return pool[len(pool) // 2], len(pool), other


def shift_line(line, by):
    """'[1:02:03.4 → 1:02:07.9] text' with both times moved by `by` seconds."""
    def move(m):
        return prepare.fmt(max(0.0, seconds(m.group(0)) + by))
    head, sep, rest = line.partition('] ')
    if not head.startswith('[') or not sep:
        return line
    return re.sub(r'(?:\d+:)?\d+:\d+(?:\.\d+)?', move, head) + sep + rest


def seconds(stamp):
    t = 0.0
    for part in stamp.split(':'):
        t = t * 60 + float(part)
    return t


def replay_words(url, a, b, language, d):
    """Words heard in the replay between a and b (seconds), with replay times."""
    name = os.path.join(d, 'replay-sound')
    prepare.ytdlp(prepare.ytdlp_base() + ['-f', 'ba/b', '--download-sections', f'*{a:.2f}-{b:.2f}', '--force-keyframes-at-cuts',
                                          '-o', name + '.%(ext)s', url])
    got = prepare._saved(d, 'replay-sound')
    prepare.transcribe(got, d, language, b - a, shift=a)
    with open(os.path.join(d, 'words.json')) as f:
        return json.load(f)['words']


def move_live_to_replay(project):
    """Moves a finished live stream's clips (and transcript) onto the stream's replay and marks
    the unposted ones to be made again. Returns how many will be made again."""
    pid = project['id']
    settings = dict(project.get('settings') or {})
    info = prepare.link_info(project['source_url'])
    if prepare.is_live(info):
        raise RuntimeError('the stream is live again (or still live)')
    duration = float(info.get('duration') or 0)
    if duration < 60:
        raise RuntimeError('the stream has no replay to cut from')
    url = info.get('webpage_url') or project['source_url']

    prepare.restore_transcript(pid)
    d = os.path.join(kt.WORK, pid)
    with open(os.path.join(d, 'words.json')) as f:
        saved = json.load(f)
    live_words = saved['words']
    if not live_words:
        raise RuntimeError('no transcript of the stream was saved')
    clips = kt.select('kt_clips', f'project_id=eq.{pid}&order=start_s')
    if not clips:
        return 0

    # First guesses at the shift: from when the stream started and when King Tonka started recording
    # (the recording runs a little behind), or from the end (if King Tonka recorded until the end).
    guesses = []
    started = info.get('release_timestamp') or info.get('timestamp')
    if started and settings.get('live_started_at'):
        guesses.append(float(settings['live_started_at']) - float(started))
    guesses.append(duration - max(float(w[1]) for w in live_words))
    # Match around the clip with the most talking.
    anchor = max(clips, key=lambda c: sum(1 for w in live_words if float(c['start_s']) <= float(w[0]) <= float(c['end_s'])))
    t = float(anchor['start_s'])
    near = [w for w in live_words if t - NEAR <= float(w[0]) <= t + NEAR]
    found = None
    with tempfile.TemporaryDirectory() as tmp:
        for guess in guesses:
            a = max(0.0, t + guess - SEARCH - NEAR)
            b = min(duration, t + guess + SEARCH + NEAR)
            if b - a < 30:
                continue
            heard = replay_words(url, a, b, saved.get('language') or settings.get('language'), tmp)
            shift, votes, other = find_shift(near, heard, guess)
            print(f'{pid}: guess {guess:.1f}s -> shift {shift}, {votes} words agree (next best {other})', flush=True)
            if shift is not None and votes >= MIN_VOTES and votes >= 3 * max(other, 1):
                found = shift
                break
    if found is None:
        raise RuntimeError('couldn’t line up the clips with the replay (too few matching words)')

    # The transcript, in replay time (for "find more clips" later).
    moved = [[round(float(s) + found, 2), round(float(e) + found, 2), w] for s, e, w in live_words
             if 0 <= float(s) + found <= duration]
    with open(os.path.join(d, 'words.json'), 'w') as f:
        json.dump({**saved, 'words': moved}, f)
    with open(os.path.join(d, 'transcript.txt')) as f:
        lines = [shift_line(line, found) for line in f.read().splitlines()]
    with open(os.path.join(d, 'transcript.txt'), 'w') as f:
        f.write('\n'.join(lines) + '\n')
    kt.upload(os.path.join(d, 'words.json'), f'projects/{pid}/words.json', 'application/json')
    kt.upload(os.path.join(d, 'transcript.txt'), f'projects/{pid}/transcript.txt', 'text/plain')

    again = 0
    for c in clips:
        s, e = float(c['start_s']) + found, float(c['end_s']) + found
        if s < 0 or e > duration:
            continue
        patch = {'start_s': round(s, 2), 'end_s': round(e, 2)}
        if c['status'] == 'ready' and c.get('media_path') and not c.get('posted_at'):
            patch['status'] = 'rerender'
            again += 1
        kt.update('kt_clips', c['id'], patch)
    settings.update(live=False, live_seen_at=None, live_shift=round(found, 2), sections=duration > prepare.LONG)
    kt.update('kt_projects', pid, {'settings': settings, 'source_url': url, 'duration_s': round(duration, 1)})
    return again


def main():
    os.makedirs(kt.WORK, exist_ok=True)
    total, problems = 0, []
    for p in kt.select('kt_projects', 'status=in.(done,failed)&order=created_at'):
        name = (p.get('title') or p.get('source_url') or p['id'])[:50]
        if (p.get('settings') or {}).get('live'):
            try:
                n = move_live_to_replay(p)
                total += n
                print(f'{p["id"]}: {n} live clips moved onto the replay', flush=True)
            except Exception as e:  # one stream must not stop the others; its clips stay as they are
                traceback.print_exc()
                problems.append(f'“{name}”: {e}')
            continue
        ids = [c['id'] for c in kt.select('kt_clips', f'project_id=eq.{p["id"]}&status=eq.ready&media_path=not.is.null'
                                                      '&posted_at=is.null&select=id')]
        for cid in ids:
            kt.update('kt_clips', cid, {'status': 'rerender'}, where='&status=eq.ready')
        total += len(ids)
    print(f'{total} clips to make again', flush=True)
    if total:
        kt.log(f'Making {total} clips again with the fixes (no frozen start, sound in sync). '
               'They stay watchable while they update. Clips you already posted are left as they are.')
    for msg in problems:
        kt.log(f'Live clips of {msg}. They stay as they were.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
