"""Builds the soundtrack and encodes the final MP4 from rendered frames.

Two soundtrack modes:

  Voiceover over music (the explainer style): each scene's voice clip starts at
  its `vo_at` time from timeline.json; the music dips under the voice.
    python finish.py --frames F --out ad.mp4 --timeline timeline.json --vo vo/ --music music.wav

  Music only (the showreel style): a track trimmed to the video's length with a
  short fade in and a gentle fade out.
    python finish.py --frames F --out ad.mp4 --track song.mp3 [--start 0]

Loudness is normalised in two passes to -14 LUFS (social video standard) with
a limiter, so peaks never clip.
"""
import argparse
import glob
import json
import os
import subprocess
import sys
import tempfile


def run(cmd):
    subprocess.run(cmd, check=True)


def loudnorm(src, dst):
    """Two-pass EBU R128 normalisation to -14 LUFS, true peak -1.5 dB."""
    probe = subprocess.run(
        ['ffmpeg', '-hide_banner', '-i', src, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'],
        capture_output=True, text=True, check=True,
    ).stderr
    m = json.loads(probe[probe.rindex('{'):probe.rindex('}') + 1])
    measured = (f"measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}:"
                f"measured_thresh={m['input_thresh']}:offset={m['target_offset']}")
    run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-af',
         f'loudnorm=I=-14:TP=-1.5:LRA=11:{measured}:linear=true,alimiter=limit=0.84:attack=5:release=50:level=false',
         '-ar', '48000', dst])


def voice_over_music(timeline_path, vo_dir, music, duration, out):
    scenes = [s for s in json.load(open(timeline_path)) if s.get('vo')]
    inputs = ['-i', music]
    parts = []
    for i, s in enumerate(scenes, start=1):
        inputs += ['-i', os.path.join(vo_dir, f"{s['id']}.wav")]
        ms = int(s['vo_at'] * 1000)
        parts.append(f'[{i}:a]aresample=44100,pan=stereo|c0=c0|c1=c0,adelay={ms}|{ms}[v{i}]')
    labels = ''.join(f'[v{i}]' for i in range(1, len(scenes) + 1))
    parts.append(f'{labels}amix=inputs={len(scenes)}:normalize=0,highpass=f=90,'
                 f'acompressor=threshold=0.12:ratio=3:attack=5:release=120:makeup=1.6,'
                 f'apad=whole_dur={duration},asplit=2[vo][sc]')
    parts.append('[0:a]volume=0.5[m]')
    parts.append('[m][sc]sidechaincompress=threshold=0.03:ratio=8:attack=25:release=450[md]')
    parts.append(f'[vo][md]amix=inputs=2:normalize=0,atrim=0:{duration}[out]')
    run(['ffmpeg', '-v', 'error', '-y', *inputs, '-filter_complex', ';'.join(parts), '-map', '[out]', '-ar', '48000', out])


def music_only(track, start, duration, out):
    fade = min(2.2, duration / 4)
    run(['ffmpeg', '-v', 'error', '-y', '-ss', str(start), '-i', track, '-t', str(duration), '-af',
         f'afade=t=in:d=0.15,afade=t=out:st={duration - fade:.2f}:d={fade:.2f}', '-ar', '48000', out])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--frames', required=True, help='folder of f00000.jpg frames from render.cjs')
    ap.add_argument('--fps', type=int, default=30)
    ap.add_argument('--out', required=True)
    ap.add_argument('--timeline'); ap.add_argument('--vo'); ap.add_argument('--music')
    ap.add_argument('--track'); ap.add_argument('--start', type=float, default=0)
    a = ap.parse_args()

    n = len(glob.glob(os.path.join(a.frames, 'f*.jpg')))
    if not n:
        sys.exit(f'No frames in {a.frames}')
    duration = n / a.fps
    with tempfile.TemporaryDirectory() as tmp:
        raw, final = os.path.join(tmp, 'raw.wav'), os.path.join(tmp, 'final.wav')
        if a.timeline and a.vo and a.music:
            voice_over_music(a.timeline, a.vo, a.music, duration, raw)
        elif a.track:
            music_only(a.track, a.start, duration, raw)
        else:
            sys.exit('Give --timeline/--vo/--music, or --track.')
        loudnorm(raw, final)
        run(['ffmpeg', '-v', 'error', '-y', '-framerate', str(a.fps), '-i', os.path.join(a.frames, 'f%05d.jpg'), '-i', final,
             '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-profile:v', 'high',
             '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', a.out])
    stats = subprocess.run(['ffmpeg', '-i', a.out, '-af', 'ebur128=peak=true:framelog=quiet', '-f', 'null', '-'],
                           capture_output=True, text=True).stderr
    summary = [l.strip() for l in stats.splitlines() if l.strip().startswith(('I:', 'Peak:'))]
    print(f'{a.out}: {duration:.2f} s, ' + ', '.join(summary[:2]))


if __name__ == '__main__':
    main()
