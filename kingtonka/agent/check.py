"""Checks the newest finished clips for playback problems: a picture that stands
still while the sound plays, late or missing keyframes, heavy settings a phone can't
decode smoothly. Prints a report (for the GitHub Actions log); changes nothing.

    python kingtonka/agent/check.py [how many clips, default 8]
"""
import json
import os
import re
import subprocess
import sys
import tempfile
from urllib.parse import urlparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kt  # noqa: E402


def sh(cmd):
    return subprocess.run(cmd, capture_output=True, text=True)


def streams(path):
    out = sh(['ffprobe', '-v', 'error', '-show_entries',
              'stream=codec_type,codec_name,profile,level,width,height,r_frame_rate,avg_frame_rate,start_time,duration,bit_rate,nb_frames,has_b_frames'
              ':format=duration,bit_rate,size', '-of', 'json', path]).stdout
    return json.loads(out or '{}')


def first_packets(path, kind, n):
    out = sh(['ffprobe', '-v', 'error', '-select_streams', kind, '-read_intervals', '%+#' + str(n),
              '-show_entries', 'packet=pts_time,dts_time,flags', '-of', 'csv=p=0', path]).stdout
    return [line.split(',') for line in out.split() if line]


def keyframes(path, secs=12):
    out = sh(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-read_intervals', f'%+{secs}',
              '-show_entries', 'packet=pts_time,flags', '-of', 'csv=p=0', path]).stdout
    return [float(p) for p, f in (line.split(',')[:2] for line in out.split() if line) if 'K' in f and p != 'N/A']


def freezes(path, secs=8):
    err = sh(['ffmpeg', '-hide_banner', '-nostats', '-t', str(secs), '-i', path, '-map', '0:v:0',
              '-vf', 'freezedetect=n=0.002:d=0.25', '-f', 'null', '-']).stderr
    found = []  # [start, how long]
    for kind, val in re.findall(r'freeze_(start|duration): ([\d.]+)', err):
        if kind == 'start':
            found.append([round(float(val), 2), f'past {secs}s'])
        elif found:
            found[-1][1] = round(float(val), 2)
    return [tuple(f) for f in found]


def repeats(path, secs=3):
    """Frames that are exact copies of the one before, in the first seconds."""
    out = sh(['ffmpeg', '-v', 'error', '-t', str(secs), '-i', path, '-map', '0:v:0', '-f', 'framemd5', '-']).stdout
    hashes = [line.rsplit(',', 1)[-1].strip() for line in out.splitlines() if line and not line.startswith('#')]
    same, run, longest = 0, 0, 0
    for a, b in zip(hashes, hashes[1:]):
        if a == b:
            same, run = same + 1, run + 1
            longest = max(longest, run)
        else:
            run = 0
    return same, longest, len(hashes)


def box_order(path):
    """Top-level MP4 boxes: moov before mdat means the phone can start playing at once."""
    order = []
    with open(path, 'rb') as f:
        while len(order) < 8:
            head = f.read(8)
            if len(head) < 8:
                break
            size, name = int.from_bytes(head[:4], 'big'), head[4:].decode('latin1')
            if size == 1:
                size = int.from_bytes(f.read(8), 'big') - 8
            order.append(name)
            if size < 8:
                break
            f.seek(size - 8, 1)
    return ' '.join(order)


def report(label, path):
    info = streams(path)
    fmt = info.get('format', {})
    lines = [f'  {label}: {int(fmt.get("size", 0)) / 1e6:.1f} MB, {float(fmt.get("duration", 0)):.2f}s, '
             f'{int(fmt.get("bit_rate", 0) or 0) // 1000} kbps, boxes: {box_order(path)}']
    for s in info.get('streams', []):
        if s.get('codec_type') == 'video':
            lines.append(f'    video {s.get("codec_name")} {s.get("profile")} L{s.get("level")} {s.get("width")}x{s.get("height")} '
                         f'r={s.get("r_frame_rate")} avg={s.get("avg_frame_rate")} start={s.get("start_time")} '
                         f'dur={s.get("duration")} frames={s.get("nb_frames")} bframes={s.get("has_b_frames")}')
        elif s.get('codec_type') == 'audio':
            lines.append(f'    audio {s.get("codec_name")} start={s.get("start_time")} dur={s.get("duration")}')
    v = first_packets(path, 'v:0', 4)
    a = first_packets(path, 'a:0', 2)
    lines.append(f'    first video packets {v}  first audio packets {a}')
    k = keyframes(path)
    lines.append(f'    keyframes in first 12s: {[round(x, 2) for x in k]}')
    same, longest, n = repeats(path)
    lines.append(f'    repeated frames in first 3s: {same} of {n} (longest run {longest})')
    lines.append(f'    still picture (freezedetect, first 8s): {freezes(path) or "none"}')
    print('\n'.join(lines), flush=True)


def main(argv):
    n = int(argv[0]) if argv else 8
    clips = kt.select('kt_clips', f'status=eq.ready&media_path=not.is.null&order=updated_at.desc&limit={n}'
                                  '&select=id,project_id,start_s,end_s,media_path,style,created_at,updated_at,posted_at')
    projects = {}
    with tempfile.TemporaryDirectory() as tmp:
        for c in clips:
            p = projects.get(c['project_id'])
            if p is None:
                p = projects[c['project_id']] = kt.get('kt_projects', c['project_id']) or {}
            s = p.get('settings') or {}
            host = urlparse(p.get('source_url') or '').netloc or ('upload' if p.get('source_path') else '?')
            print(f'\nclip {c["id"]} (project {c["project_id"]}, {host}, file {os.path.basename(c["media_path"])}, '
                  f'{"posted" if c.get("posted_at") else "not posted"}) '
                  f'{float(c["end_s"]) - float(c["start_s"]):.1f}s at {float(c["start_s"]):.1f}s; '
                  f'long-video parts: {bool(s.get("sections"))}, live: {bool(s.get("live"))}, gaming: {s.get("gaming")}, '
                  f'framing: {(c.get("style") or {}).get("framing", "auto")}', flush=True)
            full = os.path.join(tmp, c['id'] + '.mp4')
            try:
                kt.download(c['media_path'], full)
            except Exception as e:  # noqa: BLE001
                print(f'  could not download: {e}')
                continue
            report('clip', full)
            prev = c['media_path'][:-4] + '.preview.mp4'
            if kt.exists(prev):
                pp = os.path.join(tmp, c['id'] + '.preview.mp4')
                kt.download(prev, pp)
                report('app copy', pp)
                os.remove(pp)
            else:
                print('  app copy: none (the app plays the full clip)')
            os.remove(full)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
