"""Backtester: replays history bar by bar with realistic costs.

* Data is BID prices (what MT5 charts show). Buys fill and sells close at ASK
  (bid + spread).
* Limit orders are only active from the bar after the setup closes.
* If one bar touches both the stop and the target, the stop is assumed to hit
  first (pessimistic), and on the bar an order fills only the stop is checked.
* Slippage is charged on stop-outs, commission on every lot.
* Position size and every risk rule come from the same RiskManager used live.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .config import Config
from .risk import RiskManager
from .sessions import session_name
from .strategy import NelsonStrategy, Setup, prepare


@dataclass
class Trade:
    setup: Setup
    lots: float
    fill_index: int = -1
    fill_time: pd.Timestamp | None = None
    exit_index: int = -1
    exit_time: pd.Timestamp | None = None
    exit_reason: str = ""
    pnl: float = 0.0
    risk_money: float = 0.0
    open_lots: float = 0.0
    sl: float = 0.0
    partial_done: bool = False
    at_breakeven: bool = False

    @property
    def r_multiple(self) -> float:
        return self.pnl / self.risk_money if self.risk_money else 0.0


@dataclass
class BacktestResult:
    trades: list[Trade]
    equity: pd.Series
    initial_balance: float
    setups: int
    skipped: dict = field(default_factory=dict)

    def stats(self) -> dict:
        closed = [t for t in self.trades if t.exit_index >= 0]
        n = len(closed)
        pnl = np.array([t.pnl for t in closed]) if n else np.zeros(0)
        rs = np.array([t.r_multiple for t in closed]) if n else np.zeros(0)
        wins, losses = pnl[pnl > 0], pnl[pnl < 0]
        eq = self.equity
        dd = ((eq.cummax() - eq) / eq.cummax()).max() * 100 if len(eq) else 0.0
        days = max(1.0, (eq.index[-1] - eq.index[0]).days) if len(eq) > 1 else 1.0
        return {
            "trades": n,
            "win_rate_pct": round(len(wins) / n * 100, 1) if n else 0.0,
            "profit_factor": round(wins.sum() / -losses.sum(), 2) if len(losses) and losses.sum() else (float("inf") if len(wins) else 0.0),
            "expectancy_R": round(rs.mean(), 3) if n else 0.0,
            "avg_win_R": round(rs[rs > 0].mean(), 2) if (rs > 0).any() else 0.0,
            "avg_loss_R": round(rs[rs < 0].mean(), 2) if (rs < 0).any() else 0.0,
            "net_profit": round(pnl.sum(), 2),
            "return_pct": round(pnl.sum() / self.initial_balance * 100, 2),
            "max_drawdown_pct": round(float(dd), 2),
            "trades_per_month": round(n / days * 30.4, 1),
            "setups_found": self.setups,
        }

    def trades_frame(self) -> pd.DataFrame:
        rows = []
        for t in self.trades:
            if t.exit_index < 0:
                continue
            s = t.setup
            rows.append({
                "signal_time": s.time, "fill_time": t.fill_time, "exit_time": t.exit_time, "side": s.side,
                "session": session_name(s.time), "entry": s.entry, "sl": s.sl, "tp": s.tp, "lots": t.lots,
                "exit_reason": t.exit_reason, "pnl": round(t.pnl, 2), "R": round(t.r_multiple, 2),
                "liquidity": s.level_name, "why": "; ".join(s.reasons),
            })
        return pd.DataFrame(rows)


def run_backtest(df: pd.DataFrame, cfg: Config, news=None, prepared: bool = False) -> BacktestResult:
    f = df if prepared else prepare(df, cfg.strategy)
    setups = NelsonStrategy(cfg.strategy, news).scan(f)
    return simulate(f, setups, cfg)


def simulate(f: pd.DataFrame, setups: list[Setup], cfg: Config) -> BacktestResult:
    b, sc = cfg.backtest, cfg.strategy
    spread, slip, comm, cs = b.spread_usd, b.slippage_usd, b.commission_per_lot, b.contract_size
    t_arr = f["time"]
    h, l = f["high"].to_numpy(), f["low"].to_numpy()
    days = t_arr.dt.normalize().to_numpy()
    by_index: dict[int, list[Setup]] = {}
    for s in setups:
        by_index.setdefault(s.index, []).append(s)

    balance = b.initial_balance
    risk = RiskManager(cfg.risk, balance)
    pending: list[Trade] = []
    open_: list[Trade] = []
    done: list[Trade] = []
    skipped: dict[str, int] = {}
    eq_t, eq_v = [], []

    def close(tr: Trade, lots: float, price: float, i: int, reason: str, final: bool):
        nonlocal balance
        d = tr.setup.direction
        gain = (price - tr.setup.entry) * d * lots * cs - comm * lots
        tr.pnl += gain
        balance += gain
        tr.open_lots = round(tr.open_lots - lots, 2)
        if final or tr.open_lots <= 0:
            tr.exit_index, tr.exit_time, tr.exit_reason = i, t_arr.iat[i], reason
            open_.remove(tr)
            done.append(tr)
            risk.on_close(tr.pnl, balance)

    for i in range(len(f)):
        risk.new_day(days[i], balance)
        bid_hi, bid_lo = h[i], l[i]
        ask_hi, ask_lo = h[i] + spread, l[i] + spread

        # --- manage open trades
        for tr in list(open_):
            s, d = tr.setup, tr.setup.direction
            fresh = tr.fill_index == i
            worst = bid_lo if d > 0 else ask_hi
            best = bid_hi if d > 0 else ask_lo
            if (worst - tr.sl) * d <= 0:
                reason = "breakeven" if tr.at_breakeven else "stop"
                close(tr, tr.open_lots, tr.sl - d * slip, i, reason, True)
                continue
            if fresh:
                continue
            if (best - s.tp) * d >= 0:
                close(tr, tr.open_lots, s.tp, i, "target", True)
                continue
            part_r = s.partial_r if s.partial_r is not None else sc.partial_at_r
            be_r = s.partial_r if s.partial_r is not None else sc.breakeven_at_r
            if part_r > 0 and not tr.partial_done:
                p_price = s.entry + d * part_r * s.risk
                if (best - p_price) * d >= 0:
                    part = round(np.floor(tr.lots * sc.partial_fraction / b.volume_step) * b.volume_step, 2)
                    tr.partial_done = True
                    if 0 < part < tr.open_lots:
                        close(tr, part, p_price, i, "partial", False)
            if be_r > 0 and not tr.at_breakeven and (best - (s.entry + d * be_r * s.risk)) * d >= 0:
                tr.sl, tr.at_breakeven = s.entry, True

        # --- pending limit orders
        for tr in list(pending):
            s, d = tr.setup, tr.setup.direction
            if i > s.expiry_index:
                pending.remove(tr)
                skipped["expired"] = skipped.get("expired", 0) + 1
                continue
            filled = (ask_lo <= s.entry) if d > 0 else (bid_hi >= s.entry)
            if filled:
                pending.remove(tr)
                tr.fill_index, tr.fill_time, tr.open_lots, tr.sl = i, t_arr.iat[i], tr.lots, s.sl
                open_.append(tr)
                risk.on_open()
                # same bar may also hit the stop (checked pessimistically)
                worst = bid_lo if d > 0 else ask_hi
                if (worst - tr.sl) * d <= 0:
                    close(tr, tr.open_lots, tr.sl - d * slip, i, "stop", True)
            elif ((bid_hi if d > 0 else ask_lo) - s.tp) * d >= 0:
                pending.remove(tr)   # target reached without us: setup gone
                skipped["ran_without_fill"] = skipped.get("ran_without_fill", 0) + 1

        # --- new setups confirmed on this bar's close
        for s in by_index.get(i, []):
            ok, why = risk.can_open(balance, balance, len(open_) + len(pending), spread)
            if not ok:
                skipped[why] = skipped.get(why, 0) + 1
                continue
            loss_per_lot = (s.risk + slip) * cs + comm
            lots = risk.lot_size(balance, loss_per_lot, b.volume_step, b.min_lot, 100.0)
            if lots <= 0:
                skipped["balance too small for min lot"] = skipped.get("balance too small for min lot", 0) + 1
                continue
            tr = Trade(setup=s, lots=lots, risk_money=lots * loss_per_lot)
            if s.market:   # filled now at the close (buys pay the spread); managed from the next bar
                tr.fill_index, tr.fill_time, tr.open_lots, tr.sl = i, t_arr.iat[i], lots, s.sl
                if s.direction > 0:
                    s.entry = round(s.entry + spread, 2)
                open_.append(tr)
                risk.on_open()
            else:
                pending.append(tr)

        eq_t.append(t_arr.iat[i])
        eq_v.append(balance)

    for tr in list(open_):   # close anything still open at the end
        close(tr, tr.open_lots, f["close"].iat[-1], len(f) - 1, "end of data", True)
    eq = pd.Series(eq_v, index=pd.DatetimeIndex(eq_t)).resample("1D").last().dropna() if eq_t else pd.Series(dtype=float)
    return BacktestResult(done, eq, b.initial_balance, len(setups), skipped)
