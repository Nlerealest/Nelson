"""Adds how loud the music is on each beat (0..1) to beats.js, so the edit hits
harder where the song does. Usage: beat_energy.py MUSIC_WAV BEATS_JS"""
import json
import sys

import numpy as np
import soundfile as sf

audio, sr = sf.read(sys.argv[1], always_2d=True)
mono = audio.mean(axis=1)
src = open(sys.argv[2]).read()
beats = json.loads(src[src.index('['):src.index(']') + 1])
edges = beats + [len(mono) / sr]
rms = [float(np.sqrt(np.mean(mono[int(a * sr):max(int(a * sr) + 1, int(b * sr))] ** 2))) for a, b in zip(edges[:-1], edges[1:])]
lo, hi = np.percentile(rms, 10), np.percentile(rms, 95)
energy = [round(float(np.clip((r - lo) / (hi - lo + 1e-9), 0, 1)) * 0.75 + 0.25, 3) for r in rms]
open(sys.argv[2], 'w').write(f'window.BEATS={json.dumps(beats)};\nwindow.ENERGY={json.dumps(energy)};\n')
print(f'energy for {len(energy)} beats, mean {np.mean(energy):.2f}')
