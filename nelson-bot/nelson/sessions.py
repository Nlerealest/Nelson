"""Trading sessions and time windows (all times UTC)."""
from __future__ import annotations

import numpy as np
import pandas as pd


def _minutes(hhmm: str) -> int:
    h, m = str(hhmm).split(":")
    return int(h) * 60 + int(m)


def in_windows(times: pd.Series, windows) -> np.ndarray:
    """True where the time of day falls inside any (start, end) window. Windows may wrap midnight."""
    mins = (times.dt.hour * 60 + times.dt.minute).to_numpy()
    mask = np.zeros(len(mins), dtype=bool)
    for start, end in windows:
        s, e = _minutes(start), _minutes(end)
        if s <= e:
            mask |= (mins >= s) & (mins < e)
        else:
            mask |= (mins >= s) | (mins < e)
    return mask


def session_name(ts: pd.Timestamp) -> str:
    m = ts.hour * 60 + ts.minute
    if m < 6 * 60:
        return "Asia"
    if m < 12 * 60:
        return "London"
    if m < 17 * 60:
        return "New York (London overlap)" if m < 16 * 60 else "New York"
    if m < 21 * 60:
        return "New York PM"
    return "Rollover / thin market"


def friday_cutoff(times: pd.Series, after_utc: str) -> np.ndarray:
    """True where it is Friday after the cutoff (avoid holding into the weekend)."""
    if not after_utc:
        return np.zeros(len(times), dtype=bool)
    mins = (times.dt.hour * 60 + times.dt.minute).to_numpy()
    return (times.dt.dayofweek.to_numpy() == 4) & (mins >= _minutes(after_utc))
