"""Thin wrapper around the official MetaTrader5 Python package (Windows only).

Everything that talks to the broker lives here, so the strategy and risk code
stay testable without MT5.
"""
from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pandas as pd

log = logging.getLogger("nelson.mt5")

try:
    import MetaTrader5 as mt5
except ImportError:  # Linux / Mac: backtests still work
    mt5 = None

TIMEFRAMES = {"M1": 1, "M5": 5, "M15": 15, "M30": 30, "H1": 60}


class BrokerError(RuntimeError):
    pass


def find_gold_symbol(symbols) -> str | None:
    """Finds the broker's spot gold vs US dollar symbol (XAUUSD, XAUUSDm, XAUUSD.r, GOLD...).

    `symbols` are MT5 symbol infos (anything with name, description, currency_base, currency_profit).
    """
    def ok(s) -> bool:
        name, desc = s.name.upper(), (getattr(s, "description", "") or "").lower()
        base, profit = (getattr(s, "currency_base", "") or "").upper(), (getattr(s, "currency_profit", "") or "").upper()
        if "XAUUSD" in name:
            return True
        if base == "XAU" and profit == "USD":
            return True
        return "gold" in desc and ("dollar" in desc or "usd" in desc) and "future" not in desc and "option" not in desc

    matches = [s for s in symbols if ok(s)]
    if not matches:
        return None
    # exact XAUUSD first, then names that start with it (XAUUSDm, XAUUSD.r), then the shortest
    matches.sort(key=lambda s: (s.name.upper() != "XAUUSD", not s.name.upper().startswith("XAUUSD"), len(s.name)))
    return matches[0].name


CLOCK = Path("broker_clock.json")   # last broker clock offset measured on a fresh tick


