"""Private HTTP API for the Nelson phone app.

The main loop publishes a snapshot (account, trades, analysis, chart, news,
journal) every few seconds; the web server only ever reads that snapshot.
Actions from the app (pause, resume, close all, risk) are queued and run by
the main loop, because MetaTrader 5 must only be called from one thread.

Every request needs the header `Authorization: Bearer <api_key>`.
"""
from __future__ import annotations

import csv
import hmac
import json
import logging
import queue
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import pandas as pd

from . import __version__
from .report import analysis

log = logging.getLogger("nelson.api")
ACTIONS = {"pause", "resume", "close-all", "risk"}


class _Pending:
    def __init__(self, action: str, body: dict):
        self.action, self.body = action, body
        self.done = threading.Event()
        self.result: dict = {}


class AppServer:
    def __init__(self, host: str, port: int, api_key: str):
        if len(api_key) < 24:
            raise ValueError("app.api_key must be at least 24 characters - run: python run_nelson.py app-setup")
        self.host, self.port, self.key = host, port, api_key
        self.practice = False      # True when this is the practice demo (run_nelson.py demo)
        self._snapshot: dict = {"ready": False}
        self._lock = threading.Lock()
        self._actions: queue.Queue[_Pending] = queue.Queue()
        self._httpd: ThreadingHTTPServer | None = None

    # ---------- main-loop side
    def publish(self, snapshot: dict) -> None:
        with self._lock:
            self._snapshot = snapshot

    def snapshot(self) -> dict:
        with self._lock:
            return self._snapshot

    def pending_actions(self) -> list[_Pending]:
        out = []
        while True:
            try:
                out.append(self._actions.get_nowait())
            except queue.Empty:
                return out

    # ---------- server
    def start(self) -> None:
        server = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, fmt, *args):   # keep the console quiet
                log.debug(fmt, *args)

            def _cors(self) -> None:
                # lets the app's web version work too; safe because every call needs the key (no cookies)
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")

            def do_OPTIONS(self):
                self.send_response(204)
                self._cors()
                self.end_headers()

            def _send(self, code: int, payload: dict) -> None:
                body = json.dumps(payload, default=str).encode()
                self.send_response(code)
                self._cors()
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)

            def _authorised(self) -> bool:
                given = self.headers.get("Authorization", "")
                ok = hmac.compare_digest(given.encode(), f"Bearer {server.key}".encode())
                if not ok:
                    time.sleep(1.0)   # slow down guessing
                    log.warning("Rejected app request from %s (bad key)", self.client_address[0])
                    self._send(401, {"error": "wrong or missing app key", "practice": server.practice})
                return ok

            def do_GET(self):
                if not self._authorised():
                    return
                path = self.path.split("?")[0]
                if path == "/api/ping":
                    self._send(200, {"ok": True, "name": "Nelson", "version": __version__})
                elif path == "/api/snapshot":
                    self._send(200, server.snapshot())
                else:
                    self._send(404, {"error": "not found"})

            def do_POST(self):
                if not self._authorised():
                    return
                action = self.path.split("?")[0].removeprefix("/api/")
                if action not in ACTIONS:
                    self._send(404, {"error": "not found"})
                    return
                length = min(int(self.headers.get("Content-Length") or 0), 10_000)
                try:
                    body = json.loads(self.rfile.read(length) or b"{}")
                except json.JSONDecodeError:
                    self._send(400, {"error": "bad JSON"})
                    return
                pending = _Pending(action, body if isinstance(body, dict) else {})
                server._actions.put(pending)
                if not pending.done.wait(30):
                    self._send(504, {"error": "Nelson did not answer in time - is MT5 running?"})
                    return
                self._send(200 if pending.result.get("ok") else 400, pending.result)

        try:
            self._httpd = ThreadingHTTPServer((self.host, self.port), Handler)
        except OSError as exc:
            raise RuntimeError(f"Port {self.port} is already in use. Is the practice demo (run_nelson.py demo) or "
                               "another Nelson window still open? Close it and start Nelson again.") from exc
        self._httpd.daemon_threads = True
        threading.Thread(target=self._httpd.serve_forever, name="nelson-api", daemon=True).start()
        log.info("App API listening on http://%s:%s", self.host, self.port)

    def stop(self) -> None:
        if self._httpd:
            self._httpd.shutdown()


# ---------- snapshot building (runs on the main loop)
def run_action(bot, p: _Pending) -> dict:
    if p.action == "pause":
        return {"ok": True, "message": bot.set_paused(True, "Nelson app")}
    if p.action == "resume":
        return {"ok": True, "message": bot.set_paused(False, "Nelson app")}
    if p.action == "close-all":
        if p.body.get("confirm") != "CLOSE":
            return {"ok": False, "message": "Close all needs confirm: CLOSE"}
        return {"ok": True, "message": "\n".join(bot.close_all("Nelson app"))}
    if p.action == "risk":
        try:
            value = float(p.body.get("value"))
        except (TypeError, ValueError):
            return {"ok": False, "message": "value must be a number"}
        ok, msg = bot.set_risk(value, "Nelson app")
        return {"ok": ok, "message": msg}
    return {"ok": False, "message": "unknown action"}


