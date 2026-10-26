"""Risk management. The same rules run in the backtester and on the live account."""
from __future__ import annotations

import math
from dataclasses import dataclass

from .config import RiskConfig


@dataclass
class RiskState:
    day: object = None
    day_start_balance: float = 0.0
    trades_today: int = 0
    consecutive_losses: int = 0
    peak_balance: float = 0.0
    halted: str = ""            # permanent stop (max drawdown): needs a human to restart


class RiskManager:
    def __init__(self, cfg: RiskConfig, balance: float):
        self.cfg = cfg
        self.state = RiskState(day_start_balance=balance, peak_balance=balance)

    def new_day(self, day, balance: float) -> None:
        s = self.state
        if s.day != day:
            s.day, s.day_start_balance, s.trades_today, s.consecutive_losses = day, balance, 0, 0

    def can_open(self, balance: float, equity: float, open_count: int, spread: float = 0.0) -> tuple[bool, str]:
        c, s = self.cfg, self.state
        s.peak_balance = max(s.peak_balance, balance)
        dd = (s.peak_balance - equity) / s.peak_balance * 100 if s.peak_balance else 0
        if dd >= c.max_total_drawdown_pct:
            s.halted = f"max drawdown {dd:.1f}% reached - trading halted, review before restarting"
        if s.halted:
            return False, s.halted
        day_loss = (s.day_start_balance - equity) / s.day_start_balance * 100 if s.day_start_balance else 0
        if day_loss >= c.max_daily_loss_pct:
            return False, f"daily loss limit hit ({day_loss:.1f}%)"
        if s.trades_today >= c.max_trades_per_day:
            return False, "max trades for today"
        if s.consecutive_losses >= c.max_consecutive_losses:
            return False, f"{s.consecutive_losses} losses in a row - done for today"
        if open_count >= c.max_open_positions:
            return False, "position or order already open"
        if spread > c.max_spread_usd:
            return False, f"spread {spread:.2f} too wide"
        return True, "ok"

    def lot_size(self, balance: float, loss_per_lot: float, step: float, min_lot: float, max_lot: float) -> float:
        """Lots so that hitting the stop loses risk_per_trade_pct of balance.

        `loss_per_lot` is the money lost by 1 lot from entry to stop, costs included.
        Returns 0 if even the minimum lot would risk too much (the trade is skipped
        rather than over-risked).
        """
        if loss_per_lot <= 0:
            return 0.0
        risk_money = balance * self.cfg.risk_per_trade_pct / 100
        lots = math.floor(risk_money / loss_per_lot / step + 1e-9) * step
        lots = min(lots, max_lot, self.cfg.max_lot)
        return round(lots, 2) if lots >= min_lot else 0.0

    def on_open(self) -> None:
        self.state.trades_today += 1

    def on_close(self, pnl: float, balance: float) -> None:
        s = self.state
        s.consecutive_losses = s.consecutive_losses + 1 if pnl < 0 else 0
        s.peak_balance = max(s.peak_balance, balance)
