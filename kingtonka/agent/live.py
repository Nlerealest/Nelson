#!/usr/bin/env python3
"""King Tonka live: clips a stream while it's still live. The "King Tonka live" workflow
runs this for one video (project) at a time:

  python live.py <project-id>

It records the stream in parts (yt-dlp → ffmpeg, in the background). Each time a part is
finished, it transcribes it, asks Claude for the best moments in it (Claude Code, headless,
with the last 90 seconds of the part before as context, so moments across the join aren't
lost), renders those clips and sends them to the app, while the recording carries on.
It ends when the stream ends or the owner taps Stop. Before GitHub's 6-hour limit it starts
a new run that carries on from where this one stopped.
"""
import glob
import json
import os
import re
import signal
import subprocess
import sys
import time
import traceback

import kt
import prepare
import render

PART = int(os.environ.get('KT_LIVE_PART', 15 * 60))                     # seconds of stream per part
CONTEXT = 90                                                            # seconds of the part before that Claude also sees
MAX_RUN = float(os.environ.get('KT_LIVE_MAX_RUN', 5 * 3600 + 15 * 60))  # hand over before GitHub's 6-hour limit
WAIT_START = float(os.environ.get('KT_LIVE_WAIT', 3 * 3600))            # how long to wait for an announced stream
REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..'))
BRANCH = os.environ.get('KT_REF', 'claude/malawi-money-management-knal4c')
LINE_TIME = re.compile(r'^\[((?:\d+:)?\d+:\d+(?:\.\d+)?) →')


class Stop(Exception):
    """The owner stopped live clipping (Stop, Cancel, or deleted the video)."""


def seconds(stamp):
    """'1:02:03.4' or '2:03.4' → seconds."""
    total = 0.0
    for piece in stamp.split(':'):
        total = total * 60 + float(piece)
    return total


def default_ask_claude(prompt):
    """Claude Code, headless, with the owner's Claude plan (CLAUDE_CODE_OAUTH_TOKEN)."""
    r = subprocess.run(['claude', '-p', prompt, '--allowedTools', 'Bash,Read,Write,Edit,Glob,Grep', '--max-turns', '40'],
                       cwd=REPO, capture_output=True, text=True, timeout=25 * 60)
    print(r.stdout[-3000:])
    if r.returncode:
        print('Claude stopped with an error:', r.stderr[-2000:], file=sys.stderr)