def _journal(bot, limit: int = 60) -> tuple[list[dict], dict]:
    try:
        with bot.journal.path.open(encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
    except OSError:
        rows = []
    closed = [r for r in rows if r.get("event") == "closed" and r.get("pnl")]
    pnl = [float(r["pnl"]) for r in closed]
    today = pd.Timestamp.utcnow().strftime("%Y-%m-%d")
    stats = {
        "closed_trades": len(pnl),
        "wins": sum(p > 0 for p in pnl),
        "losses": sum(p < 0 for p in pnl),
        "win_rate_pct": round(sum(p > 0 for p in pnl) / len(pnl) * 100, 1) if pnl else None,
        "total_pnl": round(sum(pnl), 2),
        "today_closed": sum(r["logged_utc"].startswith(today) for r in closed),
    }
    return list(reversed(rows[-limit:])), stats


def build_snapshot(bot, now: pd.Timestamp, acc) -> dict:
    st = bot.risk.state
    tick = bot.broker.tick()
    positions = []
    for p in bot.broker.positions():
        info = bot.trades.get(str(p.ticket), {})
        d = 1 if bot.broker.is_buy(p) else -1
        risk = info.get("risk") or 0
        positions.append({
            "ticket": p.ticket, "side": "BUY" if d > 0 else "SELL", "lots": p.volume,
            "open": p.price_open, "sl": p.sl, "tp": p.tp, "price": getattr(p, "price_current", None),
            "profit": round(float(getattr(p, "profit", 0.0)), 2),
            "r": round((p.price_current - p.price_open) * d / risk, 2) if risk and hasattr(p, "price_current") else None,
            "partial_taken": bool(info.get("partial")),
        })
    orders = []
    for o in bot.broker.orders():
        info = bot.trades.get(str(o.ticket), {})
        orders.append({"ticket": o.ticket, "side": "BUY" if info.get("dir", 1) > 0 else "SELL", "lots": o.volume,
                       "price": o.price_open, "sl": o.sl, "tp": o.tp, "expires": info.get("expires")})
    journal, stats = _journal(bot)

    f = bot.last_f
    chart, levels, an = [], [], None
    if f is not None and len(f):
        tail = f.tail(120)
        chart = [[int(t.timestamp() * 1000), round(o, 2), round(h, 2), round(lo, 2), round(c, 2)]
                 for t, o, h, lo, c in zip(tail["time"], tail["open"], tail["high"], tail["low"], tail["close"])]
        lo_px, hi_px = float(tail["low"].min()), float(tail["high"].max())
        pad = (hi_px - lo_px) * 0.5
        book = bot.strategy.book
        if book is not None:
            levels = [{"price": round(lv.price, 2), "side": lv.side, "name": lv.name}
                      for lv in book.levels if lv.alive and lo_px - pad <= lv.price <= hi_px + pad]
        an = analysis(f, book)

    news_ok = bot.news.available
    blocked, ev = bot.news.blocked(now)
    news = [{"time": e.time.isoformat(), "title": e.title, "tier1": e.tier1, "forecast": e.forecast,
             "previous": e.previous} for e in (bot.news.upcoming(now, 72) if news_ok else [])]
    last_setup = bot.last_setups[-1] if bot.last_setups else None
    return {
        "ready": True,
        "updated": pd.Timestamp.now("UTC").tz_localize(None).isoformat(),   # wall clock, not market time
        "symbol": bot.cfg.symbol,
        "mode": bot.cfg.mode,
        "trading": bot.trading,
        "paused": bot.paused,
        "halted": st.halted,
        "account": {"balance": round(acc.balance, 2), "equity": round(acc.equity, 2),
                    "currency": getattr(acc, "currency", "USD")},
        "today": {"pnl": round(acc.equity - st.day_start_balance, 2),
                  "pct": round((acc.equity - st.day_start_balance) / st.day_start_balance * 100, 2) if st.day_start_balance else 0,
                  "trades": st.trades_today, "losses_in_row": st.consecutive_losses},
        "limits": {"risk_pct": bot.cfg.risk.risk_per_trade_pct, "max_risk_pct": bot.cfg.telegram.max_risk_pct,
                   "max_daily_loss_pct": bot.cfg.risk.max_daily_loss_pct, "max_trades_per_day": bot.cfg.risk.max_trades_per_day},
        "price": {"bid": tick.bid, "ask": tick.ask, "spread": round(tick.ask - tick.bid, 2)},
        "positions": positions,
        "orders": orders,
        "analysis": an,
        "chart": chart,
        "levels": levels,
        "last_setup": None if last_setup is None else {
            "time": last_setup.time.isoformat(), "side": last_setup.side, "entry": last_setup.entry,
            "sl": last_setup.sl, "tp": last_setup.tp, "reasons": last_setup.reasons},
        "news": {"available": news_ok, "blocked_now": bool(blocked), "reason": str(ev) if blocked else "", "events": news},
        "journal": journal,
        "stats": stats,
        "signals": bot.signals.recent(60),
        "missed": bot.signals.missed(80),
        "learning": bot.learner.summary(),
        "notify": {"enabled": bool(bot.pusher), "server": bot.cfg.notify.server,
                   "topic": bot.cfg.notify.topic if bot.pusher else ""},
    }
