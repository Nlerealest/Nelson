"""Turns voiceover lengths into scene start times and durations."""
import json
lengths = json.load(open('vo/lengths.json'))
# Extra time before each line starts and after it ends, per scene.
LEAD = {'payday': 0.5, 'meet': 1.0, 'tagline': 0.6}
TAIL = {'gone': 0.9, 'meet': 0.7, 'safe': 0.8, 'goals': 0.9, 'bills': 1.3, 'loans': 1.1, 'report': 0.9, 'tagline': 1.1}
FIXED = {'end': 4.0}
t, scenes = 0.0, []
for sid, vo in lengths.items():
    lead = LEAD.get(sid, 0.35)
    dur = FIXED.get(sid) or round(lead + vo + TAIL.get(sid, 0.6), 2)
    scenes.append({'id': sid, 'start': round(t, 2), 'dur': dur, 'vo_at': round(t + lead, 2), 'vo': vo})
    t += dur
json.dump(scenes, open('timeline.json', 'w'), indent=1)
open('timeline.js', 'w').write('window.TIMELINE = ' + json.dumps(scenes) + ';\n')
for s in scenes: print(f"{s['id']:8} start {s['start']:6.2f}  dur {s['dur']:5.2f}")
print('total', round(t, 2), 's')
