#!/usr/bin/env bash
# Builds a vertical short from a campaign made from templates/short.
#   bash make_short.sh CAMPAIGN_DIR preview      # music + one still per scene in /tmp/prev-<slug>
#   bash make_short.sh CAMPAIGN_DIR video        # full render -> CAMPAIGN_DIR/ndalama-<slug>.mp4
# Music comes from the owner's song when song.json is there (cut to its beat),
# else original music from music_short.py. A campaign with a script.json gets a
# voiceover over that music (explainer style).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="$(cd "$1" && pwd)"; MODE="${2:-preview}"
SLUG="$(basename "$DIR" | sed 's/^[0-9]*-[0-9]*-//')"
C=~/.cache/ndalama-studio
cd "$DIR"
# The owner's song (song.json: {"file": "song.mp3", "start": <seconds into the song>}):
# find its tempo and first beat, so every scene cut lands on its beat.
SONGFILE=""
if [ -f song.json ]; then
  read -r SONGFILE SONGSTART < <(python3 -c 'import json;d=json.load(open("song.json"));print(d["file"], d.get("start",0))')
  ffmpeg -v error -y -ss "$SONGSTART" -i "$SONGFILE" -t 120 -ac 2 -ar 44100 /tmp/song-probe.wav
  "$C/venv/bin/python" -I "$HERE/beats.py" /tmp/song-probe.wav /tmp/song-beats.json >/dev/null
  # Of the tempo, half and double time, use the one closest to the tempo the story was written for.
  WANT=$(node -e 'global.window={};require(process.argv[1]);console.log(window.SHORT.bpm)' "$DIR/short.js")
  read -r SBPM SFIRST < <(python3 -c 'import json,sys;d=json.load(open("/tmp/song-beats.json"));t=d["tempo"];w=float(sys.argv[1])
t=min((t/2,t,t*2),key=lambda x:abs(x-w))
print(round(t,2), d["beats"][0] if d["beats"] else 0)' "$WANT")
  echo "window.SONG = {bpm: $SBPM, offset: 0};" > song.js
  echo "song: $SBPM bpm, first beat at $SFIRST s after $SONGSTART s"
else
  : > song.js
fi
if [ -f script.json ]; then
  # Voiceover in the chosen voice (voice.txt, default af_heart), then scene
  # lengths from the voice, rounded up to whole beats so cuts stay on the beat.
  VOICE=$(cat voice.txt 2>/dev/null || echo af_heart)
  [ -f vo/lengths.json ] && [ "$(cat vo/.voice 2>/dev/null)" = "$VOICE" ] || { rm -rf vo; "$C/venv/bin/python" -I "$HERE/voiceover.py" "$C/kokoro-q8.onnx" "$C/voices.npz" script.json vo "$VOICE" 1.0; echo "$VOICE" > vo/.voice; }
  python3 timeline.py
  VBPM=${SBPM:-$(node -e 'global.window={};require(process.argv[1]);console.log(window.SHORT.bpm)' "$DIR/short.js")}
  python3 - "$VBPM" <<'PY'
import json, math, sys
beat = 60 / float(sys.argv[1]); t = 0.0; scenes = json.load(open('timeline.json'))
for s in scenes:
    lead = s['vo_at'] - s['start']
    s['start'] = round(t, 3); s['dur'] = round(math.ceil(s['dur'] / beat - 0.05) * beat, 3); s['vo_at'] = round(t + lead, 3); t += s['dur']
json.dump(scenes, open('timeline.json', 'w'), indent=1)
open('timeline.js', 'w').write('window.TIMELINE = ' + json.dumps(scenes) + ';\n')
print(f'voiceover by {open("voice.txt").read().strip() if __import__("os").path.exists("voice.txt") else "af_heart"}: {t:.1f}s, cut on {sys.argv[1]} bpm')
PY
fi
read -r TOTAL DROP BPM MOOD < <(node -e '
  global.window = {}; require(process.argv[1]); try { require(process.argv[3]); } catch {} const s = window.SHORT, b = 60 / (window.SONG?.bpm || s.bpm);
  let tl = null; try { require(process.argv[2]); tl = window.TIMELINE; } catch {}
  let t = 0, drop = null;
  s.scenes.forEach((c, i) => { const id = c.id || "s" + i; const d = tl ? tl.find((x) => x.id === id).dur : c.beats * b; if (c.drop && drop === null) drop = t; t += d; });
  console.log(t.toFixed(3), (drop ?? b * 8).toFixed(3), window.SONG?.bpm || s.bpm, s.mood || "warm");' "$DIR/short.js" "$DIR/timeline.js" "$DIR/song.js")
# The owner's rule: every video is 45 s to 1:45 long.
if [ "${ALLOW_ANY_LENGTH:-}" != 1 ] && ! python3 -c "import sys; sys.exit(0 if 45 <= $TOTAL <= 105 else 1)"; then
  echo "This video would be ${TOTAL}s long. Every Twizzy video must be 45–105 s: add or lengthen scenes (or shorten them) in short.js." >&2
  exit 1
fi
if [ -n "$SONGFILE" ]; then
  # Start the track on its first beat; beats.js is the same beat grid the scenes use.
  python3 -c "s=$SONGSTART+$SFIRST; print(s)" > /tmp/song-cut
  ffmpeg -v error -y -ss "$(cat /tmp/song-cut)" -i "$SONGFILE" -t "$(python3 -c "print($TOTAL+1)")" -ac 2 -ar 44100 music.wav
  python3 -c "import json;b=60/$BPM;print('window.BEATS='+json.dumps([round(i*b,3) for i in range(int($TOTAL/b)+1)])+';')" > beats.js
else
  "$C/venv/bin/python" -I "$HERE/music_short.py" music.wav beats.js --bpm "$BPM" --seconds "$TOTAL" --drop "$DROP" --mood "$MOOD"
fi
[ -f script.json ] || : > timeline.js
# How loud the music is on each beat: the edit hits harder where the song does.
"$C/venv/bin/python" -I "$HERE/beat_energy.py" music.wav beats.js
# The scenes as the page laid them out (start, length, transition into each).
scenes_json() {
  (cd "$HERE" && node -e '
    const { chromium } = require("./playwright.cjs");
    (async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
      await p.goto("file://" + process.argv[1] + "/video.html"); console.log(JSON.stringify(await p.evaluate(() => SCENES))); await b.close(); })();' "$DIR")
}
if [ "$MODE" = preview ]; then
  OUT=/tmp/prev-$SLUG; rm -rf "$OUT"; mkdir -p "$OUT"
  # one still in the middle of each scene, plus one in the middle of each transition
  TIMES=$(scenes_json | node -e 'const s = JSON.parse(require("fs").readFileSync(0, "utf8"));
    console.log(s.flatMap((x, i) => [(x.start + Math.min(x.dur * 0.7, x.dur - 0.35)).toFixed(2), ...(i ? [(x.start - 0.06).toFixed(2)] : [])]).join(" "))')
  node "$HERE/render.cjs" preview "$DIR" "$OUT" $TIMES
  echo "previews in $OUT: $TIMES"
else
  F=/tmp/frames-$SLUG; rm -rf "$F"; mkdir -p "$F"
  node "$HERE/render.cjs" frames "$DIR" "$F" 30
  # Sound design: whooshes and impacts on the transitions, mixed with the music.
  scenes_json > /tmp/scenes-$SLUG.json
  "$C/venv/bin/python" -I "$HERE/sfx.py" /tmp/scenes-$SLUG.json "$TOTAL" /tmp/sfx-$SLUG.wav
  ffmpeg -v error -y -i music.wav -i /tmp/sfx-$SLUG.wav -filter_complex "[0:a][1:a]amix=inputs=2:normalize=0:duration=first" -ar 44100 /tmp/mix-$SLUG.wav
  if [ -f script.json ]; then
    python3 "$HERE/finish.py" --frames "$F" --out "ndalama-$SLUG.mp4" --timeline timeline.json --vo vo --music /tmp/mix-$SLUG.wav
  else
    python3 "$HERE/finish.py" --frames "$F" --out "ndalama-$SLUG.mp4" --track /tmp/mix-$SLUG.wav
  fi
fi
