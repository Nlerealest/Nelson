"""Liquidity: where the stops are resting, and when they get swept.

Buy-side liquidity (BSL) sits above highs - stop losses of sellers and buy
stops of breakout traders. Sell-side liquidity (SSL) sits below lows. Big
players need that liquidity to fill large orders, so price often runs a level
("sweeps" it), grabs the stops, and reverses. A sweep = wick through the level
and a close back on the other side.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .sessions import _minutes

# Higher number = more significant level (more stops resting there)
PRIORITY = {"PDH": 4, "PDL": 4, "Asia high": 3, "Asia low": 3, "Equal highs": 3, "Equal lows": 3,
            "Swing high": 1, "Swing low": 1}


@dataclass
class Level:
    price: float
    side: str          # "BSL" (above price, buy stops) or "SSL" (below price, sell stops)
    name: str
    created: int       # epoch seconds
    alive: bool = True

    @property
    def priority(self) -> int:
        return PRIORITY.get(self.name, 1)


def daily_levels(df: pd.DataFrame) -> pd.DataFrame:
    """Previous UTC day's high/low for every bar."""
    day = df["time"].dt.normalize()
    daily = df.groupby(day).agg(high=("high", "max"), low=("low", "min"))
    prev = daily.shift(1)
    return pd.DataFrame({"pdh": day.map(prev["high"]).to_numpy(), "pdl": day.map(prev["low"]).to_numpy()}, index=df.index)


def asia_levels(df: pd.DataFrame, session: tuple[str, str], bar_minutes: int) -> pd.DataFrame:
    """Asian session high/low, available only once the session has closed."""
    start, end = _minutes(session[0]), _minutes(session[1])
    mins = df["time"].dt.hour * 60 + df["time"].dt.minute
    day = df["time"].dt.normalize()
    in_asia = (mins >= start) & (mins < end)
    asia = df[in_asia].groupby(day[in_asia]).agg(high=("high", "max"), low=("low", "min"))
    ready = (mins + bar_minutes) > end   # bar closes after the session ended
    hi = day.map(asia["high"]).where(ready)
    lo = day.map(asia["low"]).where(ready)
    return pd.DataFrame({"asia_high": hi.to_numpy(), "asia_low": lo.to_numpy()}, index=df.index)


class LiquidityBook:
    """Keeps the list of untouched liquidity levels as price moves bar by bar."""

    def __init__(self, equal_tolerance_atr: float, max_age_hours: float):
        self.levels: list[Level] = []
        self.tol = equal_tolerance_atr
        self.max_age = int(max_age_hours * 3600)

    def add(self, price: float, side: str, name: str, t: int, atr: float) -> None:
        if price is None or np.isnan(price):
            return
        if name.startswith("Swing") and atr > 0:
            for lvl in self.levels:
                if lvl.alive and lvl.side == side and lvl.name.startswith("Swing") and abs(lvl.price - price) <= self.tol * atr:
                    lvl.name = "Equal highs" if side == "BSL" else "Equal lows"
                    lvl.price = max(lvl.price, price) if side == "BSL" else min(lvl.price, price)
                    return
        self.levels.append(Level(float(price), side, name, t))

    def expire(self, t: int) -> None:
        if any(not lv.alive or t - lv.created > self.max_age for lv in self.levels):
            self.levels = [lv for lv in self.levels if lv.alive and t - lv.created <= self.max_age]

    def check(self, high: float, low: float, close: float) -> tuple[list[Level], list[Level]]:
        """Returns (bsl_swept, ssl_swept) on this bar. Levels traded through are removed."""
        bsl, ssl = [], []
        for lv in self.levels:
            if not lv.alive:
                continue
            if lv.side == "BSL" and high > lv.price:
                lv.alive = False
                if close < lv.price:
                    bsl.append(lv)
            elif lv.side == "SSL" and low < lv.price:
                lv.alive = False
                if close > lv.price:
                    ssl.append(lv)
        return bsl, ssl

    def nearest(self, price: float) -> tuple[Level | None, Level | None]:
        above = [lv for lv in self.levels if lv.alive and lv.side == "BSL" and lv.price > price]
        below = [lv for lv in self.levels if lv.alive and lv.side == "SSL" and lv.price < price]
        return (min(above, key=lambda lv: lv.price) if above else None,
                max(below, key=lambda lv: lv.price) if below else None)
