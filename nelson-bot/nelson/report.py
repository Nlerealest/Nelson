"""Market brief: Nelson's read of XAUUSD, as data (for the app) and as plain text."""
from __future__ import annotations

import numpy as np
import pandas as pd

from .orderflow import volume_profile
from .sessions import session_name


def _num(x) -> float | None:
    try:
        x = float(x)
    except (TypeError, ValueError):
        return None
    return None if np.isnan(x) else round(x, 2)


def analysis(f: pd.DataFrame, book) -> dict:
    last = f.iloc[-1]
    price = float(last["close"])
    t = last["time"] + pd.Timedelta(minutes=f.attrs.get("bar_minutes", 5))
    eq = _num(last["htf_equilibrium"])
    day = f[f["time"] >= f["time"].iloc[-1].normalize() - pd.Timedelta(days=1)]
    vp = volume_profile(day)
    recent = f.tail(12)
    above, below = book.nearest(price) if book is not None else (None, None)
    return {
        "time": t.isoformat(),
        "session": session_name(t),
        "price": round(price, 2),
        "atr": _num(last["atr"]),
        "trend": int(last["htf_trend"]),
        "range_high": _num(last["htf_range_high"]),
        "range_low": _num(last["htf_range_low"]),
        "equilibrium": eq,
        "zone": None if eq is None else ("premium" if price > eq else "discount"),
        "pdh": _num(last.get("pdh")), "pdl": _num(last.get("pdl")),
        "asia_high": _num(last.get("asia_high")), "asia_low": _num(last.get("asia_low")),
        "nearest_bsl": {"name": above.name, "price": round(above.price, 2)} if above else None,
        "nearest_ssl": {"name": below.name, "price": round(below.price, 2)} if below else None,
        "poc": round(vp["poc"], 2), "vah": round(vp["vah"], 2), "val": round(vp["val"], 2),
        "delta_1h": round(float(recent["delta"].sum()), 0),
        "volume_1h": round(float(recent["rel_volume"].mean()), 2),
    }


def market_brief(f: pd.DataFrame, book, news=None, setups=None) -> str:
    a = analysis(f, book)
    t = pd.Timestamp(a["time"])
    trend = a["trend"]
    lines = [
        f"NELSON - XAUUSD market brief, {t:%a %d %b %Y %H:%M} UTC ({a['session']})",
        f"Price {a['price']:.2f} | ATR {a['atr']:.2f} (typical {f.attrs.get('bar_minutes', 5)}-minute range)",
        f"H1 structure: {'BULLISH - looking for buys' if trend > 0 else 'BEARISH - looking for sells' if trend < 0 else 'unclear - standing aside'}",
    ]
    if a["equilibrium"] is not None:
        zone = "PREMIUM (sell zone)" if a["zone"] == "premium" else "DISCOUNT (buy zone)"
        lines.append(f"H1 range {a['range_low']:.2f} - {a['range_high']:.2f}, equilibrium {a['equilibrium']:.2f}: price in {zone}")
    if a["pdh"] is not None:
        lines.append(f"Previous day high {a['pdh']:.2f} / low {a['pdl']:.2f}")
    if a["asia_high"] is not None:
        lines.append(f"Asian range {a['asia_low']:.2f} - {a['asia_high']:.2f}")
    if a["nearest_bsl"]:
        b = a["nearest_bsl"]
        lines.append(f"Nearest buy-side liquidity: {b['name']} {b['price']:.2f} ({b['price'] - a['price']:+.2f})")
    if a["nearest_ssl"]:
        b = a["nearest_ssl"]
        lines.append(f"Nearest sell-side liquidity: {b['name']} {b['price']:.2f} ({b['price'] - a['price']:+.2f})")
    lines.append(f"Volume profile (24h): POC {a['poc']:.2f}, value area {a['val']:.2f} - {a['vah']:.2f}")
    lines.append(f"Order flow (last hour): delta {a['delta_1h']:+.0f}, volume x{a['volume_1h']:.1f} normal")
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
