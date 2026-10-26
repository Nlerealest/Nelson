"""Basic building blocks: ATR and swing points (pivots)."""
from __future__ import annotations

import numpy as np
import pandas as pd


def atr(df: pd.DataFrame, period: int = 14) -> pd.Series:
    """Average True Range with Wilder smoothing (uses only past data)."""
    prev_close = df["close"].shift(1)
    tr = pd.concat(
        [df["high"] - df["low"], (df["high"] - prev_close).abs(), (df["low"] - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()


def pivots(high: np.ndarray, low: np.ndarray, k: int) -> tuple[np.ndarray, np.ndarray]:
    """Swing highs / lows: a bar whose high (low) is the extreme of the k bars on each side.

    Returned flags sit on the pivot bar itself, which is only *known* k bars
    later. Callers must use `confirmed_pivots` to stay free of look-ahead.
    """
    n = len(high)
    is_high = np.zeros(n, dtype=bool)
    is_low = np.zeros(n, dtype=bool)
    for j in range(k, n - k):
        h, lo = high[j], low[j]
        if h > high[j - k:j].max() and h >= high[j + 1:j + k + 1].max():
            is_high[j] = True
        if lo < low[j - k:j].min() and lo <= low[j + 1:j + k + 1].min():
            is_low[j] = True
    return is_high, is_low


def confirmed_pivots(high: np.ndarray, low: np.ndarray, k: int):
    """Pivots shifted to the bar on which they become known (pivot bar + k).

    Returns (high_confirmed, high_price, low_confirmed, low_price), each aligned
    to the confirmation bar.
    """
    is_high, is_low = pivots(high, low, k)
    n = len(high)
    hc = np.zeros(n, dtype=bool)
    lc = np.zeros(n, dtype=bool)
    hp = np.full(n, np.nan)
    lp = np.full(n, np.nan)
    hc[k:] = is_high[:n - k]
    lc[k:] = is_low[:n - k]
    hp[k:] = np.where(is_high[:n - k], high[:n - k], np.nan)
    lp[k:] = np.where(is_low[:n - k], low[:n - k], np.nan)
    return hc, hp, lc, lp
