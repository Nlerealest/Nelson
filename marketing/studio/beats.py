"""Finds a track's tempo and beat times, and prints its loudness over time
(to spot the drop). Usage: beats.py TRACK OUT_JSON  (also writes OUT.js)
"""
import sys, json, numpy as np, librosa
y, sr = librosa.load(sys.argv[1], sr=22050, mono=True)
tempo, beats = librosa.beat.beat_track(y=y, sr=sr, units='time')
tempo = float(np.atleast_1d(tempo)[0])
rms = librosa.feature.rms(y=y, hop_length=512)[0]
t = librosa.times_like(rms, sr=sr, hop_length=512)
# energy per 2-second window
print('tempo', round(tempo, 2), 'beats', len(beats), 'first beats', [round(b, 3) for b in beats[:8]])
for s in range(0, int(t[-1]), 4):
    m = rms[(t >= s) & (t < s + 4)].mean()
    print(f'{s:4d}s ' + '#' * int(m * 300))
json.dump({'tempo': tempo, 'beats': [float(b) for b in beats]}, open(sys.argv[2], 'w'))
# The showreel template reads the beat times from beats.js next to the JSON.
js = sys.argv[2].rsplit('.', 1)[0] + '.js'
open(js, 'w').write('window.BEATS=' + json.dumps([round(float(b), 3) for b in beats]) + ';\n')
