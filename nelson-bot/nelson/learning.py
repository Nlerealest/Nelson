"""How Nelson learns from the real market while it runs.

Every setup Nelson sees ends with a result on real prices: trades and paper
signals, setups a filter skipped, setups not taken, and setups found in
candles that closed while Nelson was off. Each result is stored with what the
setup looked like (the level swept, the session, H1 structure, volume, order
flow, stop size...). From that record Nelson:

1. writes a lesson after every loss: what went wrong, in plain words, checked
   again a couple of hours later (did price take the stop and then go to the
   target? did the market really turn?);
2. keeps a scorecard per kind of setup (e.g. "sweeps of the Asia high",
   "New York session", "against H1 structure");
3. stops taking a kind of setup once the evidence says it keeps losing, and
   starts again by itself if those setups (still followed on price) recover;
4. points out filters that seem to block winners. Loosening a filter is left
   to you (config.yaml, or the walk-forward optimiser), because a few lucky
   results are not proof.

Small samples lie. Rules only change behaviour after `min_samples` results,
and the win rate has to be clearly below what the target needs to break even.
"""
from __future__ import annotations

import json
import logging
import math
from pathlib import Path

import numpy as np
import pandas as pd

log = logging.getLogger("nelson.learning")

TAKEN = ("trade", "paper", "offline")          # setups that passed every filter
LOSS_STATUSES = ("sl", "stop_out")
DONE_PRICE = ("tp", "sl", "breakeven", "closed", "stop_out", "expired", "missed")

CAUSES = {
    "stop_hunt": "Stop hunted",
    "failed_fast": "Failed straight away",
    "structure_flip": "H1 structure flipped",
    "against_trend": "Against H1 structure",
    "wrong_zone": "Wrong side of the range",
    "weak_volume": "Weak sweep volume",
    "delta_disagrees": "Order flow disagreed",
    "tight_stop": "Tight stop",
    "weak_displacement": "Weak displacement",
    "thin_session": "Thin session",
    "real_reversal": "Market really turned",
    "clean_loss": "Normal loss",
}


def _wilson(wins: int, n: int, z: float = 1.0) -> tuple[float, float]:
    if n == 0:
        return 0.0, 1.0
    p = wins / n
    den = 1 + z * z / n
    mid = (p + z * z / (2 * n)) / den
    half = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)) / den
    return max(0.0, mid - half), min(1.0, mid + half)


def buckets(ft: dict) -> list[tuple[str, str]]:
    """The kinds a setup belongs to, as (key, plain label)."""
    out = []
    if ft.get("strategy"):
        out.append((f"strategy:{ft['strategy']}", f"Strategy: {ft['strategy'].replace('_', ' ')}"))
    if ft.get("regime"):
        out.append((f"regime:{ft['regime']}", f"{ft['regime'].capitalize()} market"))
    if ft.get("level"):
        out.append((f"level:{ft['level']}", f"Sweeps of the {ft['level']}"))
    if ft.get("session"):
        out.append((f"session:{ft['session']}", f"{ft['session']} session"))
    if ft.get("side"):
        out.append((f"side:{ft['side']}", f"{ft['side']} setups"))
    if "trend_aligned" in ft:
        out.append(("trend:with" if ft["trend_aligned"] else "trend:against",
                    "With H1 structure" if ft["trend_aligned"] else "Against H1 structure"))
    if ft.get("zone_ok") is not None:
        out.append(("zone:right" if ft["zone_ok"] else "zone:wrong",
                    "Right side of the range" if ft["zone_ok"] else "Wrong side of the range"))
    if "volume_spike" in ft:
        out.append(("volume:spike" if ft["volume_spike"] else "volume:normal",
                    "Stop-run volume on the sweep" if ft["volume_spike"] else "Normal volume on the sweep"))
    if "delta_agrees" in ft:
        out.append(("delta:agrees" if ft["delta_agrees"] else "delta:disagrees",
                    "Order flow agreed" if ft["delta_agrees"] else "Order flow disagreed"))
    if "daily_aligned" in ft:
        out.append(("daily:with" if ft["daily_aligned"] else "daily:against",
                    "With the daily bias" if ft["daily_aligned"] else "Against the daily bias"))
    if "h4_aligned" in ft:
        out.append(("h4:with" if ft["h4_aligned"] else "h4:against",
                    "4-hour structure agreeing" if ft["h4_aligned"] else "4-hour structure against"))
    sl = ft.get("sl_atr")
    if sl is not None:
        kind = "tight" if sl < 0.8 else "wide" if sl > 2.5 else "normal"
        out.append((f"stop:{kind}", {"tight": "Tight stops (under 0.8 ATR)", "wide": "Wide stops (over 2.5 ATR)",
                                     "normal": "Normal stops (0.8-2.5 ATR)"}[kind]))
    body = ft.get("body_atr")
    if body is not None:
        strong = body >= 1.5
        out.append(("push:strong" if strong else "push:normal",
                    "Strong displacement (1.5+ ATR)" if strong else "Ordinary displacement"))
    return out


