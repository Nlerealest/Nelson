#!/usr/bin/env bash
# Takes fresh screenshots of the current Ndalama app, dated today, for videos:
# builds the app for the web, loads the sample month (sample-data.mjs, with
# dates relative to the day) and captures every screen and card into
# marketing/assets/app. The numbers the app shows are saved to numbers.txt.
#   bash marketing/studio/fresh_screens.sh [YYYY-MM-DD]   (default: today in Malawi)
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
DAY="${1:-$(TZ=Africa/Blantyre date +%F)}"
WEB="${TMPDIR:-/tmp}/ndalama-web"
cd "$ROOT"
[ -d node_modules ] || npm ci --no-audit --no-fund --silent
rm -rf "$WEB"
EXPO_OFFLINE=1 npx expo export --platform web --output-dir "$WEB" >/dev/null
(cd "$WEB" && python3 -m http.server 8090 >/dev/null 2>&1) & SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 1
cd "$HERE"
node sample-data.mjs "$DAY" "${TMPDIR:-/tmp}/ndalama-data.json" 2>/dev/null | tee "$ROOT/marketing/assets/app/numbers.txt"
APP_DATE="${DAY}T09:30:00" node capture.cjs "$ROOT/marketing/assets/app" "${TMPDIR:-/tmp}/ndalama-data.json"
sed -i "1i # What the app shows on ${DAY} for the sample month (sample-data.mjs). Use these numbers in videos." "$ROOT/marketing/assets/app/numbers.txt"
echo "Fresh app screens for $DAY in marketing/assets/app"
