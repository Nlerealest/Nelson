"""Synthesises one voiceover clip per scene and records their lengths.

Usage: voiceover.py MODEL VOICES SCRIPT_JSON OUT_DIR VOICE SPEED
"""
import json
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro
from kokoro_onnx.tokenizer import Tokenizer

model, voices, script_path, out_dir, voice, speed = sys.argv[1:7]
out = Path(out_dir)
out.mkdir(parents=True, exist_ok=True)

# eSpeak reads these Chichewa words as if they were English.
FIXES = {
    'ˈɛndælˈɑːmə': 'ndɑːlˈɑːmə',   # Ndalama: n-da-LAH-ma, not EN-da-lama
    'kwˈætʃə': 'kwˈɑːtʃə',         # Kwacha: KWAH-cha
    'ˈɛmpˈæmbə': 'mpˈɑːmbə',       # Mpamba
    'ɛmpˈæmbə': 'mpˈɑːmbə',
    'ˈɛɹɾəl': 'ˈɛɹtɛl',            # Airtel: AIR-tel
}

kokoro = Kokoro(model, voices)
tok = Tokenizer()
lengths = {}
for scene in json.loads(Path(script_path).read_text()):
    text = scene['vo'].strip()
    if not text:
        lengths[scene['id']] = 0
        continue
    phonemes = tok.phonemize(text, 'en-us')
    for wrong, right in FIXES.items():
        phonemes = phonemes.replace(wrong, right)
    samples, rate = kokoro.create(phonemes, voice=voice, speed=float(speed), is_phonemes=True)
    sf.write(out / f"{scene['id']}.wav", samples, rate)
    lengths[scene['id']] = round(len(samples) / rate, 3)
    print(f"{scene['id']:8} {lengths[scene['id']]:5.2f}s  {phonemes}")

(out / 'lengths.json').write_text(json.dumps(lengths, indent=1))
print('total', round(sum(lengths.values()), 2))