class MT5Broker:
    def __init__(self, cfg):
        if mt5 is None:
            raise BrokerError("The MetaTrader5 package is not installed. Live trading needs Windows + "
                              "'pip install MetaTrader5' + the MT5 terminal.")
        self.cfg = cfg
        self.symbol = cfg.symbol
        self.offset_hours = 0
        self.info = None

    # ---------- connection
    def connect(self) -> None:
        m = self.cfg.mt5
        kwargs = {}
        if m.path:
            kwargs["path"] = m.path
        if m.login:
            kwargs.update(login=int(m.login), password=m.password, server=m.server)
        if not mt5.initialize(**kwargs):
            raise BrokerError(f"MT5 initialize failed: {mt5.last_error()}")
        if not mt5.symbol_select(self.symbol, True):
            found = find_gold_symbol(mt5.symbols_get() or [])
            if not found or not mt5.symbol_select(found, True):
                raise BrokerError(f"Symbol {self.symbol} not found, and no gold (Gold Spot vs US Dollar) symbol was "
                                  "found automatically. Check the exact name in Market Watch (e.g. XAUUSD, XAUUSDm, "
                                  "XAUUSD.r, GOLD) and set 'symbol' in config.yaml.")
            log.warning("Symbol %s not found at this broker - using %s (Gold Spot vs US Dollar). "
                        "Set symbol: %s in config.yaml to silence this.", self.symbol, found, found)
            self.symbol = self.cfg.symbol = found
        self.info = mt5.symbol_info(self.symbol)
        self.offset_hours = self._detect_offset()
        acc = mt5.account_info()
        log.info("Connected: account %s (%s) %s, balance %.2f %s, %s, broker clock UTC%+d",
                 acc.login, acc.server, self.account_kind(), acc.balance, acc.currency, self.symbol, self.offset_hours)

    def shutdown(self) -> None:
        mt5.shutdown()

    def reconnect(self) -> bool:
        """After MT5 was closed, logged out or lost the internet. True once the account answers again."""
        mt5.shutdown()
        self.connect()
        return mt5.account_info() is not None

    def account_kind(self) -> str:
        mode = mt5.account_info().trade_mode
        return {mt5.ACCOUNT_TRADE_MODE_DEMO: "demo", mt5.ACCOUNT_TRADE_MODE_CONTEST: "contest"}.get(mode, "real")

    def _fresh_tick_offset(self, wait_seconds: float = 15.0) -> int | None:
        """Broker clock offset measured on a tick that arrives while we watch.

        The last tick can be hours old (market closed, MT5 just reconnected), and its time then gives a
        wrong offset - so only a tick that changes while we wait is trusted."""
        first = mt5.symbol_info_tick(self.symbol)
        if first is None:
            return None
        deadline = time.time() + wait_seconds
        while time.time() < deadline:
            time.sleep(0.25)
            tick = mt5.symbol_info_tick(self.symbol)
            if tick is None or tick.time_msc == first.time_msc:
                continue
            off = (tick.time - time.time()) / 3600
            if abs(off) <= 14 and abs(off - round(off)) < 0.05:
                return int(round(off))
            return None
        return None

    def _detect_offset(self) -> int:
        setting = self.cfg.mt5.server_utc_offset_hours
        if setting != "auto":
            return int(setting)
        off = self._fresh_tick_offset()
        if off is not None:
            self._save_offset(off)
            return off
        try:
            saved = int(json.loads(CLOCK.read_text())["offset_hours"])
            log.warning("No fresh tick to read the broker clock (market closed?) - using the last measured "
                        "offset UTC%+d.", saved)
            return saved
        except (OSError, ValueError, KeyError, TypeError):
            pass
        log.warning("Could not detect the broker clock offset (market closed?) - assuming UTC+2. "
                    "Set mt5.server_utc_offset_hours in config.yaml to be sure.")
        return 2

    @staticmethod
    def _save_offset(off: int) -> None:
        try:
            CLOCK.write_text(json.dumps({"offset_hours": off}))
        except OSError:
            pass

    def check_offset(self) -> None:
        """Re-measures the broker clock (e.g. after a daylight-saving change) and fixes it if it moved."""
        if self.cfg.mt5.server_utc_offset_hours != "auto":
            return
        off = self._fresh_tick_offset(wait_seconds=3.0)
        if off is not None and off != self.offset_hours:
            log.warning("Broker clock changed from UTC%+d to UTC%+d - using the new offset.", self.offset_hours, off)
            self.offset_hours = off
        if off is not None:
            self._save_offset(off)

    def server_to_utc(self, secs) -> pd.Series:
        return pd.to_datetime(secs, unit="s") - pd.Timedelta(hours=self.offset_hours)

    def now_utc(self) -> pd.Timestamp:
        return pd.Timestamp(datetime.now(timezone.utc).replace(tzinfo=None))

    # ---------- market data
    def bars(self, count: int | None = None) -> pd.DataFrame:
        """Closed bars only (the still-forming bar is dropped), times converted to UTC."""
        tf = getattr(mt5, f"TIMEFRAME_{self.cfg.timeframe}")
        rates = mt5.copy_rates_from_pos(self.symbol, tf, 0, (count or self.cfg.mt5.bars_to_load) + 1)
        if rates is None or len(rates) < 100:
            raise BrokerError(f"No price data: {mt5.last_error()}")
        df = pd.DataFrame(rates)[:-1]
        df["time"] = self.server_to_utc(df["time"])
        return df[["time", "open", "high", "low", "close", "tick_volume", "spread"]].reset_index(drop=True)

    def ticks(self, start_utc: pd.Timestamp, end_utc: pd.Timestamp) -> pd.DataFrame:
        pad = timedelta(hours=abs(self.offset_hours) + 1)
        raw = mt5.copy_ticks_range(self.symbol, (start_utc - pad).to_pydatetime().replace(tzinfo=timezone.utc),
                                   (end_utc + pad).to_pydatetime().replace(tzinfo=timezone.utc), mt5.COPY_TICKS_ALL)
        if raw is None or len(raw) == 0:
            return pd.DataFrame(columns=["time", "bid", "ask", "flags"])
        df = pd.DataFrame(raw)
        df["time"] = pd.to_datetime(df["time_msc"], unit="ms") - pd.Timedelta(hours=self.offset_hours)
        return df[(df["time"] >= start_utc) & (df["time"] < end_utc)]

    def tick(self):
        return mt5.symbol_info_tick(self.symbol)

    def spread(self) -> float:
        t = self.tick()
        return float(t.ask - t.bid)

    def account(self):
        return mt5.account_info()

    # ---------- sizing
    def loss_per_lot(self, direction: int, entry: float, sl: float) -> float:
        order_type = mt5.ORDER_TYPE_BUY if direction > 0 else mt5.ORDER_TYPE_SELL
        p = mt5.order_calc_profit(order_type, self.symbol, 1.0, entry, sl)
        if p is None:   # fallback: contract size maths
            return abs(entry - sl) * self.info.trade_contract_size
        return abs(float(p))

    def volume_limits(self) -> tuple[float, float, float]:
        return self.info.volume_step, self.info.volume_min, self.info.volume_max

    # ---------- orders
    def _fillings(self) -> list[int]:
        modes, fm = [], self.info.filling_mode
        if fm & 1:
            modes.append(mt5.ORDER_FILLING_FOK)
        if fm & 2:
            modes.append(mt5.ORDER_FILLING_IOC)
        modes.append(mt5.ORDER_FILLING_RETURN)
        return modes

    def _send(self, request: dict):
        last = None
        for filling in self._fillings():
            request["type_filling"] = filling
            res = mt5.order_send(request)
            last = res
            if res is not None and res.retcode in (mt5.TRADE_RETCODE_DONE, mt5.TRADE_RETCODE_PLACED):
                return res
            if res is None or res.retcode != mt5.TRADE_RETCODE_INVALID_FILL:
                break
        raise BrokerError(f"order_send failed: {getattr(last, 'retcode', None)} {getattr(last, 'comment', mt5.last_error())}")

    def place_limit(self, direction: int, lots: float, price: float, sl: float, tp: float, comment: str):
        d = self.info.digits
        req = {
            "action": mt5.TRADE_ACTION_PENDING, "symbol": self.symbol, "volume": float(lots),
            "type": mt5.ORDER_TYPE_BUY_LIMIT if direction > 0 else mt5.ORDER_TYPE_SELL_LIMIT,
            "price": round(price, d), "sl": round(sl, d), "tp": round(tp, d),
            "deviation": self.cfg.mt5.deviation_points, "magic": self.cfg.magic,
            "comment": comment[:31], "type_time": mt5.ORDER_TIME_GTC,
        }
        return self._send(req)

    def cancel(self, ticket: int):
        return mt5.order_send({"action": mt5.TRADE_ACTION_REMOVE, "order": int(ticket)})

    def modify_sl(self, position, sl: float):
        return self._send({"action": mt5.TRADE_ACTION_SLTP, "symbol": self.symbol, "position": position.ticket,
                           "sl": round(sl, self.info.digits), "tp": position.tp, "magic": self.cfg.magic})

    def close(self, position, lots: float | None = None, comment: str = "Nelson close"):
        t = self.tick()
        buy = position.type == mt5.POSITION_TYPE_BUY
        return self._send({
            "action": mt5.TRADE_ACTION_DEAL, "symbol": self.symbol, "position": position.ticket,
            "volume": float(lots or position.volume), "type": mt5.ORDER_TYPE_SELL if buy else mt5.ORDER_TYPE_BUY,
            "price": t.bid if buy else t.ask, "deviation": self.cfg.mt5.deviation_points,
            "magic": self.cfg.magic, "comment": comment[:31],
        })

    def positions(self) -> list:
        return [p for p in (mt5.positions_get(symbol=self.symbol) or []) if p.magic == self.cfg.magic]

    def orders(self) -> list:
        return [o for o in (mt5.orders_get(symbol=self.symbol) or []) if o.magic == self.cfg.magic]

    def position_result(self, ticket: int) -> float:
        """Total profit of a closed position including commission and swap."""
        deals = mt5.history_deals_get(position=int(ticket)) or []
        return float(sum(d.profit + d.commission + d.swap + getattr(d, "fee", 0.0) for d in deals))

    def position_close(self, ticket: int) -> tuple[float, str | None]:
        """Result of a closed position and why it closed: "tp", "sl", "stop_out" or "closed" (manual/Nelson)."""
        deals = mt5.history_deals_get(position=int(ticket)) or []
        pnl = float(sum(d.profit + d.commission + d.swap + getattr(d, "fee", 0.0) for d in deals))
        outs = [d for d in deals if d.entry in (mt5.DEAL_ENTRY_OUT, mt5.DEAL_ENTRY_OUT_BY)]
        if not outs:
            return pnl, None
        reasons = {mt5.DEAL_REASON_SL: "sl", mt5.DEAL_REASON_TP: "tp", mt5.DEAL_REASON_SO: "stop_out"}
        return pnl, reasons.get(outs[-1].reason, "closed")

    def is_buy(self, position) -> bool:
        return position.type == mt5.POSITION_TYPE_BUY

