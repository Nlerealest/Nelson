"""Composes an original, royalty-free background track for the advert.

Quiet and tense for the problem (scenes before "meet"), then warm and
bright once Ndalama appears. Whooshes mark scene changes.
Usage: music.py TIMELINE_JSON OUT_WAV
"""
import json
import sys

import numpy as np
import soundfile as sf

SR = 44100
timeline = json.load(open(sys.argv[1]))
total = timeline[-1]['start'] + timeline[-1]['dur']
meet = next(s['start'] for s in timeline if s['id'] == 'meet')
N = int(total * SR) + SR
rng = np.random.default_rng(7)
mix = np.zeros((N, 2))

BEAT = 60 / 96
BAR = BEAT * 4


def hz(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


def add(sig, start, gain=1.0, pan=0.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    left, right = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    mix[i:i + len(sig), 0] += sig * gain * left
    mix[i:i + len(sig), 1] += sig * gain * right


def env(n, attack, release):
    e = np.ones(n)
    a, r = int(attack * SR), int(release * SR)
    if a:
        e[:a] = np.linspace(0, 1, a)
    if r:
        e[-r:] *= np.linspace(1, 0, r)
    return e


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):  # one-pole filter
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


# F(add9) - Am7 - Dm7 - Bbmaj7: hopeful, a little wistful.
CHORDS = [[53, 60, 65, 67, 69], [57, 60, 64, 67, 72], [50, 57, 60, 65, 69], [46, 53, 57, 62, 65]]


def pad(chord, dur, bright):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for m in chord:
        for det in (-0.0018, 0.0, 0.0021):
            f = hz(m) * (1 + det)
            s += np.sin(2 * np.pi * f * t) + bright * 0.25 * np.sin(4 * np.pi * f * t)
    s *= env(n, 0.9, 1.1) / (len(chord) * 3)
    return s * (0.85 + 0.15 * np.sin(2 * np.pi * 0.25 * t))


def pluck(midi, dur=0.9):
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = hz(midi)
    s = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(4 * np.pi * f * t) + 0.12 * np.sin(6 * np.pi * f * t))
    return s * np.exp(-t * 5.5) * env(n, 0.004, 0.05)


def kick():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 48 + 70 * np.exp(-t * 28)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)


def noise_swell(dur, rise=True):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    x = x - lowpass(x, 900)  # keep the airy part
    shape = np.linspace(0, 1, n) ** 2 if rise else np.exp(-np.linspace(0, 6, n))
    return x * shape * env(n, 0.01, 0.08)


# Pads all the way through: darker before "meet", brighter after.
t0 = 0.0
bar_i = 0
while t0 < total + BAR:
    bright = 0.0 if t0 < meet else 1.0
    gain = 0.16 if t0 < meet else 0.22
    add(pad(CHORDS[bar_i % 4], BAR * 1.15, bright), t0, gain, pan=-0.15)
    t0 += BAR
    bar_i += 1

# Sparse quarter-note plucks during the problem, eighth-note arpeggios after.
beat_i = 0
t0 = 0.0
pattern = [0, 2, 4, 3, 1, 3, 4, 2]
while t0 < total - 2.5:
    chord = CHORDS[int(t0 // BAR) % 4]
    if t0 < meet:
        if beat_i % 2 == 0:
            add(pluck(chord[beat_i // 2 % len(chord)] + 12, 1.2), t0, 0.07, pan=0.3)
        t0 += BEAT
        beat_i += 1
        continue
    step = int(round((t0 - meet) / (BEAT / 2)))
    note = chord[pattern[step % 8] % len(chord)] + 12
    add(pluck(note), t0, 0.085, pan=0.35 if step % 2 else -0.25)
    if step % 8 in (0, 4):
        add(kick(), t0, 0.22)
        add(pad([chord[0] - 12], BEAT * 1.8, 0.0) * 1.4, t0, 0.18)
    t0 += BEAT / 2

# Riser into the reveal, then a soft bloom.
add(noise_swell(1.1, rise=True), meet - 1.0, 0.05)
add(noise_swell(1.6, rise=False), meet + 0.1, 0.05)
for m in (77, 81, 84):
    add(pluck(m, 2.0), meet + 0.5, 0.06, pan=0.1)

# Whooshes on scene changes.
for s in timeline[1:]:
    if s['id'] != 'meet':
        add(noise_swell(0.45, rise=False), s['start'] - 0.05, 0.022, pan=rng.uniform(-0.5, 0.5))

# Final chord rings out.
end = timeline[-1]['start']
add(pad(CHORDS[0], 4.5, 1.0), end, 0.2)
for i, m in enumerate((65, 69, 72, 77)):
    add(pluck(m, 2.5), end + 0.15 + i * 0.12, 0.07)

mix = mix[: int(total * SR)]
fade = int(2.0 * SR)
mix[-fade:] *= np.linspace(1, 0, fade)[:, None]
mix /= np.max(np.abs(mix)) * 1.12
sf.write(sys.argv[2], mix.astype(np.float32), SR)
print('music', round(len(mix) / SR, 2), 's, reveal at', meet)
