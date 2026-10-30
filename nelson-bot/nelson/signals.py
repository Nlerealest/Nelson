"""Signal book: every setup Nelson finds, followed from signal to result.

In paper mode Nelson follows each signal on price: waiting for the limit
entry, entered, then take profit or stop loss (or expired / missed). In demo
and live mode the real MT5 order decides the status. The book is saved to
JSON so the app shows the history after a restart.

Setups Nelson did not trade (skipped by a filter, not taken, or found later
in candles that closed while Nelson was off) are followed the same way in a
separate "sim" record: what would have happened. That is what Nelson learns
from, and what the app's Missed tab shows.
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
    "offline": "Nelson was off",
}
FINAL = ("tp", "sl", "breakeven", "closed", "stop_out", "expired", "missed")


class SignalBook:
    def __init__(self, path: Path, spread: float = 0.25, keep: int = 400, pip: float = 0.10):
        self.pip = pip
        self.path = Path(path)
        self.spread = spread
        self.keep = keep
        self.items: list[dict] = []
        self.windows: list[dict] = []        # times Nelson was off (or lost the connection)
        self.last_bar: str | None = None
        if self.path.exists():
            try:
                data = json.loads(self.path.read_text(encoding="utf-8"))
                self.items, self.last_bar = data.get("items", []), data.get("last_bar")
                self.windows = data.get("windows", [])
            except (OSError, ValueError):
                log.warning("Could not read %s - starting a new signal book", self.path)

    def save(self) -> None:
        self.items = self.items[-self.keep:]
        self.windows = self.windows[-30:]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps({"items": self.items, "last_bar": self.last_bar, "windows": self.windows},
                                        default=str), encoding="utf-8")

    # ---------- adding
    def pips(self, a: float, b: float) -> float:
        """Distance between two prices in pips."""
        return round(abs(a - b) / self.pip, 1)

    def _find(self, sid: str) -> dict | None:
        return next((x for x in self.items if x["id"] == sid), None)

    def add_setup(self, s, bar_minutes: int, expiry_bars: int, rr: float, track: str,
                  status: str = "waiting", note: str = "", ticket: int | None = None,
                  offline: str | None = None, experience: list | None = None) -> dict:
        """track: "price" (paper: Nelson follows the price), "trade" (an MT5 order decides) or
        "shadow" (not traded: the would-be result is followed in item["sim"])."""
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
            "sl_pips": self.pips(s.entry, s.sl), "tp_pips": self.pips(s.entry, s.tp),
            "features": getattr(s, "features", {}) or {},
            "status": status, "status_time": confirmed.isoformat(), "note": note, "track": track,
            "ticket": ticket, "result_r": None, "pnl": None,
        }
        if track == "shadow":
            item["sim"] = {"status": "waiting", "status_time": confirmed.isoformat(), "result_r": None}
        if offline:
            item["offline"] = offline
        if experience:
            item["experience"] = experience
        self.items.append(item)
        self.save()
        return item

    def add_skipped(self, sk: dict, bar_minutes: int, expiry_bars: int = 12, rr: float = 2.5,
                    offline: str | None = None) -> dict:
        t = pd.Timestamp(sk["time"])
        sid = f"{t:%Y%m%d%H%M}-{sk['side']}-skip"
        existing = self._find(sid)
        if existing:
            return existing
        d = 1 if sk["side"] == "BUY" else -1
        confirmed = t + pd.Timedelta(minutes=bar_minutes)
        followable = (sk["entry"] - sk["sl"]) * d > 0 and (sk["tp"] - sk["entry"]) * d > 0
        item = {
            "id": sid, "kind": "skipped", "time": t.isoformat(), "confirmed": confirmed.isoformat(),
            "expires": (confirmed + pd.Timedelta(minutes=bar_minutes * expiry_bars)).isoformat(),
            "side": sk["side"], "dir": d, "entry": sk["entry"], "sl": sk["sl"], "tp": sk["tp"], "rr": rr,
            "sl_pips": self.pips(sk["entry"], sk["sl"]), "tp_pips": self.pips(sk["entry"], sk["tp"]),
            "steps": sk["steps"], "features": sk.get("features", {}), "status": "skipped", "note": sk["reason"],
            "track": "shadow" if followable else "none",
        }
        if followable:
            item["sim"] = {"status": "waiting", "status_time": confirmed.isoformat(), "result_r": None}
        if offline:
            item["offline"] = offline
        self.items.append(item)
        self.save()
        return item

    def add_window(self, window: dict) -> None:
        if not any(w["id"] == window["id"] for w in self.windows):
            self.windows.append(window)
            self.save()

    # ---------- following
    def _set(self, item: dict, status: str, when, holder: dict | None = None, **extra) -> tuple[dict, str]:
        h = item if holder is None else holder
        h["status"] = status
        h["status_time"] = pd.Timestamp(when).isoformat()
        if status == "active":
            h["entered"] = h["status_time"]
        h.update(extra)
        return item, status

    def on_bar(self, bar_time, high: float, low: float) -> list[tuple[dict, str]]:
        """Moves paper signals (and would-be results) along with one closed bar (bid prices).
        Returns (signal, new status) events."""
        t = pd.Timestamp(bar_time)
        events = []
        for x in self.items:
            track = x.get("track")
            h = x if track == "price" else x.get("sim") if track == "shadow" else None
            if h is None or h["status"] not in OPEN or t < pd.Timestamp(x["confirmed"]):
                continue
            if h.get("upto") and t <= pd.Timestamp(h["upto"]):  # this bar was already counted
                continue
            h["upto"] = t.isoformat()
            hold = None if h is x else h
            d = x["dir"]
            worst = low if d > 0 else high + self.spread       # price that hurts the trade (bid / ask)
            best = high if d > 0 else low + self.spread
            if h["status"] == "waiting":
                if t >= pd.Timestamp(x["expires"]):
                    events.append(self._set(x, "expired", t, hold))
                    continue
                touched = (low + self.spread <= x["entry"]) if d > 0 else (high >= x["entry"])
                if touched:
                    events.append(self._set(x, "active", t, hold))
                elif (best - x["tp"]) * d >= 0:
                    events.append(self._set(x, "missed", t, hold))
                    continue
                else:
                    continue
            if (worst - x["sl"]) * d <= 0:                      # stop first if both in one bar
                events.append(self._set(x, "sl", t, hold, result_r=-1.0, result_pips=-self.pips(x["entry"], x["sl"])))
            elif (best - x["tp"]) * d >= 0 and h["status_time"] != t.isoformat():
                events.append(self._set(x, "tp", t, hold, result_r=x["rr"], result_pips=self.pips(x["entry"], x["tp"])))
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
        """Signals and skipped setups Nelson saw live (the Signals tab)."""
        return list(reversed([x for x in self.items if not x.get("offline")][-n:]))

    # ---------- missed while Nelson was off
    def window_result(self, wid: str) -> dict:
        xs = [x for x in self.items if x.get("offline") == wid]
        sims = [x.get("sim") or {} for x in xs if x["kind"] == "signal"]
        return {
            "trades": len(sims), "setups": len(xs),
            "wins": sum(s.get("status") == "tp" for s in sims),
            "losses": sum(s.get("status") == "sl" for s in sims),
            "open": sum(s.get("status") in OPEN for s in sims),
            "no_fill": sum(s.get("status") in ("expired", "missed") for s in sims),
            "result_r": round(sum(s.get("result_r") or 0 for s in sims), 2),
            "result_pips": round(sum(s.get("result_pips") or 0 for s in sims), 1),
        }

    def missed(self, n: int = 80) -> dict:
        windows = [{**w, **self.window_result(w["id"])} for w in reversed(self.windows)]
        items = list(reversed([x for x in self.items if x.get("offline")][-n:]))
        return {"windows": windows, "items": items}
