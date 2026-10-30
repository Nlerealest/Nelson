"""Composes an original, royalty-free beat for a vertical short and writes the
beat times the video snaps to.

Usage: music_short.py OUT_WAV OUT_BEATS_JS --bpm 104 --seconds 24 [--drop 6.9] [--mood warm|bright|tense]
Before the drop: pads and sparse plucks. From the drop: kick, clap, hats and
an arpeggio. A riser leads into the drop; the last chord rings out.
"""
import argparse
import json

import numpy as np
import soundfile as sf

ap = argparse.ArgumentParser()
ap.add_argument('out'); ap.add_argument('beats_js')
ap.add_argument('--bpm', type=float, default=104); ap.add_argument('--seconds', type=float, required=True)
ap.add_argument('--drop', type=float, default=None); ap.add_argument('--mood', default='warm')
ap.add_argument('--seed', type=int, default=11)
a = ap.parse_args()

SR = 44100
total = a.seconds
N = int((total + 2) * SR)
rng = np.random.default_rng(a.seed)
mix = np.zeros((N, 2))
BEAT = 60 / a.bpm
BAR = BEAT * 4
drop = a.drop if a.drop is not None else BAR * 2

MOODS = {
    # F(add9) - Am7 - Dm7 - Bbmaj7
    'warm': [[53, 60, 65, 67, 69], [57, 60, 64, 67, 72], [50, 57, 60, 65, 69], [46, 53, 57, 62, 65]],
    # C - G/B - Am7 - Fmaj7
    'bright': [[48, 55, 60, 64, 67], [47, 55, 59, 62, 67], [45, 52, 57, 60, 64], [41, 53, 57, 60, 64]],
    # Am - F - C - G
    'tense': [[45, 52, 57, 60, 64], [41, 53, 57, 60, 65], [48, 55, 60, 64, 67], [43, 55, 59, 62, 67]],
}
CHORDS = MOODS[a.mood]


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N or i < 0:
        return
    sig = sig[: N - i]
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i:i + len(sig), 0] += sig * gain * l
    mix[i:i + len(sig), 1] += sig * gain * r


def env(n, at, rel):
    e = np.ones(n)
    A, R = int(at * SR), int(rel * SR)
    if A: e[:A] = np.linspace(0, 1, A)
    if R: e[-R:] *= np.linspace(1, 0, R)
    return e


def pad(chord, dur, bright):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for m in chord:
        for det in (-0.002, 0.0, 0.0022):
            f = hz(m) * (1 + det)
            s += np.sin(2 * np.pi * f * t) + bright * 0.22 * np.sin(4 * np.pi * f * t)
    return s * env(n, 0.5, 0.8) / (len(chord) * 3)


def pluck(m, dur=0.6):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.1 * np.sin(6 * np.pi * f * t)
    return s * np.exp(-t * 6.5) * env(n, 0.003, 0.04)


def kick():
    n = int(0.4 * SR); t = np.arange(n) / SR
    f = 46 + 90 * np.exp(-t * 30)
    return np.tanh(1.6 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 7.5))


def noise(dur, decay):
    n = int(dur * SR); x = rng.standard_normal(n)
    return x * np.exp(-np.arange(n) / SR * decay)


def hat():
    x = noise(0.06, 70); return np.diff(x, prepend=0) * 0.5


def clap():
    x = noise(0.22, 22); x = np.diff(x, prepend=0)
    for d in (0.008, 0.017):
        k = int(d * SR); x[k:] += x[:-k] * 0.6
    return x * 0.5


def bass(m, dur):
    n = int(dur * SR); t = np.arange(n) / SR; f = hz(m)
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(4 * np.pi * f * t)) * env(n, 0.01, 0.12) * np.exp(-t * 1.5)


def riser(dur):
    n = int(dur * SR); x = rng.standard_normal(n); x = np.diff(x, prepend=0)
    return x * np.linspace(0, 1, n) ** 2.5


beats = []
b = 0.0
while b < total - 0.05:
    beats.append(round(b, 3)); b += BEAT

t = 0.0; i = 0
while t < total + BAR:
    after = t >= drop - 1e-6
    add(pad(CHORDS[i % 4], BAR * 1.1, 1.0 if after else 0.0), t, 0.2 if after else 0.16, -0.1)
    t += BAR; i += 1

pattern = [0, 2, 4, 3, 1, 3, 4, 2]
for k in range(int(total / (BEAT / 2))):
    t = k * BEAT / 2
    if t > total - 1.2:
        break
    chord = CHORDS[int(t // BAR) % 4]
    after = t >= drop - 1e-6
    beat_in_bar = int(round(t / BEAT)) % 4 if k % 2 == 0 else None
    if not after:
        if k % 4 == 0:
            add(pluck(chord[(k // 4) % len(chord)] + 12, 1.0), t, 0.07, 0.3)
        continue
    add(pluck(chord[pattern[k % 8] % len(chord)] + 12), t, 0.075, 0.35 if k % 2 else -0.25)
    if k % 2 == 1:
        add(hat(), t, 0.16, 0.4)
    if beat_in_bar is not None:
        if beat_in_bar in (0, 2) or (beat_in_bar == 3 and int(t // BAR) % 2 == 1 and k % 2 == 0 and False):
            add(kick(), t, 0.42)
        if beat_in_bar == 0:
            add(bass(chord[0] - 12, BEAT * 1.7), t, 0.22)
        if beat_in_bar == 2:
            add(bass(chord[0] - 12, BEAT * 1.2), t, 0.18)
        if beat_in_bar in (1, 3):
            add(clap(), t, 0.22, 0.05)

if drop > 1.2:
    add(riser(min(1.6, drop)), drop - min(1.6, drop), 0.05)
end_bar = (int(total / BAR) - 1) * BAR if total > BAR * 2 else total - 2
add(pad(CHORDS[0], 3.0, 1.0), max(0, total - 2.6), 0.18)
for j, m in enumerate(CHORDS[0][1:]):
    add(pluck(m + 12, 2.2), max(0, total - 2.5) + j * 0.1, 0.06)

mix = mix[: int(total * SR)]
f = int(min(1.6, total / 6) * SR)
mix[-f:] *= np.linspace(1, 0, f)[:, None]
mix /= np.max(np.abs(mix)) * 1.12
sf.write(a.out, mix.astype(np.float32), SR)
open(a.beats_js, 'w').write('window.BEATS=' + json.dumps(beats) + ';\n')
print(f'music {total:.2f}s at {a.bpm} bpm, drop {drop:.2f}s, {len(beats)} beats')