class Live:
    def __init__(self, pid, ask_claude=default_ask_claude, record_cmd=None):
        self.pid = pid
        self.ask_claude = ask_claude
        self.record_cmd = record_cmd  # tests pass a stand-in for yt-dlp
        self.project = kt.get('kt_projects', pid)
        if not self.project:
            raise Stop()
        self.settings = dict(self.project.get('settings') or {})
        self.d = os.path.join(kt.WORK, pid)
        os.makedirs(self.d, exist_ok=True)
        self.t0 = time.time()
        # Stream time is counted from the moment King Tonka first started recording this stream;
        # a run that carries on (after the 6-hour hand-over) continues that clock.
        self.started_at = self.settings.get('live_started_at') or self.t0
        self.base = self.t0 - self.started_at
        self.words, self.lines = [], []  # everything heard so far (stream time)
        self.parts = []                  # finished parts: (file, start, duration)
        self.ytdlp = self.ff = None
        self.last_check = self.last_beat = 0.0

    # ---------- the owner's side ----------
    def check(self):
        """Raises Stop if the owner stopped live clipping. Asks at most every 10 seconds."""
        if time.time() - self.last_check < 10:
            return
        self.last_check = time.time()
        try:
            p = kt.get('kt_projects', self.pid)
        except Exception:
            return  # a network hiccup is not a stop
        if not p or p['status'] != 'live':
            raise Stop()

    def beat(self, step=None):
        """Shows the app what's happening, and that this run is alive (live_seen_at)."""
        self.check()
        if not step and time.time() - self.last_beat < 60:
            return
        self.last_beat = time.time()
        self.settings.update(live_seen_at=time.time(), live_started_at=self.started_at)
        patch = {'settings': self.settings, **({'step': step} if step else {})}
        try:
            kt.update('kt_projects', self.pid, patch, where='&status=eq.live')
        except Exception:
            traceback.print_exc()

    # ---------- recording ----------
    def wait_until_live(self):
        """Returns the stream's info once it's live, or None if it has already ended."""
        while True:
            info = prepare.link_info(self.project['source_url'])
            if info.get('is_live') or info.get('live_status') == 'is_live':
                return info
            if info.get('live_status') != 'is_upcoming':
                return None
            if time.time() - self.t0 > WAIT_START:
                raise RuntimeError(f'The stream didn’t start within {int(WAIT_START // 3600)} hours.')
            self.beat('Waiting for the stream to start…')
            for _ in range(12):  # look again in 2 minutes
                time.sleep(10)
                self.beat()

    def record(self):
        log = open(os.path.join(self.d, 'record.log'), 'a')
        cmd = self.record_cmd or prepare.ytdlp_base() + ['-f', 'b[height<=1440]/b', '-S', 'res:1440,fps', '-o', '-', self.project['source_url']]
        self.ytdlp = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=log, start_new_session=True)
        self.ff = subprocess.Popen(['ffmpeg', '-v', 'error', '-i', 'pipe:0', '-map', '0:v:0?', '-map', '0:a:0?', '-c', 'copy',
                                    '-f', 'segment', '-segment_time', str(PART), '-reset_timestamps', '1', '-segment_format', 'mpegts',
                                    os.path.join(self.d, 'part-%03d.ts')], stdin=self.ytdlp.stdout, stderr=log, start_new_session=True)
        self.ytdlp.stdout.close()

    def recording(self):
        return self.ff is not None and self.ff.poll() is None

    def stop_recording(self):
        """Stops yt-dlp; ffmpeg then finishes the last part properly."""
        if self.ytdlp and self.ytdlp.poll() is None:
            try:
                os.killpg(self.ytdlp.pid, signal.SIGINT)
                self.ytdlp.wait(30)
            except (ProcessLookupError, subprocess.TimeoutExpired):
                try:
                    os.killpg(self.ytdlp.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
        if self.ff:
            try:
                self.ff.wait(60)
            except subprocess.TimeoutExpired:
                os.killpg(self.ff.pid, signal.SIGKILL)

    # ---------- each finished part ----------
    def process(self, f):
        k = len(self.parts)
        start = self.base + sum(p[2] for p in self.parts)
        dur = prepare.probe_duration(f)
        part_dir = os.path.join(self.d, f'p{k:03d}')
        os.makedirs(part_dir, exist_ok=True)
        self.beat(f'🔴 Live: listening to part {k + 1}…')
        try:
            prepare.transcribe(f, part_dir, self.settings.get('language'), dur, check=self.check, shift=start)
            with open(os.path.join(part_dir, 'words.json')) as fh:
                new_words = json.load(fh)['words']
            with open(os.path.join(part_dir, 'transcript.txt')) as fh:
                new_lines = [line for line in fh.read().splitlines() if line.strip()]
        except (OSError, RuntimeError, ValueError):
            traceback.print_exc()  # e.g. a part with no sound
            new_words, new_lines = [], []
        self.words += new_words
        self.lines += new_lines
        self.parts.append((f, start, dur))
        self.save_transcript()
        if len(new_words) >= 15:  # someone actually talked in this part
            self.pick_and_render(k, start, dur)
        for old, _, _ in self.parts[:-1]:  # keep only the newest part (for moments across the next join)
            if os.path.exists(old):
                os.remove(old)

    def save_transcript(self):
        """Everything so far, in kt-work and in storage (a run that carries on loads it back)."""
        with open(os.path.join(self.d, 'words.json'), 'w') as fh:
            json.dump({'language': self.settings.get('language'), 'words': self.words}, fh)
        with open(os.path.join(self.d, 'transcript.txt'), 'w') as fh:
            fh.write('\n'.join(self.lines) + '\n')
        try:
            kt.upload(os.path.join(self.d, 'words.json'), f'projects/{self.pid}/words.json', 'application/json')
            kt.upload(os.path.join(self.d, 'transcript.txt'), f'projects/{self.pid}/transcript.txt', 'text/plain')
        except Exception:
            traceback.print_exc()

    def load_transcript(self):
        if not self.settings.get('live_started_at'):
            return  # the first run: nothing yet
        try:
            prepare.restore_transcript(self.pid)
            with open(os.path.join(self.d, 'words.json')) as fh:
                self.words = json.load(fh)['words']
            with open(os.path.join(self.d, 'transcript.txt')) as fh:
                self.lines = [line for line in fh.read().splitlines() if line.strip()]
        except Exception:
            traceback.print_exc()

    def window(self, k):
        """The video to cut this part's clips from: the part before (if kept) and this one, joined
        into an MP4. Clips are never cut straight from the .ts recording: jumping into a .ts file
        lands between keyframes, so a clip's first seconds had a frozen picture while the sound played."""
        f, start, _ = self.parts[k]
        files = [f]
        if k > 0 and os.path.exists(self.parts[k - 1][0]):
            files, start = [self.parts[k - 1][0], f], self.parts[k - 1][1]
        joined = os.path.join(self.d, f'window-{k:03d}.mp4')
        listing = os.path.join(self.d, f'window-{k:03d}.txt')
        with open(listing, 'w') as fh:
            fh.write(''.join(f"file '{x}'\n" for x in files))
        prepare.run(['ffmpeg', '-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', listing,
                     '-map', '0:v:0?', '-map', '0:a:0?', '-c', 'copy', joined])
        os.remove(listing)
        return joined, start

    def pick_and_render(self, k, start, dur):
        end = start + dur
        since = max(self.parts[0][1], start - CONTEXT)
        lines = [line for line in self.lines if (m := LINE_TIME.match(line)) and seconds(m.group(1)) >= since - 1]
        path = os.path.join(self.d, f'live-part-{k + 1:03d}.txt')
        with open(path, 'w') as fh:
            fh.write('\n'.join(lines) + '\n')
        made = kt.select('kt_clips', f'project_id=eq.{self.pid}&select=start_s,end_s,title&order=start_s')
        plan = os.path.join(self.d, f'plan-live-{k + 1:03d}.json')
        most = self.settings.get('clips') if isinstance(self.settings.get('clips'), int) else 3
        self.beat(f'🔴 Live: Claude is picking moments from part {k + 1}…')
        self.ask_claude(
            f'You are King Tonka, clipping a LIVE stream right now, in a GitHub Action.\n'
            f'Read kingtonka/agent/KING_TONKA.md, section 1 (finding clips) and section "Live streams".\n'
            f'Video {self.pid}: “{self.project.get("title") or "live stream"}”. Its settings: {json.dumps(self.settings)}\n'
            f'The newest part of the stream is transcribed in {path}. Times are seconds of the stream '
            f'({prepare.fmt(since)} to {prepare.fmt(end)}); lines before {prepare.fmt(start)} are only context from the part before.\n'
            f'Clips already made from this stream (don\'t repeat them): {json.dumps(made)}\n'
            f'Pick at most {most} moments, only strong ones, that start at or after {prepare.fmt(since)} and end after '
            f'{prepare.fmt(start)} and before {prepare.fmt(end)}. Write the plan to {plan} and run:\n'
            f'python kingtonka/agent/kt.py add-clips {self.pid} {plan}\n'
            f'If nothing in this part is strong enough, add no clips. Don\'t render anything and don\'t mark any commands.')
        planned = kt.select('kt_clips', f'project_id=eq.{self.pid}&status=eq.planned&order=score.desc')
        if not planned:
            return
        src, offset = self.window(k)
        done = 0
        for c in planned:
            self.check()
            if float(c['start_s']) < offset - 0.5 or float(c['end_s']) > end + 0.5:
                kt.update('kt_clips', c['id'], {'status': 'failed', 'error': 'That moment wasn’t in the recorded part.'})
                continue
            self.beat(f'🔴 Live: making clip {done + 1} of {len(planned)} from part {k + 1}…')
            kt.update('kt_clips', c['id'], {'status': 'rendering'})
            try:
                render.render_and_upload({**self.project, 'status': 'live', 'settings': self.settings}, c, src, offset, self.words, self.d)
                done += 1
            except Exception as e:
                traceback.print_exc()
                kt.update('kt_clips', c['id'], {'status': 'failed', 'error': str(e)[:400]})
        if os.path.exists(src):
            os.remove(src)
        if done:
            kt.log(f'🔴 {done} new clip{"s" if done != 1 else ""} from the live stream “{(self.project.get("title") or "")[:50]}”.')
        total = len(kt.select('kt_clips', f'project_id=eq.{self.pid}&status=eq.ready&select=id'))
        self.beat(f'🔴 Live: {total} clip{"s" if total != 1 else ""} so far · watching for more')

    # ---------- the end ----------
    def close_commands(self, result):
        for c in kt.select('kt_commands', f'project_id=eq.{self.pid}&status=in.(queued,working)'):
            kt.update('kt_commands', c['id'], {'status': 'done', 'result': result})

    def finish(self):
        total = len(kt.select('kt_clips', f'project_id=eq.{self.pid}&status=eq.ready&select=id'))
        kt.project_step(self.pid, 'done', f'Stream ended · {total} clip{"s" if total != 1 else ""}', 100)
        self.close_commands(f'Stream ended: {total} clips.')
        kt.log(f'The live stream “{(self.project.get("title") or "")[:50]}” ended. {total} clips in all.')

    def ended_before_start(self):
        """The stream had already ended: clip its saved video the normal way instead."""
        self.settings.update(live=False, live_seen_at=None)
        kt.project_step(self.pid, 'queued', 'The stream has ended: clipping the saved video…', 0, settings=self.settings)
        kt.insert('kt_commands', {'kind': 'process', 'project_id': self.pid, 'text': 'Clip the saved stream (it had ended).'})

    def hand_over(self):
        """GitHub stops runs after 6 hours: start a new run that carries on."""
        self.beat('🔴 Live: still watching (switching to a fresh run)…')
        r = subprocess.run(['gh', 'workflow', 'run', 'kingtonka-live.yml', '-f', f'project={self.pid}', '--ref', BRANCH],
                           cwd=REPO, capture_output=True, text=True)
        if r.returncode:
            print(r.stderr, file=sys.stderr)
            kt.log('King Tonka couldn’t start a new run to keep clipping the stream. The daily check will try again.')

    def still_live(self):
        try:
            info = prepare.link_info(self.project['source_url'])
            return bool(info.get('is_live') or info.get('live_status') == 'is_live')
        except Exception:
            return False

    def run(self):
        try:
            info = self.wait_until_live()
            if info is None:
                return self.ended_before_start()
            self.load_transcript()
            self.record()
            self.beat(f'🔴 Live: watching. The first clips come in about {PART // 60 + 5} minutes.')
            done, handover = set(), False  # parts already clipped, by name (their files get deleted later)
            while True:
                files = sorted(glob.glob(os.path.join(self.d, 'part-*.ts')))
                live_now = self.recording()
                finished = files if not live_now else files[:-1]  # the newest part is still being written
                for f in finished:
                    if f not in done:
                        self.process(f)  # the recording carries on meanwhile
                        done.add(f)
                if not live_now and all(f in done for f in glob.glob(os.path.join(self.d, 'part-*.ts'))):
                    break
                if not handover and time.time() - self.t0 > MAX_RUN:
                    handover = True
                    self.stop_recording()  # its last part is finished and clipped on the next loop
                self.beat()
                time.sleep(10)
            if handover and self.still_live():
                self.hand_over()
            else:
                self.finish()
        except Stop:
            self.stop_recording()
            self.close_commands('Stopped by you.')
            print('Stopped by the owner.')
        except Exception as e:
            traceback.print_exc()
            self.stop_recording()
            kt.update('kt_projects', self.pid, {'status': 'failed', 'step': 'Failed', 'error': f'Live clipping stopped: {e}'[:500]},
                      where='&status=eq.live')
            self.close_commands(f'Live clipping stopped: {e}'[:300])


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    try:
        Live(sys.argv[1]).run()
    except Stop:
        print('That video was deleted or stopped.')
