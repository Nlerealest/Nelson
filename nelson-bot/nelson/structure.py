"""Market structure: swing highs/lows, breaks of structure and trend."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .indicators import confirmed_pivots


def market_structure(df: pd.DataFrame, k: int) -> pd.DataFrame:
    """Trend from breaks of structure, using only information known at each bar.

    A close above the latest confirmed swing high is a bullish break (BOS, or a
    CHoCH if the trend was bearish); a close below the latest swing low is a
    bearish break. Trend is +1 bullish, -1 bearish, 0 unknown.
    """
    high, low, close = df["high"].to_numpy(), df["low"].to_numpy(), df["close"].to_numpy()
    hc, hp, lc, lp = confirmed_pivots(high, low, k)
    n = len(df)
    trend = np.zeros(n, dtype=int)
    bos = np.zeros(n, dtype=int)
    last_sh = np.full(n, np.nan)
    last_sl = np.full(n, np.nan)
    sh = sl = np.nan
    sh_live = sl_live = False
    state = 0
    for i in range(n):
        if hc[i]:
            sh, sh_live = hp[i], True
        if lc[i]:
            sl, sl_live = lp[i], True
        if sh_live and close[i] > sh:
            state, sh_live, bos[i] = 1, False, 1
        elif sl_live and close[i] < sl:
            state, sl_live, bos[i] = -1, False, -1
        trend[i], last_sh[i], last_sl[i] = state, sh, sl
    return pd.DataFrame({"trend": trend, "bos": bos, "swing_high": last_sh, "swing_low": last_sl}, index=df.index)


def resample(df: pd.DataFrame, minutes: int, offset_hours: float = 0.0) -> pd.DataFrame:
    """Aggregate bars to a higher timeframe. Index = bar open time.

    offset_hours moves the bar boundaries, e.g. -2 makes daily bars start at 22:00 UTC (the New York
    close, where forex and gold daily candles start)."""
    agg = {"open": "first", "high": "max", "low": "min", "close": "last", "tick_volume": "sum"}
    kw = {"offset": pd.Timedelta(hours=offset_hours)} if offset_hours else {}
    out = df.set_index("time")[list(agg)].resample(f"{minutes}min", label="left", closed="left", **kw).agg(agg)
    return out.dropna(subset=["open"]).reset_index()


def htf_trend(df: pd.DataFrame, entry_minutes: int, htf_minutes: int, k: int,
              source: pd.DataFrame | None = None, offset_hours: float = 0.0) -> pd.DataFrame:
    """Structure trend of a higher timeframe (+1 / -1 / 0) and its latest swing high/low, on each entry bar.

    `source` can be a longer history of the same entry-timeframe bars (live, where the bars Nelson scans
    only cover ~10 days - too few daily candles). Only fully closed HTF bars are used."""
    htf = resample(df if source is None else source, htf_minutes, offset_hours)
    htf = pd.concat([htf, market_structure(htf, k)], axis=1)
    htf["available"] = htf["time"] + pd.Timedelta(minutes=htf_minutes)
    left = pd.DataFrame({"close_time": df["time"] + pd.Timedelta(minutes=entry_minutes), "_i": np.arange(len(df))})
    merged = pd.merge_asof(left.sort_values("close_time"),
                           htf[["available", "trend", "swing_high", "swing_low"]].sort_values("available"),
                           left_on="close_time", right_on="available", direction="backward").sort_values("_i")
    return pd.DataFrame({"trend": merged["trend"].fillna(0).astype(int).to_numpy(),
                         "swing_high": merged["swing_high"].to_numpy(),
                         "swing_low": merged["swing_low"].to_numpy()}, index=df.index)


def htf_context(df: pd.DataFrame, entry_minutes: int, htf_minutes: int, k: int, range_bars: int = 24) -> pd.DataFrame:
    """Higher-timeframe trend and dealing range mapped onto entry bars.

    An HTF bar is only used once it has fully closed, so there is no look-ahead.
    The dealing range is the high/low of the last `range_bars` closed HTF bars;
    above its midpoint is premium (sell zone), below is discount (buy zone).
    """
    htf = resample(df, htf_minutes)
    st = market_structure(htf, k)
    htf = pd.concat([htf, st], axis=1)
    htf["range_high"] = htf["high"].rolling(range_bars, min_periods=3).max()
    htf["range_low"] = htf["low"].rolling(range_bars, min_periods=3).min()
    htf["available"] = htf["time"] + pd.Timedelta(minutes=htf_minutes)
    left = pd.DataFrame({"close_time": df["time"] + pd.Timedelta(minutes=entry_minutes), "_i": np.arange(len(df))})
    merged = pd.merge_asof(
        left.sort_values("close_time"),
        htf[["available", "trend", "range_high", "range_low", "swing_high", "swing_low"]].sort_values("available"),
        left_on="close_time", right_on="available", direction="backward",
    ).sort_values("_i")
    out = pd.DataFrame({
        "htf_trend": merged["trend"].fillna(0).astype(int).to_numpy(),
        "htf_range_high": merged["range_high"].to_numpy(),
        "htf_range_low": merged["range_low"].to_numpy(),
        "htf_swing_high": merged["swing_high"].to_numpy(),
        "htf_swing_low": merged["swing_low"].to_numpy(),
    }, index=df.index)
    out["htf_equilibrium"] = (out["htf_range_high"] + out["htf_range_low"]) / 2
    return out
