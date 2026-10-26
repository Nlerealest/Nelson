"""Synthetic XAUUSD M5 bars for tests (random walk around $2,350). Not for judging performance."""
import numpy as np
import pandas as pd


def random_walk(days: int = 20, seed: int = 1, start: str = "2025-03-03") -> pd.DataFrame:
    rng = np.random.default_rng(seed)
    n = days * 288
    t = pd.date_range(start, periods=n, freq="5min")
    t = t[t.dayofweek < 5][: n]
    steps = rng.normal(0, 0.9, len(t))
    close = 2350 + np.cumsum(steps)
    open_ = np.r_[close[0], close[:-1]]
    wick = np.abs(rng.normal(0, 0.6, (2, len(t))))
    high = np.maximum(open_, close) + wick[0]
    low = np.minimum(open_, close) - wick[1]
    vol = rng.integers(80, 160, len(t)).astype(float)
    return pd.DataFrame({"time": t, "open": open_, "high": high, "low": low, "close": close, "tick_volume": vol})


def planted_short(base: pd.DataFrame, at: str) -> tuple[pd.DataFrame, int]:
    """Builds a clean bearish setup at time `at`: rally into a high, sweep it, displace down leaving a gap."""
    df = base.copy()
    i = int(df.index[df["time"] == pd.Timestamp(at)][0])
    p = df.loc[i - 30, "close"]
    path = []
    # 20 bars rally to a swing high at p+10, pull back, then 6 bars back near it
    for k in range(20):
        path.append(p + k * 0.5)
    for k in range(5):
        path.append(p + 9.5 - k * 0.8)
    for k in range(5):
        path.append(p + 6 + k * 0.6)
    for j, c in enumerate(path):
        r = i - 30 + j
        o = df.loc[r - 1, "close"] if j else c
        df.loc[r, ["open", "close", "high", "low", "tick_volume"]] = [o, c, max(o, c) + 0.2, min(o, c) - 0.2, 100]
    swing_high = df.loc[i - 30:i - 1, "high"].max()
    prev = df.loc[i - 1, "close"]
    # sweep bar: wick 1.5 above the high, close back below, big volume
    df.loc[i, ["open", "high", "low", "close", "tick_volume"]] = [prev, swing_high + 1.5, prev - 0.5, prev - 0.3, 400]
    # displacement: two strong bearish bars leaving a fair value gap
    c1 = prev - 0.3
    df.loc[i + 1, ["open", "high", "low", "close", "tick_volume"]] = [c1, c1 + 0.2, c1 - 4.0, c1 - 3.8, 300]
    c2 = c1 - 3.8
    df.loc[i + 2, ["open", "high", "low", "close", "tick_volume"]] = [c2, c2 - 1.0, c2 - 9.0, c2 - 8.8, 350]
    df.loc[i + 2, "high"] = c2 + 0.0
    # make bar i+2 high below bar i low -> bearish FVG between them
    df.loc[i + 2, "high"] = min(df.loc[i + 2, "high"], df.loc[i, "low"] - 1.5)
    df.loc[i + 2, "open"] = df.loc[i + 2, "high"]
    # continue lower afterwards so nothing below is disturbed
    for r in range(i + 3, i + 40):
        o = df.loc[r - 1, "close"]
        c = o + (0.3 if r < i + 8 else -0.4)
        df.loc[r, ["open", "close", "high", "low"]] = [o, c, max(o, c) + 0.2, min(o, c) - 0.2]
    # re-anchor the rest of the series to stay continuous
    shift = df.loc[i + 39, "close"] - base.loc[i + 39, "close"]
    for col in ("open", "high", "low", "close"):
        df.loc[i + 40:, col] = base.loc[i + 40:, col] + shift
    return df, i
