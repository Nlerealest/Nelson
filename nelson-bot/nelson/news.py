"""Economic news filter.

Gold reacts violently to US data (NFP, CPI, FOMC...). Spreads widen, price
whips through both sides and stops slip. Nelson does not open trades around
high-impact USD events and can close positions before the biggest ones.

Live calendar: the free ForexFactory weekly feed. Backtests: a CSV of past
events (date,currency,impact,title) via news.history_csv.
"""
from __future__ import annotations

import json
import logging
import time
from dataclasses import dataclass
from datetime import timedelta
from pathlib import Path

import pandas as pd

from .config import NewsConfig

log = logging.getLogger("nelson.news")
CACHE = Path(".news_cache.json")


@dataclass
class Event:
    time: pd.Timestamp     # UTC, naive
    currency: str
    impact: str
    title: str
    forecast: str = ""
    previous: str = ""
    tier1: bool = False

    def __str__(self) -> str:
        extra = f" (forecast {self.forecast}, previous {self.previous})" if self.forecast or self.previous else ""
        return f"{self.time:%a %H:%M} UTC {self.currency} {self.title}{extra}"


class NewsFilter:
    def __init__(self, cfg: NewsConfig, events: list[Event] | None = None):
        self.cfg = cfg
        self.events: list[Event] = []
        self.available = events is not None
        self._loaded_at = 0.0
        if events is not None:
            self._set(events)

    def _set(self, events: list[Event]) -> None:
        keys = [k.lower() for k in self.cfg.tier1_keywords]
        cur = {c.upper() for c in self.cfg.currencies}
        imp = {i.lower() for i in self.cfg.impacts}
        out = []
        for e in events:
            if e.currency.upper() in cur and e.impact.lower() in imp:
                e.tier1 = any(k in e.title.lower() for k in keys)
                out.append(e)
        self.events = sorted(out, key=lambda e: e.time)

    # ---------- loading
    @classmethod
    def from_csv(cls, cfg: NewsConfig, path: str) -> "NewsFilter":
        df = pd.read_csv(path)
        times = pd.to_datetime(df["date"], utc=True).dt.tz_localize(None)
        events = [Event(t, str(r.currency), str(r.impact), str(r.title)) for t, r in zip(times, df.itertuples())]
        return cls(cfg, events)

    @staticmethod
    def parse_forexfactory(items: list[dict]) -> list[Event]:
        out = []
        for it in items:
            try:
                t = pd.Timestamp(it["date"]).tz_convert("UTC").tz_localize(None)
            except (KeyError, ValueError, TypeError):
                continue
            out.append(Event(t, it.get("country", ""), it.get("impact", ""), it.get("title", ""),
                             str(it.get("forecast", "") or ""), str(it.get("previous", "") or "")))
        return out

    def refresh(self, force: bool = False) -> None:
        """Loads the live calendar, at most once per cache period."""
        if not self.cfg.enabled:
            return
        age = time.time() - self._loaded_at
        if not force and self.available and age < self.cfg.cache_minutes * 60:
            return
        items = None
        try:
            import requests
            r = requests.get(self.cfg.calendar_url, timeout=15, headers={"User-Agent": "Mozilla/5.0 Nelson/1.0"})
            r.raise_for_status()
            items = r.json()
            CACHE.write_text(json.dumps(items), encoding="utf-8")
        except Exception as exc:  # network down, rate limited...
            log.warning("News calendar download failed (%s)", exc)
            if CACHE.exists() and time.time() - CACHE.stat().st_mtime < 7 * 86400:
                items = json.loads(CACHE.read_text(encoding="utf-8"))
                log.info("Using cached news calendar")
        if items is None:
            self.available = False
            return
        self._set(self.parse_forexfactory(items))
        self.available = True
        self._loaded_at = time.time()

    # ---------- queries
    def _window(self, e: Event) -> tuple[pd.Timestamp, pd.Timestamp]:
        before = self.cfg.tier1_minutes_before if e.tier1 else self.cfg.minutes_before
        after = self.cfg.tier1_minutes_after if e.tier1 else self.cfg.minutes_after
        return e.time - timedelta(minutes=before), e.time + timedelta(minutes=after)

    def blocked(self, t: pd.Timestamp) -> tuple[bool, Event | str | None]:
        """Is opening a trade at UTC time t forbidden because of news?"""
        if not self.cfg.enabled:
            return False, None
        if not self.available:
            return (True, "news calendar unavailable") if self.cfg.block_if_unavailable else (False, None)
        for e in self.events:
            start, end = self._window(e)
            if start <= t <= end:
                return True, e
            if start > t:
                break
        return False, None

    def tier1_within(self, t: pd.Timestamp, minutes: int) -> Event | None:
        for e in self.events:
            if e.tier1 and t <= e.time <= t + timedelta(minutes=minutes):
                return e
        return None

    def upcoming(self, t: pd.Timestamp, hours: int = 24) -> list[Event]:
        return [e for e in self.events if t <= e.time <= t + timedelta(hours=hours)]
