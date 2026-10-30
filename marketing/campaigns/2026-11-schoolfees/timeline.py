"""Turns voiceover lengths into scene start times and durations."""
import json
lengths = json.load(open('vo/lengths.json'))
LEAD = {'hook': 0.4}
TAIL = {'plan': 0.8, 'warn': 0.8, 'end': 2.2}
t, scenes = 0.0, []
for sid, vo in lengths.items():
    lead = LEAD.get(sid, 0.3)
    dur = round(lead + vo + TAIL.get(sid, 0.5), 2)
    scenes.append({'id': sid, 'start': round(t, 2), 'dur': dur, 'vo_at': round(t + lead, 2), 'vo': vo})
    t += dur
json.dump(scenes, open('timeline.json', 'w'), indent=1)
open('timeline.js', 'w').write('window.TIMELINE = ' + json.dumps(scenes) + ';\n')
for s in scenes: print(f"{s['id']:8} start {s['start']:6.2f}  dur {s['dur']:5.2f}")
print('total', round(t, 2), 's')