def filter_of(reason: str) -> str | None:
    """Which strategy filter a skip reason belongs to (None for risk limits, pause, etc.)."""
    r = (reason or "").lower()
    for prefix, name in (("against h1", "H1 structure"), ("buying in premium", "Premium / discount"),
                         ("selling in discount", "Premium / discount"), ("sweep volume", "Stop-run volume"),
                         ("delta", "Order flow"), ("outside london", "Killzones"), ("late friday", "Late Friday"),
                         ("stop ", "Stop size"), ("news", "News"), ("lesson:", "Lessons")):
        if r.startswith(prefix):
            return name
    return None


class Learner:
    def __init__(self, path: Path, cfg, rr: float = 2.5):
        self.path = Path(path)
        self.cfg = cfg
        self.rr = rr
        self.outcomes: list[dict] = []
        self.lessons: list[dict] = []
        if self.path.exists():
            try:
                data = json.loads(self.path.read_text(encoding="utf-8"))
                self.outcomes, self.lessons = data.get("outcomes", []), data.get("lessons", [])
            except (OSError, ValueError):
                log.warning("Could not read %s - starting a new learning record", self.path)
        self._seen = {o["id"] for o in self.outcomes}

    def save(self) -> None:
        self.outcomes = self.outcomes[-1500:]
        self.lessons = self.lessons[-200:]
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(json.dumps({"outcomes": self.outcomes, "lessons": self.lessons}, default=str),
                             encoding="utf-8")

    @property
    def breakeven_rate(self) -> float:
        return 1 / (1 + self.rr)

    # ---------- collecting results
    @staticmethod
    def _result(x: dict) -> tuple[str, dict] | None:
        """(source, holder with the final status) for a finished setup, else None."""
        track = x.get("track")
        if x.get("offline"):
            source = "offline" if x["kind"] == "signal" else "filtered"
        elif track == "trade":
            source = "trade"
        elif track == "price":
            source = "paper"
        else:
            source = "filtered"
        h = x.get("sim") if track == "shadow" else x if track in ("price", "trade") else None
        if not h or h.get("status") not in DONE_PRICE:
            return None
        return source, h

    def _record(self, x: dict, source: str, h: dict) -> dict | None:
        status = h["status"]
        if status in ("expired", "missed"):
            return None                       # never filled: nothing to learn about the trade itself
        r = h.get("result_r")
        if r is None and x.get("result_r") is not None:
            r = x["result_r"]
        if r is None:
            if status == "sl":
                r = -1.0
            elif status == "tp":
                r = x.get("rr", self.rr)
            elif status == "breakeven":
                r = 0.0
        pnl = x.get("pnl")
        win = (r > 0) if r is not None else (pnl or 0) > 0
        loss = (r < 0) if r is not None else (pnl or 0) < 0
        return {"id": x["id"], "kind": x["kind"], "time": x.get("confirmed"), "end": h.get("status_time"),
                "source": source,
                "side": x["side"], "level": x.get("level") or (x.get("features") or {}).get("level"),
                "features": x.get("features") or {}, "status": status, "result_r": r, "pnl": pnl,
                "win": bool(win), "loss": bool(loss), "reason": x.get("note", "") if source == "filtered" else ""}

    def update(self, items: list[dict], f: pd.DataFrame | None = None) -> list[dict]:
        """Learns from every newly finished setup. Returns the new lessons (for phone alerts)."""
        if not self.cfg.enabled:
            return []
        new_lessons, changed = [], False
        for x in items:
            if x["id"] in self._seen or not x.get("features"):
                continue
            got = self._result(x)
            if got is None:
                continue
            self._seen.add(x["id"])
            rec = self._record(x, *got)
            if rec is None:
                continue
            self.outcomes.append(rec)
            changed = True
            if rec["loss"] and rec["source"] in TAKEN:
                lesson = self._lesson(x, rec, got[1], f)
                self.lessons.append(lesson)
                new_lessons.append(lesson)
        if f is not None:
            changed |= self._review(f)
        if changed:
            self.save()
        return new_lessons

    # ---------- lessons
    def _path_after(self, f: pd.DataFrame | None, start, end=None) -> pd.DataFrame | None:
        if f is None or start is None or not len(f):
            return None
        t = f["time"]
        m = t >= pd.Timestamp(start)
        if end is not None:
            m &= t <= pd.Timestamp(end)
        return f.loc[m]

    def _lesson(self, x: dict, rec: dict, h: dict, f: pd.DataFrame | None) -> dict:
        ft = rec["features"]
        d = x["dir"]
        causes, notes = [], []
        held = self._path_after(f, h.get("entered") or x.get("confirmed"), h.get("status_time"))
        if held is not None and len(held):
            if len(held) <= 3:
                causes.append("failed_fast")
                notes.append(f"Price went to the stop within {len(held)} candle(s) of the entry: the reversal "
                             "never got going.")
            if "htf_trend" in held and ft.get("trend_aligned"):
                end_trend = int(held["htf_trend"].iat[-1])
                if end_trend == -d:
                    causes.append("structure_flip")
                    notes.append("H1 structure flipped against the trade while it was open.")
        if ft.get("trend_aligned") is False:
            causes.append("against_trend")
            notes.append("It went against H1 structure: the bigger trend was pushing the other way.")
        if ft.get("zone_ok") is False:
            causes.append("wrong_zone")
            notes.append(f"A {x['side']} on the wrong side of the H1 range "
                         f"({'premium' if d > 0 else 'discount'}): poor value.")
        if ft.get("volume_spike") is False:
            causes.append("weak_volume")
            notes.append(f"The sweep candle only had volume x{ft.get('rel_volume', 0):.1f} normal: "
                         "probably not a real stop run.")
        if ft.get("delta_agrees") is False:
            causes.append("delta_disagrees")
            notes.append("Order flow (delta) was against the new direction.")
        if (ft.get("sl_atr") or 9) < 0.8:
            causes.append("tight_stop")
            notes.append(f"The stop was only {ft['sl_atr']:.1f} ATR away: normal gold noise reaches that.")
        if (ft.get("body_atr") or 9) < 1.2:
            causes.append("weak_displacement")
            notes.append(f"The displacement candle was modest ({ft['body_atr']:.1f}x ATR): weak conviction.")
        if ft.get("session") in ("New York PM", "Rollover / thin market", "Asia"):
            causes.append("thin_session")
            notes.append(f"It came in the {ft['session']} session, when gold is thinner and less reliable.")
        if not causes:
            causes.append("clean_loss")
            notes.append(f"Every step lined up. At {self.rr:g}R Nelson can lose about "
                         f"{round((1 - self.breakeven_rate) * 10)} of 10 trades and still break even, so one "
                         "clean loss is not a reason to change anything.")
        record = self._worst_record(ft)
        if record:
            notes.append(record)
        main = causes[0]
        return {
            "id": f"{x['id']}-lesson", "signal_id": x["id"], "time": h.get("status_time"), "side": x["side"],
            "level": rec["level"], "source": rec["source"], "entry": x.get("entry"), "sl": x.get("sl"),
            "tp": x.get("tp"), "cause": main, "causes": causes, "title": CAUSES[main], "notes": notes,
            "follow_up": None, "reviewed": False,
        }

    def _review(self, f: pd.DataFrame) -> bool:
        """A couple of hours after a stop: did price then go to the target (stop hunt), or keep going?"""
        changed = False
        bars = self.cfg.review_bars
        for les in self.lessons:
            if les["reviewed"] or not les.get("time") or les.get("sl") is None:
                continue
            after = f[f["time"] > pd.Timestamp(les["time"])]
            if len(after) < bars:
                if len(f) and pd.Timestamp(les["time"]) < f["time"].iat[0]:
                    les["reviewed"] = changed = True      # too old to check any more
                continue
            after = after.head(bars)
            d = 1 if les["side"] == "BUY" else -1
            risk = abs(les["entry"] - les["sl"]) or 1.0
            best = after["high"].max() if d > 0 else after["low"].min()
            worst = after["low"].min() if d > 0 else after["high"].max()
            hours = bars * f.attrs.get("bar_minutes", 5) / 60
            if (best - les["tp"]) * d >= 0:
                les["follow_up"] = (f"Within {hours:g} h of the stop, price went on to the target "
                                    f"{les['tp']:.2f}. The idea was right; the stop sat where other traders' "
                                    "stops were and got swept.")
                les["causes"] = ["stop_hunt"] + [c for c in les["causes"] if c != "clean_loss"]
                les["cause"], les["title"] = "stop_hunt", CAUSES["stop_hunt"]
            else:
                beyond = (les["sl"] - worst) * d / risk
                if beyond >= 2:
                    les["follow_up"] = (f"Price kept going {beyond:.1f}R past the stop: the market really turned. "
                                        "The read was wrong, not the stop.")
                    if "real_reversal" not in les["causes"]:
                        les["causes"].append("real_reversal")
                else:
                    les["follow_up"] = f"Price stayed around the stop for the next {hours:g} h without reaching the target."
            les["reviewed"] = changed = True
        return changed

    # ---------- scorecards and rules
    def eligible(self) -> list[dict]:
        """Results of setups that passed every filter (traded, paper, missed while off, or not taken
        because of a pause, a risk limit or a lesson): what the rules are judged on."""
        return [o for o in self.outcomes if o.get("kind", "signal") == "signal"]

    def stats(self, outcomes: list[dict] | None = None) -> dict[str, dict]:
        rows: dict[str, dict] = {}
        for o in (self.eligible() if outcomes is None else outcomes):
            for key, label in buckets(o["features"]):
                b = rows.setdefault(key, {"key": key, "label": label, "results": []})
                b["results"].append(o)
        out = {}
        for key, b in rows.items():
            recent = b["results"][-self.cfg.window:]
            n = len(recent)
            wins = sum(o["win"] for o in recent)
            rs = [o["result_r"] for o in recent if o["result_r"] is not None]
            out[key] = {"key": key, "label": b["label"], "n": n, "wins": wins,
                        "losses": sum(o["loss"] for o in recent), "win_rate": round(wins / n * 100) if n else 0,
                        "avg_r": round(float(np.mean(rs)), 2) if rs else 0.0}
        return out

    def rules(self) -> list[dict]:
        """Kinds of setup Nelson now avoids, because they keep losing on real prices."""
        out = []
        for b in self.stats().values():
            if b["n"] < self.cfg.min_samples or b["avg_r"] > self.cfg.avoid_below_r:
                continue
            _, hi = _wilson(b["wins"], b["n"])
            if hi < self.breakeven_rate:
                out.append({**b, "text": f"{b['label']}: won {b['wins']} of {b['n']} ({b['avg_r']:+.2f}R average). "
                                         "Nelson skips these until they recover."})
        return sorted(out, key=lambda b: b["avg_r"])

    def blocking_rule(self, features: dict) -> dict | None:
        if not (self.cfg.enabled and self.cfg.apply_lessons and features):
            return None
        keys = {k for k, _ in buckets(features)}
        return next((r for r in self.rules() if r["key"] in keys), None)

    def experience(self, features: dict) -> list[str]:
        """Nelson's record on setups like this one, for the signal card."""
        st = self.stats()
        out = []
        for key, label in buckets(features):
            b = st.get(key)
            if b and b["n"] >= 3 and key.split(":")[0] in ("level", "session", "trend", "volume"):
                out.append(f"{label}: {b['wins']}W / {b['losses']}L ({b['avg_r']:+.2f}R)")
        return out[:3]

    def _worst_record(self, ft: dict) -> str:
        st = self.stats()
        rows = [st[k] for k, _ in buckets(ft) if k in st and st[k]["n"] >= 4]
        if not rows:
            return ""
        b = min(rows, key=lambda r: r["avg_r"])
        return f"Nelson's record on {b['label'].lower()}: {b['wins']} won, {b['losses']} lost ({b['avg_r']:+.2f}R average)."

    def suggestions(self) -> list[dict]:
        """Filters that seem to block winners, and repeated causes of losses."""
        out = []
        by_filter: dict[str, list[dict]] = {}
        for o in self.outcomes:
            name = filter_of(o.get("reason", "")) if o["source"] == "filtered" else None
            if name and name != "Lessons":
                by_filter.setdefault(name, []).append(o)
        for name, rows in by_filter.items():
            rows = rows[-self.cfg.window:]
            wins = sum(o["win"] for o in rows)
            lo, hi = _wilson(wins, len(rows))
            if len(rows) >= 10 and lo > self.breakeven_rate:
                out.append({"kind": "filter", "title": f"The {name} filter may be too strict",
                            "text": f"Setups it skipped would have won {wins} of {len(rows)}. Nelson keeps the "
                                    "filter on; test a change with the optimiser before switching it off."})
            elif len(rows) >= 10 and hi < self.breakeven_rate:
                out.append({"kind": "filter_ok", "title": f"The {name} filter is protecting you",
                            "text": f"Setups it skipped would have won only {wins} of {len(rows)}."})
        recent = self.lessons[-12:]
        counts: dict[str, int] = {}
        for les in recent:
            for c in les["causes"]:
                counts[c] = counts.get(c, 0) + 1
        tips = {
            "stop_hunt": "Stops keep getting swept before price goes to the target. A slightly wider stop buffer "
                         "(strategy.sl_buffer_atr, e.g. 0.2 -> 0.3) keeps the same money risk with a smaller lot.",
            "tight_stop": "Tight stops keep getting hit. Raising strategy.min_sl_atr skips the tightest setups.",
            "failed_fast": "Entries keep failing straight away. Waiting for a stronger displacement "
                           "(strategy.displacement_atr) filters weak reversals.",
            "weak_displacement": "Weak displacements keep losing. Try a higher strategy.displacement_atr in the optimiser.",
            "thin_session": "Losses cluster in thin sessions. Narrow strategy.killzones_utc to the busiest hours.",
        }
        for cause, n in sorted(counts.items(), key=lambda kv: -kv[1]):
            if n >= 3 and cause in tips:
                out.append({"kind": "pattern", "title": f"{CAUSES[cause]}: {n} of the last {len(recent)} losses",
                            "text": tips[cause]})
        return out

    def summary(self) -> dict:
        st = self.stats()
        def taken(o): return o["source"] in TAKEN
        mine = [o for o in self.outcomes if taken(o)]
        rs = [o["result_r"] for o in mine if o["result_r"] is not None]
        ranked = [b for b in st.values() if b["n"] >= 5]
        causes: dict[str, int] = {}
        for les in self.lessons:
            causes[les["cause"]] = causes.get(les["cause"], 0) + 1
        return {
            "enabled": self.cfg.enabled, "apply_lessons": self.cfg.apply_lessons,
            "min_samples": self.cfg.min_samples, "breakeven_win_rate": round(self.breakeven_rate * 100),
            "results": len(self.outcomes),
            "by_source": {s: sum(o["source"] == s for o in self.outcomes) for s in ("trade", "paper", "offline", "filtered")},
            "taken": {"n": len(mine), "wins": sum(o["win"] for o in mine), "losses": sum(o["loss"] for o in mine),
                      "avg_r": round(float(np.mean(rs)), 2) if rs else None},
            "rules": self.rules(),
            "suggestions": self.suggestions(),
            "strengths": sorted([b for b in ranked if b["avg_r"] > 0], key=lambda b: -b["avg_r"])[:5],
            "weaknesses": sorted([b for b in ranked if b["avg_r"] <= 0], key=lambda b: b["avg_r"])[:5],
            "causes": sorted([{"cause": c, "label": CAUSES.get(c, c), "count": n} for c, n in causes.items()],
                             key=lambda r: -r["count"]),
            "lessons": list(reversed(self.lessons[-40:])),
        }
