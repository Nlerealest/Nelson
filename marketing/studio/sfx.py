"""Sound design for the edit: a whoosh into every moving transition, an impact
on hard cuts (flash, glitch) and on the drop, and a riser leading into the drop.
Usage: sfx.py SCENES_JSON TOTAL_SECONDS OUT_WAV"""
import json
import sys

import numpy as np
import soundfile as sf

SR = 44100
scenes = json.load(open(sys.argv[1]))
total = float(sys.argv[2])
out = np.zeros((int((total + 1) * SR), 2))
rng = np.random.default_rng(3)


def lowpass(x, cutoff):
    a = np.exp(-2 * np.pi * cutoff / SR)
    y = np.empty_like(x)
    acc = 0.0
    for i, v in enumerate(x):
        acc = (1 - a) * v + a * acc
        y[i] = acc
    return y


def add(sig, at, gain, pan=0.0):
    i = int(max(0, at) * SR)
    sig = sig[: len(out) - i]
    out[i:i + len(sig), 0] += sig * gain * np.cos((pan + 1) * np.pi / 4)
    out[i:i + len(sig), 1] += sig * gain * np.sin((pan + 1) * np.pi / 4)


def whoosh(d=0.5):
    n = int(d * SR)
    x = rng.standard_normal(n)
    x = x - lowpass(x, 400 + 2600 * 0.5)
    env = np.sin(np.linspace(0, np.pi, n)) ** 2
    return x * env


def impact():
    n = int(0.9 * SR)
    t = np.arange(n) / SR
    boom = np.sin(2 * np.pi * np.cumsum(38 + 120 * np.exp(-t * 18)) / SR) * np.exp(-t * 5)
    hit = rng.standard_normal(n) * np.exp(-t * 30)
    return np.tanh(1.8 * boom) + 0.35 * (hit - lowpass(hit, 1500))


def riser(d):
    n = int(d * SR)
    x = rng.standard_normal(n)
    x = x - lowpass(x, 1200)
    return x * np.linspace(0, 1, n) ** 3


H = 0.24
for i, s in enumerate(scenes):
    kind = s.get('transition')
    if not kind:
        continue
    if kind in ('flash', 'glitch'):
        add(impact(), s['start'] - 0.01, 0.30)
    else:
        add(whoosh(0.55), s['start'] - 0.32, 0.16, pan=(-0.4 if i % 2 else 0.4))
    if s.get('drop'):
        add(riser(1.6), s['start'] - 1.6, 0.10)
        add(impact(), s['start'] - 0.01, 0.35)

out = out[: int(total * SR)]
peak = np.max(np.abs(out)) or 1
out = out / max(peak, 1.0)
sf.write(sys.argv[3], out.astype(np.float32), SR)
print(f'sfx: {sum(1 for s in scenes if s.get("transition"))} transitions')
