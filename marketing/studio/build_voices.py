import sys, pathlib, numpy as np
src, out = pathlib.Path(sys.argv[1]), sys.argv[2]
voices = {p.stem: np.fromfile(p, dtype=np.float32).reshape(-1, 1, 256) for p in sorted(src.glob('*.bin'))}
np.savez(out, **voices)
print(len(voices), 'voices', next(iter(voices.values())).shape)
