"""Market brief: Nelson's read of XAUUSD in plain language."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .orderflow import volume_profile
from .sessions import session_name


def market_brief(f: pd.DataFrame, book, news=None, setups=None) -> str:
    last = f.iloc[-1]
    price, a = float(last["close"]), float(last["atr"])
    t = last["time"] + pd.Timedelta(minutes=f.attrs.get("bar_minutes", 5))
    trend = int(last["htf_trend"])
    eq = last["htf_equilibrium"]
    lines = [
        f"NELSON - XAUUSD market brief, {t:%a %d %b %Y %H:%M} UTC ({session_name(t)})",
        f"Price {price:.2f} | ATR {a:.2f} (typical {f.attrs.get('bar_minutes', 5)}-minute range)",
        f"H1 structure: {'BULLISH - looking for buys' if trend > 0 else 'BEARISH - looking for sells' if trend < 0 else 'unclear - standing aside'}",
    ]
    if not np.isnan(eq):
        zone = "PREMIUM (sell zone)" if price > eq else "DISCOUNT (buy zone)"
        lines.append(f"H1 range {last['htf_range_low']:.2f} - {last['htf_range_high']:.2f}, equilibrium {eq:.2f}: price in {zone}")
    if not np.isnan(last.get("pdh", np.nan)):
        lines.append(f"Previous day high {last['pdh']:.2f} / low {last['pdl']:.2f}")
    if not np.isnan(last.get("asia_high", np.nan)):
        lines.append(f"Asian range {last['asia_low']:.2f} - {last['asia_high']:.2f}")
    if book is not None:
        above, below = book.nearest(price)
        if above:
            lines.append(f"Nearest buy-side liquidity: {above.name} {above.price:.2f} ({above.price - price:+.2f})")
        if below:
            lines.append(f"Nearest sell-side liquidity: {below.name} {below.price:.2f} ({below.price - price:+.2f})")
    day = f[f["time"] >= f["time"].iloc[-1].normalize() - pd.Timedelta(days=1)]
    vp = volume_profile(day)
    lines.append(f"Volume profile (24h): POC {vp['poc']:.2f}, value area {vp['val']:.2f} - {vp['vah']:.2f}")
    recent = f.tail(12)
    lines.append(f"Order flow (last hour): delta {recent['delta'].sum():+.0f}, volume x{recent['rel_volume'].mean():.1f} normal")
    if news is not None:
        if not news.available:
            lines.append("News: calendar UNAVAILABLE")
        else:
            up = news.upcoming(t, 24)
            lines.append("High-impact USD news next 24h: " + ("none" if not up else ""))
            lines += [f"  - {e}{'  [TIER 1]' if e.tier1 else ''}" for e in up]
            blocked, ev = news.blocked(t)
            if blocked:
                lines.append(f"  >> NO NEW TRADES now because of: {ev}")
    if setups:
        lines.append(f"Last setup: {setups[-1].time:%a %H:%M} {setups[-1].describe()}")
    return "\n".join(lines)
