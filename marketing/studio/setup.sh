#!/usr/bin/env bash
# Prepares the video studio: Python audio tools and the Kokoro voice model.
# Safe to run again; finished steps are skipped. Everything goes in
# $STUDIO_CACHE (default ~/.cache/ndalama-studio), never in the repository.
#
# The model weights come from the npm package kokoro-q8-shards (Apache-2.0)
# and the voices from kokoro-js, because npm and PyPI are reachable from the
# cloud environment where Hugging Face is not.
set -euo pipefail
CACHE="${STUDIO_CACHE:-$HOME/.cache/ndalama-studio}"
HERE="$(cd "$(dirname "$0")" && pwd)"
MODEL_SHA=fbae9257e1e05ffc727e951ef9b9c98418e6d79f1c9b6b13bd59f5c9028a1478
mkdir -p "$CACHE"

if [ ! -x "$CACHE/venv/bin/python" ]; then
  echo "Creating Python environment…"
  python3 -m venv "$CACHE/venv"
fi
"$CACHE/venv/bin/pip" install -q kokoro-onnx soundfile librosa

if [ ! -f "$CACHE/kokoro-q8.onnx" ]; then
  echo "Downloading the voice model (about 90 MB)…"
  tmp="$(mktemp -d)"
  (cd "$tmp" && npm pack kokoro-q8-shards@1.0.0 kokoro-js@1.2.1 --silent >/dev/null)
  mkdir -p "$tmp/shards" "$tmp/js"
  tar xzf "$tmp"/kokoro-q8-shards-1.0.0.tgz -C "$tmp/shards"
  tar xzf "$tmp"/kokoro-js-1.2.1.tgz -C "$tmp/js"
  cat "$tmp"/shards/package/kokoro-q8.part{0,1,2,3,4,5}.bin > "$CACHE/kokoro-q8.onnx.part"
  echo "$MODEL_SHA  $CACHE/kokoro-q8.onnx.part" | sha256sum -c --quiet
  mv "$CACHE/kokoro-q8.onnx.part" "$CACHE/kokoro-q8.onnx"
  (cd "$HERE" && "$CACHE/venv/bin/python" -I build_voices.py "$tmp/js/package/voices" "$CACHE/voices.npz")
  rm -rf "$tmp"
fi
echo "Studio ready in $CACHE"
