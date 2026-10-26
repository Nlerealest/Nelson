"""Drives the live loop against a fake MT5 broker (MT5 itself only runs on Windows)."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import nelson.live as live
from nelson.config import Config
from nelson.news import NewsFilter
from synthetic import planted_short, random_walk


class FakeBroker:
    def __init__(self, cfg, bars, kind="demo"):
        self.cfg, self.all_bars, self.kind = cfg, bars, kind
        self.n = 0
        self.orders_ = []
        self.positions_ = []
        self.placed = []
        self.closed = []
        self.sl_moves = []

    def connect(self): pass
    def shutdown(self): pass
    def account_kind(self): return self.kind
    def now_utc(self): return self.all_bars["time"].iat[self.n - 1] + pd.Timedelta(minutes=5, seconds=3)
    def account(self): return SimpleNamespace(balance=10_000.0, equity=10_000.0)
    def bars(self): return self.all_bars.iloc[:self.n].reset_index(drop=True)
    def ticks(self, a, b): return pd.DataFrame(columns=["time", "bid", "ask", "flags"])
    def last_close(self): return float(self.all_bars["close"].iat[self.n - 1])
    def tick(self):
        c = self.last_close()
        return SimpleNamespace(bid=c, ask=c + 0.2)
    def spread(self): return 0.2
    def loss_per_lot(self, d, e, sl): return abs(e - sl) * 100
    def volume_limits(self): return 0.01, 0.01, 100.0
    def place_limit(self, d, lots, price, sl, tp, comment):
        o = SimpleNamespace(ticket=1000 + len(self.placed), volume=lots, price_open=price, sl=sl, tp=tp, d=d)
        self.placed.append(o)
        self.orders_.append(o)
        return SimpleNamespace(order=o.ticket)
    def cancel(self, ticket): self.orders_ = [o for o in self.orders_ if o.ticket != ticket]
    def orders(self): return list(self.orders_)
    def positions(self): return list(self.positions_)
    def is_buy(self, p): return p.d > 0
    def close(self, p, lots=None, comment=""):
        self.closed.append((p.ticket, lots))
        if lots is None or lots >= p.volume:
            self.positions_.remove(p)
        else:
            p.volume = round(p.volume - lots, 2)
    def modify_sl(self, p, sl):
        p.sl = sl
        self.sl_moves.append((p.ticket, sl))
    def position_result(self, ticket): return 0.0


class TestLiveLoop(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cwd = os.getcwd()
        os.chdir(self.tmp.name)
        df, self.i = planted_short(random_walk(10, seed=3), "2025-03-06 08:30")
        self.df = df
        self.cfg = Config()
        self.cfg.mode = "demo"
        self.cfg.log_dir = "logs"
        self.cfg.strategy.use_htf_bias = False
        self.cfg.strategy.use_premium_discount = False

    def tearDown(self):
        os.chdir(self.cwd)
        self.tmp.cleanup()

    def _bot(self, kind="demo"):
        fake = FakeBroker(self.cfg, self.df, kind)
        with mock.patch.object(live, "MT5Broker", lambda cfg: fake):
            bot = live.NelsonBot(self.cfg)
        bot.news = NewsFilter(self.cfg.news, [])          # calendar loaded, no events
        bot.news.refresh = lambda force=False: None
        bot.strategy.news = bot.news
        bot.start()
        return bot, fake

    def _run_until(self, bot, fake, end):
        for n in range(end - 60, end):
            fake.n = n
            bot.step()

    def test_places_order_then_manages_position(self):
        bot, fake = self._bot()
        self._run_until(bot, fake, self.i + 4)
        self.assertEqual(len(fake.placed), 1)
        o = fake.placed[0]
        self.assertEqual(o.d, -1)
        self.assertGreater(o.sl, o.price_open)
        self.assertAlmostEqual(o.volume, round(50 / ((o.sl - o.price_open) * 100 + 7) // 0.01 * 0.01, 2))
        # simulate the fill, then price moving 1.2R in our favour
        fake.orders_.clear()
        r = o.sl - o.price_open
        pos = SimpleNamespace(ticket=o.ticket, volume=o.volume, price_open=o.price_open, sl=o.sl, tp=o.tp,
                              price_current=o.price_open - 1.2 * r, d=-1, profit=60.0)
        fake.positions_.append(pos)
        bot.step()
        self.assertEqual(len(fake.closed), 1)                 # partial
        self.assertEqual(fake.sl_moves, [(o.ticket, o.price_open)])   # break-even
        self.assertEqual(bot.risk.state.trades_today, 1)

    def test_real_account_is_never_traded_without_permission(self):
        bot, fake = self._bot(kind="real")
        self.assertFalse(bot.trading)
        self._run_until(bot, fake, self.i + 4)
        self.assertEqual(fake.placed, [])
        journal = Path("logs/journal.csv").read_text()
        self.assertIn("paper_signal", journal)

    def test_tier1_news_flattens(self):
        bot, fake = self._bot()
        self._run_until(bot, fake, self.i + 4)
        fake.n += 1
        nfp_time = fake.now_utc() + pd.Timedelta(minutes=5)
        bot.news._set(NewsFilter.parse_forexfactory([{"title": "Non-Farm Employment Change", "country": "USD",
                                                      "date": nfp_time.isoformat() + "+00:00", "impact": "High"}]))
        bot.step()
        self.assertEqual(fake.orders_, [])


class FakePhone:
    def __init__(self):
        self.sent, self.inbox = [], []
    def start(self): pass
    def stop(self): pass
    def send(self, text, chat_id=None): self.sent.append(text)
    def pending_commands(self):
        out, self.inbox = self.inbox, []
        return out


class TestPhoneControl(TestLiveLoop):
    def _bot(self, kind="demo"):
        bot, fake = super()._bot(kind)
        bot.phone = FakePhone()
        return bot, fake

    def _say(self, bot, text):
        bot.phone.inbox.append((1, text))
        bot.step()
        return bot.phone.sent[-1]

    def test_alerts_and_status(self):
        bot, fake = self._bot()
        self._run_until(bot, fake, self.i + 4)
        self.assertTrue(any(m.startswith("ORDER #") for m in bot.phone.sent))
        status = self._say(bot, "/status")
        self.assertIn("Balance 10000.00", status)
        self.assertIn("Order #1000", status)
        self.assertIn("XAUUSD", self._say(bot, "/brief"))

    def test_pause_blocks_new_trades_and_persists(self):
        bot, fake = self._bot()
        fake.n = self.i - 40
        bot.step()
        self.assertIn("Paused", self._say(bot, "/pause"))
        self._run_until(bot, fake, self.i + 4)
        self.assertEqual(fake.placed, [])
        self.assertTrue(any("PAUSED" in m for m in bot.phone.sent))
        bot2, fake2 = self._bot()
        fake2.n = self.i
        self.assertTrue(bot2.paused)        # survives a restart
        self.assertIn("Resumed", self._say(bot2, "/resume"))

    def test_closeall_needs_confirmation(self):
        bot, fake = self._bot()
        self._run_until(bot, fake, self.i + 4)
        self.assertIn("/closeall yes", self._say(bot, "/closeall"))
        self.assertEqual(len(fake.orders_), 1)
        reply = self._say(bot, "/closeall yes")
        self.assertIn("Cancelled order", reply)
        self.assertEqual(fake.orders_, [])
        self.assertTrue(bot.paused)

    def test_risk_is_capped(self):
        bot, fake = self._bot()
        fake.n = self.i - 40
        self.assertIn("between", self._say(bot, "/risk 5"))
        self.assertIn("0.25%", self._say(bot, "/risk 0.25"))
        self.assertEqual(bot.risk.cfg.risk_per_trade_pct, 0.25)


if __name__ == "__main__":
    unittest.main()
