"""Signal book: every setup Nelson finds, followed from signal to result.

In paper mode Nelson follows each signal on price: waiting for the limit
entry, entered, then take profit or stop loss (or expired / missed). In demo
and live mode the real MT5 order decides the status. The book is saved to
JSON so the app shows the history after a restart.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

import pandas as pd

log = logging.getLogger("nelson.signals")

OPEN = ("waiting", "active")
LABELS = {
    "waiting": "Waiting for entry", "active": "Entered", "tp": "Take profit", "sl": "Stop loss",
    "breakeven": "Break-even", "closed": "Closed", "stop_out": "Stopped out", "expired": "Expired",
    "missed": "Missed (target hit first)", "not_taken": "Not taken", "skipped": "Skipped",
}


class SignalBook:
    def __init__(self, path: Path, spread: float = 0.25, keep: int = 150):
        self.path = Path(path)
        self.spread = spread
        self.keep = keep
        self.items: list[dict] = []
        self.last_bar: str | None = None
        if self.path.exists():
            try:
                data = json.loads(self.path.read_text(encoding="utf-8"))
                self.items, self.last_bar = data.get("items", []), data.get("last_bar")
            except (OSError, ValueError):
                log.warning("Could not read %s - starting a new signal book", self.path)

    def save(self) -> None:
        self.items = self.items[-self.keep:]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps({"items": self.items, "last_bar": self.last_bar}, default=str),
                             encoding="utf-8")

    # ---------- adding
    def _find(self, sid: str) -> dict | None:
        return next((x for x in self.items if x["id"] == sid), None)

    def add_setup(self, s, bar_minutes: int, expiry_bars: int, rr: float, track: str,
                  status: str = "waiting", note: str = "", ticket: int | None = None) -> dict:
        """track: "price" (paper: Nelson follows the price) or "trade" (an MT5 order decides)."""
        t = pd.Timestamp(s.time)
        sid = f"{t:%Y%m%d%H%M}-{s.side}"
        existing = self._find(sid)
        if existing:
            return existing
        confirmed = t + pd.Timedelta(minutes=bar_minutes)
        item = {
            "id": sid, "kind": "signal", "time": t.isoformat(), "confirmed": confirmed.isoformat(),
            "expires": (confirmed + pd.Timedelta(minutes=bar_minutes * expiry_bars)).isoformat(),
            "side": s.side, "dir": s.direction, "entry": s.entry, "sl": s.sl, "tp": s.tp, "rr": rr,
            "risk": round(s.risk, 2), "level": s.level_name, "steps": s.steps, "reasons": s.reasons,
            "status": status, "status_time": confirmed.isoformat(), "note": note, "track": track,
            "ticket": ticket, "result_r": None, "pnl": None,
        }
        self.items.append(item)
        self.save()
        return item

    def add_skipped(self, sk: dict, bar_minutes: int) -> None:
        t = pd.Timestamp(sk["time"])
        sid = f"{t:%Y%m%d%H%M}-{sk['side']}-skip"
        if self._find(sid):
            return
        self.items.append({
            "id": sid, "kind": "skipped", "time": t.isoformat(),
            "confirmed": (t + pd.Timedelta(minutes=bar_minutes)).isoformat(), "side": sk["side"],
            "dir": 1 if sk["side"] == "BUY" else -1, "entry": sk["entry"], "sl": sk["sl"], "tp": sk["tp"],
            "steps": sk["steps"], "status": "skipped", "note": sk["reason"], "track": "none",
        })
        self.save()

    # ---------- following
    def _set(self, item: dict, status: str, when, **extra) -> tuple[dict, str]:
        item["status"] = status
        item["status_time"] = pd.Timestamp(when).isoformat()
        item.update(extra)
        return item, status

    def on_bar(self, bar_time, high: float, low: float) -> list[tuple[dict, str]]:
        """Moves paper signals along with one closed bar (bid prices). Returns (signal, new status) events."""
        t = pd.Timestamp(bar_time)
        events = []
        for x in self.items:
            if x.get("track") != "price" or x["status"] not in OPEN or t < pd.Timestamp(x["confirmed"]):
                continue
            d = x["dir"]
            worst = low if d > 0 else high + self.spread       # price that hurts the trade (bid / ask)
            best = high if d > 0 else low + self.spread
            if x["status"] == "waiting":
                if t >= pd.Timestamp(x["expires"]):
                    events.append(self._set(x, "expired", t))
                    continue
                touched = (low + self.spread <= x["entry"]) if d > 0 else (high >= x["entry"])
                if touched:
                    events.append(self._set(x, "active", t))
                elif (best - x["tp"]) * d >= 0:
                    events.append(self._set(x, "missed", t))
                    continue
                else:
                    continue
            if (worst - x["sl"]) * d <= 0:                      # stop first if both in one bar
                events.append(self._set(x, "sl", t, result_r=-1.0))
            elif (best - x["tp"]) * d >= 0 and x["status_time"] != t.isoformat():
                events.append(self._set(x, "tp", t, result_r=x["rr"]))
        if events:
            self.save()
        return events

    def by_ticket(self, ticket) -> dict | None:
        return next((x for x in self.items if x.get("ticket") is not None and str(x["ticket"]) == str(ticket)), None)

    def update_ticket(self, ticket, status: str, when, **extra) -> dict | None:
        x = self.by_ticket(ticket)
        if x is None:
            return None
        self._set(x, status, when, **extra)
        self.save()
        return x

    def recent(self, n: int = 60) -> list[dict]:
        return list(reversed(self.items[-n:]))
