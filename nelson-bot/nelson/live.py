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

from .api import AppServer, build_snapshot, run_action
from .config import Config
from .journal import Journal
from .mt5_broker import TIMEFRAMES, MT5Broker
from .news import NewsFilter
from .orderflow import bar_delta_proxy, tick_delta
from .report import market_brief
from .risk import RiskManager
from .sessions import _minutes
from .strategy import NelsonStrategy, prepare
from .telegram import HELP, TelegramLink

log = logging.getLogger("nelson")
STATE = Path("nelson_state.json")
CONTROL = Path("nelson_control.json")   # settings changed from the phone (pause, risk)


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
        control = json.loads(CONTROL.read_text()) if CONTROL.exists() else {}
        self.paused: bool = control.get("paused", False)
        if "risk_per_trade_pct" in control:
            cfg.risk.risk_per_trade_pct = float(control["risk_per_trade_pct"])
        tg = cfg.telegram
        self.phone = TelegramLink(tg.token, tg.chat_ids) if tg.enabled and tg.token and tg.chat_ids else None
        self.app = AppServer(cfg.app.host, cfg.app.port, cfg.app.api_key) if cfg.app.enabled else None
        self.last_f = None
        self.poll_seconds = 5.0
        self.last_setups = []
        self.last_error_alert = 0.0
        self.last_summary_day = None
        self.limit_alert_day = None
        self.confirm_close_until = 0.0

    def notify(self, text: str) -> None:
        """Logs a message and sends it to your phone (if Telegram is set up)."""
        log.info(text)
        if self.phone:
            self.phone.send(text)

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
        if self.phone:
            self.phone.start()
        if self.app:
            self.app.start()
        self.notify(f"Nelson started: {self.cfg.mode.upper()} mode, {self.cfg.symbol}, {kind} account, "
                    f"balance {acc.balance:.2f}. Placing orders: {'YES' if self.trading else 'NO (analysis only)'}"
                    f"{' - PAUSED' if self.paused else ''}. Send /help for commands.")
        self.journal.write("start", details=f"mode={self.cfg.mode} account={kind} trading={self.trading}")

    def run(self) -> None:
        self.start()
        try:
            while True:
                try:
                    self.step()
                except Exception as exc:
                    log.exception("Error in main loop (continuing)")
                    if time.time() - self.last_error_alert > 1800:
                        self.last_error_alert = time.time()
                        self.notify(f"Nelson error (still running): {exc!r}")
                time.sleep(self.poll_seconds)
        except KeyboardInterrupt:
            self.notify("Nelson stopped from the computer. Open trades keep their stop and target in MT5.")
        finally:
            if self.phone:
                self.phone.stop()
            if self.app:
                self.app.stop()
            self.broker.shutdown()

    # ---------- main step
    def step(self) -> None:
        now = self.broker.now_utc()
        acc = self.broker.account()
        self.risk.new_day(now.normalize(), acc.balance)
        self.news.refresh()
        if self.phone:
            for chat_id, text in self.phone.pending_commands():
                self.phone.send(self.handle_command(text, now), chat_id)
        if self.app:
            for pending in self.app.pending_actions():
                try:
                    pending.result = run_action(self, pending)
                except Exception as exc:
                    log.exception("App action failed")
                    pending.result = {"ok": False, "message": f"failed: {exc}"}
                pending.done.set()
        self._sync_closed(acc.balance)
        self._manage(now)
        self._daily_summary(now, acc)
        bars = self.broker.bars()
        if bars["time"].iloc[-1] != self.last_bar:
            self.last_bar = bars["time"].iloc[-1]
            self._on_new_bar(bars, now)
        if self.app:
            self.app.publish(build_snapshot(self, now, self.broker.account()))

    def _on_new_bar(self, bars: pd.DataFrame, now: pd.Timestamp) -> None:
        # real tick delta for recent bars (better than the OHLC estimate)
        recent = bars.tail(60)
        ticks = self.broker.ticks(recent["time"].iloc[0], recent["time"].iloc[-1] + pd.Timedelta(minutes=self.minutes))
        if not ticks.empty:
            bars["delta"] = bar_delta_proxy(bars)
            bars.loc[recent.index, "delta"] = tick_delta(ticks, recent["time"], self.minutes).to_numpy()
        f = prepare(bars, self.cfg.strategy, self.minutes)
        setups = self.strategy.scan(f)
        self.last_f, self.last_setups = f, setups
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
        if self.paused:
            self.journal.write("paused", side=s.side, price=s.entry, sl=s.sl, tp=s.tp, details="paused from phone")
            self.notify(f"Setup seen while PAUSED (not taken): {s.describe()}")
            return
        acc = self.broker.account()
        open_count = len(self.broker.positions()) + len(self.broker.orders())
        ok, why = self.risk.can_open(acc.balance, acc.equity, open_count, self.broker.spread())
        if not ok:
            log.info("Not taken: %s", why)
            if ("limit" in why or "halted" in why or "in a row" in why) and self.limit_alert_day != self.risk.state.day:
                self.limit_alert_day = self.risk.state.day
                self.notify(f"Nelson has stopped taking trades: {why}")
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
            self.notify(f"[PAPER - no order sent] {s.describe()} | {lots:.2f} lots")
            self.journal.write("paper_signal", side=s.side, price=s.entry, sl=s.sl, tp=s.tp, lots=lots,
                               details="; ".join(s.reasons))
            return
        res = self.broker.place_limit(s.direction, lots, s.entry, s.sl, s.tp, f"Nelson {s.level_name}")
        self.trades[str(res.order)] = {"risk": s.risk, "partial": False, "dir": s.direction, "entry": s.entry,
                                       "expires": str(pd.Timestamp(s.time) + pd.Timedelta(minutes=self.minutes * (self.cfg.strategy.order_expiry_bars + 1)))}
        self._save()
        self.notify(f"ORDER #{res.order}: {s.side} {lots:.2f} lots XAUUSD limit {s.entry:.2f}, SL {s.sl:.2f}, "
                    f"TP {s.tp:.2f} (risking {lots * loss:.2f})\nWhy: " + "; ".join(s.reasons))
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
                self.notify(f"Cancelled order #{o.ticket}: {flatten or 'not filled in time'}")

        sc = self.cfg.strategy
        for p in self.broker.positions():
            info = self.trades.setdefault(str(p.ticket), {"risk": abs(p.price_open - p.sl) if p.sl else 0.0,
                                                          "partial": False, "dir": 1 if self.broker.is_buy(p) else -1})
            if flatten:
                self.broker.close(p, comment="Nelson flat")
                self.journal.write("flatten", ticket=p.ticket, details=flatten)
                self.notify(f"Closed #{p.ticket} early because of {flatten}")
                continue
            if not info.get("filled"):
                info["filled"] = True
                self.risk.on_open()
                self.journal.write("filled", ticket=p.ticket, price=p.price_open, lots=p.volume)
                self.notify(f"FILLED #{p.ticket} at {p.price_open:.2f}, {p.volume:.2f} lots")
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
                    self.notify(f"#{p.ticket}: took partial profit on {part:.2f} lots at {p.price_current:.2f}")
                info["partial"] = True
            if sc.breakeven_at_r > 0 and gained >= sc.breakeven_at_r and (p.price_open - p.sl) * d > 0:
                self.broker.modify_sl(p, p.price_open)
                self.journal.write("breakeven", ticket=p.ticket, sl=p.price_open)
                self.notify(f"#{p.ticket}: stop moved to break-even ({p.price_open:.2f}) - this trade can no longer lose")
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
                self.notify(f"{'WIN' if pnl > 0 else 'LOSS' if pnl < 0 else 'FLAT'} #{ticket} closed: {pnl:+.2f}. "
                            f"Balance {balance:.2f}")
        self._save()

    def _save(self) -> None:
        STATE.write_text(json.dumps(self.trades, indent=1))

    def _save_control(self) -> None:
        CONTROL.write_text(json.dumps({"paused": self.paused,
                                       "risk_per_trade_pct": self.cfg.risk.risk_per_trade_pct}, indent=1))

    # ---------- phone
    def _daily_summary(self, now: pd.Timestamp, acc) -> None:
        at = self.cfg.telegram.daily_summary_utc
        if not self.phone or not at or self.last_summary_day == now.date():
            return
        if now.hour * 60 + now.minute < _minutes(at):
            return
        self.last_summary_day = now.date()
        if now.dayofweek >= 5:
            return
        self.phone.send("End of day\n" + self._status_text())

    def _status_text(self) -> str:
        acc = self.broker.account()
        st = self.risk.state
        day_pl = acc.equity - st.day_start_balance
        lines = [
            f"Nelson {self.cfg.mode.upper()} on {self.cfg.symbol}{' - PAUSED' if self.paused else ''}"
            f"{' - analysis only' if not self.trading else ''}",
            f"Balance {acc.balance:.2f} | Equity {acc.equity:.2f}",
            f"Today: {day_pl:+.2f} ({day_pl / st.day_start_balance * 100 if st.day_start_balance else 0:+.2f}%), "
            f"{st.trades_today} trade(s), {st.consecutive_losses} loss(es) in a row",
            f"Risk per trade {self.cfg.risk.risk_per_trade_pct}%",
        ]
        if st.halted:
            lines.append(f"HALTED: {st.halted}")
        for p in self.broker.positions():
            side = "BUY" if self.broker.is_buy(p) else "SELL"
            lines.append(f"Open #{p.ticket} {side} {p.volume:.2f} @ {p.price_open:.2f} SL {p.sl:.2f} TP {p.tp:.2f} "
                         f"P/L {getattr(p, 'profit', 0.0):+.2f}")
        for o in self.broker.orders():
            lines.append(f"Order #{o.ticket} {o.volume:.2f} lots @ {o.price_open:.2f} SL {o.sl:.2f} TP {o.tp:.2f}")
        if len(lines) == 4 + bool(st.halted):
            lines.append("No open trades or orders")
        return "\n".join(lines)

    def handle_command(self, text: str, now: pd.Timestamp) -> str:
        parts = text.strip().split()
        cmd = parts[0].lower().split("@")[0] if parts else ""
        arg = parts[1].lower() if len(parts) > 1 else ""
        log.info("Phone command: %s", text)
        if cmd in ("/start", "/help"):
            return HELP
        if cmd == "/status":
            return self._status_text()
        if cmd == "/brief":
            if self.last_f is None:
                return "No analysis yet - wait for the next candle to close."
            return market_brief(self.last_f, self.strategy.book, self.news, self.last_setups)
        if cmd == "/news":
            up = self.news.upcoming(now, 48) if self.news.available else None
            if up is None:
                return "News calendar unavailable - Nelson is not opening trades until it loads."
            return "High-impact USD news (next 48h):\n" + ("\n".join(
                f"- {e}{' [TIER 1]' if e.tier1 else ''}" for e in up) or "none")
        if cmd == "/journal":
            rows = self.journal.path.read_text(encoding="utf-8").strip().splitlines()[1:][-10:]
            return "Last journal entries:\n" + ("\n".join(r[:300] for r in rows) or "empty")
        if cmd == "/pause":
            return self.set_paused(True, "Telegram") + " /resume to continue."
        if cmd == "/resume":
            return self.set_paused(False, "Telegram")
        if cmd == "/closeall":
            if arg != "yes" or time.time() > self.confirm_close_until:
                if arg == "yes":
                    return "Confirmation expired. Send /closeall again."
                self.confirm_close_until = time.time() + 60
                n = len(self.broker.positions()) + len(self.broker.orders())
                return f"This closes {n} Nelson trade(s)/order(s) at market. Send '/closeall yes' within 60 s to confirm."
            self.confirm_close_until = 0.0
            return "\n".join(self.close_all("Telegram")) + "\n/resume when ready."
        if cmd == "/risk":
            try:
                value = float(arg)
            except ValueError:
                return f"Risk per trade is {self.cfg.risk.risk_per_trade_pct}%. Change it with e.g. /risk 0.5"
            return self.set_risk(value, "Telegram")[1]
        return "Unknown command. Send /help"

    # ---------- controls shared by Telegram and the Nelson app
    def set_paused(self, paused: bool, source: str) -> str:
        self.paused = paused
        self._save_control()
        self.journal.write("pause" if paused else "resume", details=f"from {source}")
        if paused:
            return "Paused. No new trades. Open trades are still managed (stops, partials, news)."
        return "Resumed. Nelson will take new setups again."

    def close_all(self, source: str) -> list[str]:
        """Cancels Nelson's orders, closes its positions at market, then pauses."""
        done = []
        for o in self.broker.orders():
            self.broker.cancel(o.ticket)
            self.trades.pop(str(o.ticket), None)
            done.append(f"Cancelled order #{o.ticket}")
        for p in self.broker.positions():
            self.broker.close(p, comment="Nelson phone close")
            done.append(f"Closed #{p.ticket} ({getattr(p, 'profit', 0.0):+.2f})")
        self._save()
        self.journal.write("closeall", details=f"from {source}: " + ", ".join(done))
        self.paused = True
        self._save_control()
        if source != "Telegram" and self.phone:
            self.phone.send(f"Close all from {source}: " + (", ".join(done) or "nothing was open"))
        return (done or ["Nothing was open."]) + ["Nelson is now PAUSED."]

    def set_risk(self, value: float, source: str) -> tuple[bool, str]:
        top = self.cfg.telegram.max_risk_pct
        if not 0.05 <= value <= top:
            return False, f"Risk must be between 0.05% and {top}% (limit set in config.yaml)."
        self.cfg.risk.risk_per_trade_pct = value
        self._save_control()
        self.journal.write("risk", details=f"risk per trade set to {value}% from {source}")
        return True, f"Risk per trade is now {value}% of balance."
