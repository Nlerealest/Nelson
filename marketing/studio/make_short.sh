#!/usr/bin/env bash
# Builds a vertical short from a campaign made from templates/short.
#   bash make_short.sh CAMPAIGN_DIR preview      # music + one still per scene in /tmp/prev-<slug>
#   bash make_short.sh CAMPAIGN_DIR video        # full render -> CAMPAIGN_DIR/ndalama-<slug>.mp4
# Music-only shorts get original music from music_short.py. A campaign with a
# script.json gets a voiceover over that music (explainer style).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="$(cd "$1" && pwd)"; MODE="${2:-preview}"
SLUG="$(basename "$DIR" | sed 's/^[0-9]*-[0-9]*-//')"
C=~/.cache/ndalama-studio
cd "$DIR"
if [ -f script.json ]; then
  [ -f vo/lengths.json ] || "$C/venv/bin/python" -I "$HERE/voiceover.py" "$C/kokoro-q8.onnx" "$C/voices.npz" script.json vo af_heart 1.0
  python3 timeline.py
fi
read -r TOTAL DROP BPM MOOD < <(node -e '
  global.window = {}; require(process.argv[1]); const s = window.SHORT, b = 60 / s.bpm;
  let tl = null; try { require(process.argv[2]); tl = window.TIMELINE; } catch {}
  let t = 0, drop = null;
  s.scenes.forEach((c, i) => { const id = c.id || "s" + i; const d = tl ? tl.find((x) => x.id === id).dur : c.beats * b; if (c.drop && drop === null) drop = t; t += d; });
  console.log(t.toFixed(3), (drop ?? b * 8).toFixed(3), s.bpm, s.mood || "warm");' "$DIR/short.js" "$DIR/timeline.js")
"$C/venv/bin/python" -I "$HERE/music_short.py" music.wav beats.js --bpm "$BPM" --seconds "$TOTAL" --drop "$DROP" --mood "$MOOD"
[ -f script.json ] || : > timeline.js
if [ "$MODE" = preview ]; then
  OUT=/tmp/prev-$SLUG; rm -rf "$OUT"; mkdir -p "$OUT"
  TIMES=$(cd "$HERE" && node -e '
    const { chromium } = require("./playwright.cjs");
    (async () => { const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
      await p.goto("file://" + process.argv[1] + "/video.html"); const s = await p.evaluate(() => SCENES);
      console.log(s.map((x) => (x.start + Math.min(x.dur * 0.7, x.dur - 0.35)).toFixed(2)).join(" ")); await b.close(); })();' "$DIR")
  node "$HERE/render.cjs" preview "$DIR" "$OUT" $TIMES
  echo "previews in $OUT: $TIMES"
else
  F=/tmp/frames-$SLUG; rm -rf "$F"; mkdir -p "$F"
  node "$HERE/render.cjs" frames "$DIR" "$F" 30
  if [ -f script.json ]; then
    python3 "$HERE/finish.py" --frames "$F" --out "ndalama-$SLUG.mp4" --timeline timeline.json --vo vo --music music.wav
  else
    python3 "$HERE/finish.py" --frames "$F" --out "ndalama-$SLUG.mp4" --track music.wav
  fi
fi
