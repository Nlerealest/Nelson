"""Order flow.

Spot gold (XAUUSD) is traded over the counter, so there is no central order
book or true traded volume like on the COMEX futures. What MT5 does give us:

* tick volume - the number of price updates per bar. It tracks real activity
  closely and spikes when stops get run.
* the tick stream - each bid/ask change. Classifying upticks as buying and
  downticks as selling (the "tick rule") gives a delta: who is more aggressive.

Nelson uses these to confirm that a liquidity sweep had real participation and
that the move away from it is backed by aggressive orders in the same direction.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def bar_delta_proxy(df: pd.DataFrame) -> pd.Series:
    """Estimated delta from OHLC + tick volume (used when ticks are not available, e.g. backtests).

    The close location within the bar splits volume into buying and selling:
    a bar closing on its high counts all its volume as buying.
    """
    rng = (df["high"] - df["low"]).replace(0, np.nan)
    clv = ((df["close"] - df["low"]) - (df["high"] - df["close"])) / rng
    return (clv.fillna(0) * df["tick_volume"]).rename("delta")


def tick_delta(ticks: pd.DataFrame, bar_times: pd.Series, bar_minutes: int) -> pd.Series:
    """Delta per bar from the MT5 tick stream.

    `ticks` needs columns time (UTC), bid, and optionally last/flags. Uses the
    broker's BUY/SELL flags when present (exchange symbols), otherwise the tick
    rule on the bid price.
    """
    if ticks.empty:
        return pd.Series(0.0, index=bar_times.index)
    t = ticks.sort_values("time")
    sign = np.zeros(len(t))
    flags = t["flags"].to_numpy() if "flags" in t else None
    if flags is not None and ((flags & 32) | (flags & 64)).any():   # TICK_FLAG_BUY=32, TICK_FLAG_SELL=64
        sign = np.where(flags & 32, 1.0, np.where(flags & 64, -1.0, 0.0))
    else:
        price = t["bid"].to_numpy()
        diff = np.sign(np.diff(price, prepend=price[0]))
        # zero-ticks inherit the previous direction (standard tick rule)
        sign = pd.Series(diff).replace(0, np.nan).ffill().fillna(0).to_numpy()
    bucket = t["time"].dt.floor(f"{bar_minutes}min")
    per_bar = pd.Series(sign, index=t.index).groupby(bucket.to_numpy()).sum()
    return pd.Series(bar_times.map(per_bar).fillna(0.0).to_numpy(), index=bar_times.index, name="delta")


def relative_volume(volume: pd.Series, lookback: int = 20) -> pd.Series:
    """Volume divided by the median of the previous `lookback` bars."""
    base = volume.shift(1).rolling(lookback, min_periods=lookback // 2).median()
    return (volume / base.replace(0, np.nan)).fillna(0.0)


def volume_profile(df: pd.DataFrame, bins: int = 40, value_area: float = 0.70) -> dict:
    """Point of control and value area from tick volume distributed over each bar's range."""
    lo, hi = float(df["low"].min()), float(df["high"].max())
    if hi <= lo:
        return {"poc": lo, "vah": hi, "val": lo}
    edges = np.linspace(lo, hi, bins + 1)
    centres = (edges[:-1] + edges[1:]) / 2
    vol = np.zeros(bins)
    for h, l, v in zip(df["high"].to_numpy(), df["low"].to_numpy(), df["tick_volume"].to_numpy()):
        inside = (centres >= l) & (centres <= h)
        if inside.any():
            vol[inside] += v / inside.sum()
    poc_i = int(vol.argmax())
    order = np.argsort(vol)[::-1]
    total, acc, chosen = vol.sum(), 0.0, []
    for i in order:
        chosen.append(i)
        acc += vol[i]
        if acc >= value_area * total:
            break
    return {"poc": float(centres[poc_i]), "vah": float(centres[max(chosen)]), "val": float(centres[min(chosen)])}
