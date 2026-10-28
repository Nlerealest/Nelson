"""Demo mode: try the Nelson app without MetaTrader 5.

Replays generated XAUUSD-like prices through the real bot and API, one candle
every few seconds, and simulates order fills and exits. Nothing here touches
a broker. Prices are practice data, not the real market.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pandas as pd

log = logging.getLogger("nelson.demo")


def practice_prices(days: int = 30, seed: int = 4) -> pd.DataFrame:
    """Random-walk M5 bars around $2,350 with London/New York volatility and occasional stop runs."""
    rng = np.random.default_rng(seed)
    end = pd.Timestamp.utcnow().tz_localize(None).floor("5min")
    t = pd.date_range(end=end, periods=days * 288, freq="5min")
    t = t[t.dayofweek < 5]
    hours = t.hour.to_numpy()
    vol = np.where((hours >= 7) & (hours < 17), 1.3, 0.6)
    steps = rng.standard_t(4, len(t)) * vol * 0.8
    close = 2350 + np.cumsum(steps)
    open_ = np.r_[close[0], close[:-1]]
    spike = rng.random(len(t)) < 0.01
    wick = np.abs(rng.normal(0, 0.5, (2, len(t)))) * vol + spike * rng.uniform(1.5, 4.0, len(t))
    up = rng.random(len(t)) < 0.5
    high = np.maximum(open_, close) + np.where(up, wick[0], wick[0] * 0.3)
    low = np.minimum(open_, close) - np.where(~up, wick[1], wick[1] * 0.3)
    tv = (rng.integers(80, 160, len(t)) * vol * (1 + spike * 2)).astype(float)
    return pd.DataFrame({"time": t, "open": open_, "high": high, "low": low, "close": close, "tick_volume": tv})


class ReplayBroker:
    """Looks like MT5Broker to the bot; trades against replayed candles."""

    def __init__(self, cfg, bars: pd.DataFrame, start: int, seconds_per_bar: float = 5.0):
        self.cfg, self.all, self.n = cfg, bars.reset_index(drop=True), start
        self.secs = seconds_per_bar
        self.last_advance = time.time()
        self.balance = 10_000.0
        self.orders_: list = []
        self.positions_: list = []
        self.results: dict[int, float] = {}
        self.reasons: dict[int, str] = {}
        self.next_ticket = 5001
        self.spread_usd = 0.25

    # time moves forward one candle every `secs` seconds, never more than one per bot step,
    # so the bot analyses every candle like it would live
    def _advance(self) -> None:
        if time.time() - self.last_advance >= self.secs and self.n < len(self.all) - 1:
            self.last_advance = time.time()
            self.n += 1
            self._simulate(self.all.iloc[self.n - 1])

    def _simulate(self, bar) -> None:
        cs = self.cfg.backtest.contract_size
        for o in list(self.orders_):
            hit = (bar.low + self.spread_usd <= o.price_open) if o.d > 0 else (bar.high >= o.price_open)
            if hit:
                self.orders_.remove(o)
                self.positions_.append(SimpleNamespace(ticket=o.ticket, volume=o.volume, price_open=o.price_open,
                                                       sl=o.sl, tp=o.tp, d=o.d, price_current=o.price_open,
                                                       profit=0.0, realised=0.0))
        for p in list(self.positions_):
            worst = bar.low if p.d > 0 else bar.high + self.spread_usd
            best = bar.high if p.d > 0 else bar.low + self.spread_usd
            exit_px = p.sl if (worst - p.sl) * p.d <= 0 else p.tp if (best - p.tp) * p.d >= 0 else None
            p.price_current = float(bar.close if p.d > 0 else bar.close + self.spread_usd)
            p.profit = (p.price_current - p.price_open) * p.d * p.volume * cs
            if exit_px is not None:
                pnl = (exit_px - p.price_open) * p.d * p.volume * cs + p.realised
                self.balance += (exit_px - p.price_open) * p.d * p.volume * cs
                self.results[p.ticket] = pnl
                self.reasons[p.ticket] = "sl" if exit_px == p.sl else "tp"
                self.positions_.remove(p)

    # ---------- MT5Broker interface
    def connect(self): log.info("DEMO: replaying practice prices, one candle every %.0fs", self.secs)
    def shutdown(self): pass
    def account_kind(self): return "demo"
    def now_utc(self):
        self._advance()
        return self.all["time"].iat[self.n - 1] + pd.Timedelta(minutes=5, seconds=2)
    def account(self):
        equity = self.balance + sum(p.profit for p in self.positions_)
        return SimpleNamespace(balance=round(self.balance, 2), equity=round(equity, 2), currency="USD")
    def bars(self): return self.all.iloc[max(0, self.n - 3000):self.n].reset_index(drop=True)
    def ticks(self, a, b): return pd.DataFrame(columns=["time", "bid", "ask", "flags"])
    def tick(self):
        c = float(self.all["close"].iat[self.n - 1])
        return SimpleNamespace(bid=round(c, 2), ask=round(c + self.spread_usd, 2))
    def spread(self): return self.spread_usd
    def loss_per_lot(self, d, e, sl): return abs(e - sl) * self.cfg.backtest.contract_size
    def volume_limits(self): return 0.01, 0.01, 100.0
    def place_limit(self, d, lots, price, sl, tp, comment):
        o = SimpleNamespace(ticket=self.next_ticket, volume=lots, price_open=price, sl=sl, tp=tp, d=d)
        self.next_ticket += 1
        self.orders_.append(o)
        return SimpleNamespace(order=o.ticket)
    def cancel(self, ticket): self.orders_ = [o for o in self.orders_ if o.ticket != ticket]
    def orders(self): return list(self.orders_)
    def positions(self): return list(self.positions_)
    def is_buy(self, p): return p.d > 0
    def close(self, p, lots=None, comment=""):
        cs = self.cfg.backtest.contract_size
        lots = p.volume if lots is None else lots
        gain = (p.price_current - p.price_open) * p.d * lots * cs
        self.balance += gain
        p.realised += gain
        p.volume = round(p.volume - lots, 2)
        if p.volume <= 0:
            self.results[p.ticket] = p.realised
            self.positions_.remove(p)
    def modify_sl(self, p, sl): p.sl = sl
    def position_result(self, ticket): return self.results.get(int(ticket), 0.0)
    def position_close(self, ticket): return self.results.get(int(ticket), 0.0), self.reasons.get(int(ticket), "closed")


def run_demo(cfg, seconds_per_bar: float = 5.0) -> None:
    from . import live
    from .news import Event, NewsFilter

    cfg.mode = "demo"
    # practice prices are random, so relax the filters or the demo would almost never trade
    st = cfg.strategy
    st.use_htf_bias = st.use_premium_discount = st.require_volume_spike = False
    st.displacement_atr, st.min_fvg_atr = 0.6, 0.05
    st.killzones_utc = [("00:00", "23:59")]
    st.avoid_friday_after_utc = ""
    cfg.risk.close_friday_utc = ""
    bars = practice_prices()
    # start the replay ~15 candles before a setup, so a trade shows up within a minute or two
    from .strategy import NelsonStrategy, prepare
    found = [x.index for x in NelsonStrategy(cfg.strategy).scan(prepare(bars, cfg.strategy, 5)) if x.index >= 3015]
    start = found[0] - 15 if found else len(bars) - 288 * 3
    broker = ReplayBroker(cfg, bars, start=start, seconds_per_bar=seconds_per_bar)
    live.MT5Broker = lambda _cfg: broker   # the bot talks to the replay instead of MT5
    # keep demo state apart from the real bot's pause/risk/trade files, and start fresh each time
    Path(cfg.log_dir).mkdir(parents=True, exist_ok=True)
    live.STATE, live.CONTROL = Path(cfg.log_dir) / "demo_state.json", Path(cfg.log_dir) / "demo_control.json"
    for f in (live.STATE, live.CONTROL, Path(cfg.log_dir) / "signals.json", Path(cfg.log_dir) / "learning.json"):
        f.unlink(missing_ok=True)
    bot = live.NelsonBot(cfg)
    # a couple of made-up upcoming events so the News screen has something to show
    now = broker.now_utc()
    fake = [Event(now + pd.Timedelta(hours=5), "USD", "High", "CPI m/m (practice event)", "0.3%", "0.2%"),
            Event(now + pd.Timedelta(hours=26), "USD", "High", "Unemployment Claims (practice event)", "225K", "231K")]
    bot.news = NewsFilter(cfg.news, fake)
    bot.news.refresh = lambda force=False: None
    bot.strategy.news = bot.news
    bot.poll_seconds = min(5.0, seconds_per_bar / 2)
    if bot.app:
        bot.app.practice = True
    if bot.pusher:
        bot.pusher.prefix = "[PRACTICE] "
    bot.run()
