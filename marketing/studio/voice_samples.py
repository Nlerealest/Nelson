"""Records a short sample of each voice in voices/voices.json, for the Twizzy
app's voice picker. Usage: voice_samples.py MODEL VOICES_NPZ OUT_DIR"""
import json
import subprocess
import sys
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro
from kokoro_onnx.tokenizer import Tokenizer

sys.path.insert(0, str(Path(__file__).parent))
model, voices, out = sys.argv[1], sys.argv[2], Path(sys.argv[3])
FIXES = {'ˈɛndælˈɑːmə': 'ndɑːlˈɑːmə', 'kwˈætʃə': 'kwˈɑːtʃə'}
LINE = "Moni! I'm the voice of Ndalama. It shows how much you can safely spend today, in kwacha, after your bills and savings are set aside."
kokoro, tok = Kokoro(model, voices), Tokenizer()
ph = tok.phonemize(LINE, 'en-us')
for w, r in FIXES.items():
    ph = ph.replace(w, r)
for v in json.loads((out / 'voices.json').read_text()):
    lang = 'en-gb' if v['id'].startswith('b') else 'en-us'
    p = tok.phonemize(LINE, lang)
    for w, r in FIXES.items():
        p = p.replace(w, r)
    samples, rate = kokoro.create(p, voice=v['id'], speed=1.0, is_phonemes=True)
    wav = out / f"{v['id']}.wav"
    sf.write(wav, samples, rate)
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', str(wav), '-af', 'loudnorm=I=-16:TP=-1.5', '-ac', '1', '-b:a', '64k', str(out / f"{v['id']}.mp3")], check=True)
    wav.unlink()
    print(v['id'], round(len(samples) / rate, 1), 's')
