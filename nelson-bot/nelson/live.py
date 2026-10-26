"""Nelson's live loop on MetaTrader 5.

Every few seconds: manage open trades (partials, break-even, news and weekend
flattening), expire stale orders. On every new closed bar: rebuild the
analysis, and if a setup confirmed on that bar passes the risk checks, place
a limit order.
"""
from __future__ import annotations

import json
import logging
import time
from pathlib import Path

import pandas as pd

from .config import Config
from .journal import Journal
from .mt5_broker import TIMEFRAMES, MT5Broker
from .news import NewsFilter
from .orderflow import bar_delta_proxy, tick_delta
from .report import market_brief
from .risk import RiskManager
from .sessions import _minutes
from .strategy import NelsonStrategy, prepare

log = logging.getLogger("nelson")
STATE = Path("nelson_state.json")


class NelsonBot:
    def __init__(self, cfg: Config):
        self.cfg = cfg
        self.broker = MT5Broker(cfg)
        self.news = NewsFilter(cfg.news)
        self.strategy = NelsonStrategy(cfg.strategy, self.news)
        self.journal = Journal(cfg.log_dir)
        self.minutes = TIMEFRAMES[cfg.timeframe]
        self.last_bar = None
        self.last_brief_hour = None
        self.risk: RiskManager | None = None
        self.trading = cfg.mode in ("demo", "live")
        # ticket -> {"risk": initial stop distance, "partial": bool, "dir": +1/-1}
        self.trades: dict[str, dict] = json.loads(STATE.read_text()) if STATE.exists() else {}

    # ---------- start-up
    def start(self) -> None:
        self.broker.connect()
        kind = self.broker.account_kind()
        if self.trading and kind == "real" and not (self.cfg.mode == "live" and self.cfg.allow_real_money):
            log.error("This is a REAL money account. Nelson will only analyse (paper mode). To trade it set "
                      "mode: live AND allow_real_money: true in config.yaml - after testing on demo.")
            self.trading = False
        if self.cfg.mode == "demo" and kind == "real":
            self.trading = False
        acc = self.broker.account()
        self.risk = RiskManager(self.cfg.risk, acc.balance)
        self.news.refresh(force=True)
        log.info("Nelson started in %s mode on %s (%s account). Trading orders: %s",
                 self.cfg.mode.upper(), self.cfg.symbol, kind, "YES" if self.trading else "NO (analysis only)")
        self.journal.write("start", details=f"mode={self.cfg.mode} account={kind} trading={self.trading}")

    def run(self) -> None:
        self.start()
        try:
            while True:
                try:
                    self.step()
                except Exception:
                    log.exception("Error in main loop (continuing)")
                time.sleep(5)
        except KeyboardInterrupt:
            log.info("Stopped by user")
        finally:
            self.broker.shutdown()

    # ---------- main step
    def step(self) -> None:
        now = self.broker.now_utc()
        acc = self.broker.account()
        self.risk.new_day(now.normalize(), acc.balance)
        self.news.refresh()
        self._sync_closed(acc.balance)
        self._manage(now)
        bars = self.broker.bars()
        if bars["time"].iloc[-1] != self.last_bar:
            self.last_bar = bars["time"].iloc[-1]
            self._on_new_bar(bars, now)

    def _on_new_bar(self, bars: pd.DataFrame, now: pd.Timestamp) -> None:
        # real tick delta for recent bars (better than the OHLC estimate)
        recent = bars.tail(60)
        ticks = self.broker.ticks(recent["time"].iloc[0], recent["time"].iloc[-1] + pd.Timedelta(minutes=self.minutes))
        if not ticks.empty:
            bars["delta"] = bar_delta_proxy(bars)
            bars.loc[recent.index, "delta"] = tick_delta(ticks, recent["time"], self.minutes).to_numpy()
        f = prepare(bars, self.cfg.strategy, self.minutes)
        setups = self.strategy.scan(f)
        last = len(f) - 1

        if now.hour != self.last_brief_hour:
            self.last_brief_hour = now.hour
            log.info("\n%s", market_brief(f, self.strategy.book, self.news, setups))

        for i, side, why in self.strategy.rejected:
            if i == last:
                log.info("Setup %s seen but skipped: %s", side, why)
                self.journal.write("skipped", side=side, details=why)
        for s in (s for s in setups if s.index == last):
            self._take(s)

    def _take(self, s) -> None:
        log.info("SETUP: %s", s.describe())
        acc = self.broker.account()
        open_count = len(self.broker.positions()) + len(self.broker.orders())
        ok, why = self.risk.can_open(acc.balance, acc.equity, open_count, self.broker.spread())
        if not ok:
            log.info("Not taken: %s", why)
            self.journal.write("blocked", side=s.side, price=s.entry, sl=s.sl, tp=s.tp, details=why)
            return
        tick = self.broker.tick()
        market = tick.ask if s.direction > 0 else tick.bid
        if (market - s.entry) * s.direction <= 0:
            log.info("Price already beyond the entry - not chasing")
            self.journal.write("missed", side=s.side, price=s.entry, details="price already through entry")
            return
        step, vmin, vmax = self.broker.volume_limits()
        loss = self.broker.loss_per_lot(s.direction, s.entry, s.sl) + self.cfg.backtest.commission_per_lot
        lots = self.risk.lot_size(acc.balance, loss, step, vmin, vmax)
        if lots <= 0:
            log.warning("Balance too small to risk %.2f%% with the minimum lot - skipped", self.cfg.risk.risk_per_trade_pct)
            return
        if not self.trading:
            log.info("[PAPER] would place %s %.2f lots", s.side, lots)
            self.journal.write("paper_signal", side=s.side, price=s.entry, sl=s.sl, tp=s.tp, lots=lots,
                               details="; ".join(s.reasons))
            return
        res = self.broker.place_limit(s.direction, lots, s.entry, s.sl, s.tp, f"Nelson {s.level_name}")
        self.trades[str(res.order)] = {"risk": s.risk, "partial": False, "dir": s.direction, "entry": s.entry,
                                       "expires": str(pd.Timestamp(s.time) + pd.Timedelta(minutes=self.minutes * (self.cfg.strategy.order_expiry_bars + 1)))}
        self._save()
        log.info("ORDER PLACED #%s %s %.2f lots @ %.2f SL %.2f TP %.2f", res.order, s.side, lots, s.entry, s.sl, s.tp)
        self.journal.write("order", side=s.side, price=s.entry, sl=s.sl, tp=s.tp, lots=lots, ticket=res.order,
                           details="; ".join(s.reasons))

    # ---------- trade management
    def _manage(self, now: pd.Timestamp) -> None:
        r = self.cfg.risk
        tier1 = self.news.tier1_within(now, r.flatten_minutes_before_tier1) if self.cfg.news.flatten_before_tier1 else None
        friday = bool(r.close_friday_utc) and now.dayofweek == 4 and now.hour * 60 + now.minute >= _minutes(r.close_friday_utc)
        flatten = f"tier-1 news: {tier1}" if tier1 else ("weekend" if friday else "")

        for o in self.broker.orders():
            info = self.trades.get(str(o.ticket), {})
            expired = "expires" in info and now >= pd.Timestamp(info["expires"])
            if flatten or expired:
                self.broker.cancel(o.ticket)
                self.trades.pop(str(o.ticket), None)
                self.journal.write("cancel", ticket=o.ticket, details=flatten or "order expired unfilled")
                log.info("Cancelled order #%s (%s)", o.ticket, flatten or "expired")

        sc = self.cfg.strategy
        for p in self.broker.positions():
            info = self.trades.setdefault(str(p.ticket), {"risk": abs(p.price_open - p.sl) if p.sl else 0.0,
                                                          "partial": False, "dir": 1 if self.broker.is_buy(p) else -1})
            if flatten:
                self.broker.close(p, comment="Nelson flat")
                self.journal.write("flatten", ticket=p.ticket, details=flatten)
                log.info("Closed #%s before %s", p.ticket, flatten)
                continue
            if not info.get("filled"):
                info["filled"] = True
                self.risk.on_open()
                self.journal.write("filled", ticket=p.ticket, price=p.price_open, lots=p.volume)
                log.info("Order #%s filled at %.2f", p.ticket, p.price_open)
            d, risk = info["dir"], info["risk"]
            if risk <= 0:
                continue
            gained = (p.price_current - p.price_open) * d / risk
            step, vmin, _ = self.broker.volume_limits()
            if sc.partial_at_r > 0 and not info["partial"] and gained >= sc.partial_at_r:
                part = round(int(p.volume * sc.partial_fraction / step) * step, 2)
                if vmin <= part < p.volume:
                    self.broker.close(p, part, comment="Nelson partial")
                    self.journal.write("partial", ticket=p.ticket, lots=part, price=p.price_current)
                info["partial"] = True
            if sc.breakeven_at_r > 0 and gained >= sc.breakeven_at_r and (p.price_open - p.sl) * d > 0:
                self.broker.modify_sl(p, p.price_open)
                self.journal.write("breakeven", ticket=p.ticket, sl=p.price_open)
                log.info("#%s stop moved to break-even", p.ticket)
        self._save()

    def _sync_closed(self, balance: float) -> None:
        live = {str(p.ticket) for p in self.broker.positions()} | {str(o.ticket) for o in self.broker.orders()}
        for ticket in [t for t in self.trades if t not in live]:
            info = self.trades.pop(ticket)
            pnl = self.broker.position_result(int(ticket))
            if info.get("filled") or pnl != 0:   # pnl != 0 also catches a fill + exit between two polls
                if not info.get("filled"):
                    self.risk.on_open()
                self.risk.on_close(pnl, balance)
                self.journal.write("closed", ticket=ticket, pnl=round(pnl, 2))
                log.info("Trade #%s closed: %+.2f", ticket, pnl)
        self._save()

    def _save(self) -> None:
        STATE.write_text(json.dumps(self.trades, indent=1))
