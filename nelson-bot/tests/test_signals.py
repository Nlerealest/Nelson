"""Signal book (paper signals followed on price) and phone notifications from the live loop."""
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from nelson.signals import SignalBook
from test_live import TestLiveLoop

T0 = pd.Timestamp("2026-03-06 08:00")


def setup(direction=-1, entry=2004.0, sl=2008.0, tp=1994.0):
    return SimpleNamespace(time=T0, side="BUY" if direction > 0 else "SELL", direction=direction, entry=entry, sl=sl,
                           tp=tp, risk=abs(entry - sl), level_name="Asia high", steps=[{"title": "x", "ok": True}],
                           reasons=["a", "b", "c"])


class TestSignalBook(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.book = SignalBook(Path(self.tmp.name) / "signals.json", spread=0.2)
        self.x = self.book.add_setup(setup(), 5, 12, 2.5, "price")

    def tearDown(self):
        self.tmp.cleanup()

    def bar(self, minutes, high, low):
        return self.book.on_bar(T0 + pd.Timedelta(minutes=minutes), high, low)

    def test_entry_then_take_profit(self):
        self.assertEqual(self.bar(5, 2003.0, 2001.0), [])                        # not yet at the sell entry
        self.assertEqual([s for _, s in self.bar(10, 2004.5, 2002.0)], ["active"])
        self.assertEqual([s for _, s in self.bar(15, 2000.0, 1993.0)], ["tp"])
        self.assertEqual(self.x["result_r"], 2.5)
        again = SignalBook(Path(self.tmp.name) / "signals.json")               # survives a restart
        self.assertEqual(again.items[0]["status"], "tp")

    def test_stop_first_when_one_bar_hits_both(self):
        self.bar(10, 2004.5, 2002.0)
        self.assertEqual([s for _, s in self.bar(15, 2009.0, 1990.0)], ["sl"])
        self.assertEqual(self.x["result_r"], -1.0)

    def test_expired_and_missed(self):
        self.assertEqual([s for _, s in self.bar(5 + 60, 2003.0, 2001.0)], ["expired"])
        y = self.book.add_setup(setup(direction=1, entry=2000.0, sl=1996.0, tp=2010.0), 5, 12, 2.5, "price")
        y["id"] = "other"
        self.assertEqual([s for _, s in self.bar(10, 2011.0, 2001.0)], ["missed"])

    def test_ticket_updates(self):
        z = self.book.add_setup(setup(direction=1), 5, 12, 2.5, "trade", ticket=77)
        self.book.update_ticket(77, "tp", T0, pnl=120.0)
        self.assertEqual(z["status"], "tp")
        self.assertEqual(self.book.recent(1)[0]["id"], z["id"])


class FakePusher:
    def __init__(self):
        self.sent = []

    def push(self, title, message, priority=3, tags=()):
        self.sent.append(title)


class TestNotifications(TestLiveLoop):
    test_places_order_then_manages_position = None
    test_real_account_is_never_traded_without_permission = None
    test_tier1_news_flattens = None

    def _bot(self, kind="demo"):
        bot, fake = super()._bot(kind)
        bot.pusher = FakePusher()
        return bot, fake

    def test_trade_lifecycle_alerts(self):
        bot, fake = self._bot()
        self._run_until(bot, fake, self.i + 4)
        o = fake.placed[0]
        self.assertTrue(any(t.startswith("ENTRY ORDER: SELL") for t in bot.pusher.sent))
        sig = bot.signals.by_ticket(o.ticket)
        self.assertEqual(sig["status"], "waiting")
        self.assertTrue(any(st["title"] == "Liquidity sweep" for st in sig["steps"]))
        # fill
        fake.orders_.clear()
        pos = SimpleNamespace(ticket=o.ticket, volume=o.volume, price_open=o.price_open, sl=o.sl, tp=o.tp,
                              price_current=o.price_open, d=-1, profit=0.0)
        fake.positions_.append(pos)
        bot.step()
        self.assertEqual(sig["status"], "active")
        self.assertTrue(any(t.startswith("ENTERED: SELL") for t in bot.pusher.sent))
        # take profit hit at the broker
        fake.positions_.clear()
        fake.position_close = lambda ticket: (150.0, "tp")
        bot.step()
        self.assertEqual(sig["status"], "tp")
        self.assertTrue(any(t.startswith("TAKE PROFIT hit: SELL") for t in bot.pusher.sent))

    def test_stop_loss_alert(self):
        bot, fake = self._bot()
        self._run_until(bot, fake, self.i + 4)
        o = fake.placed[0]
        fake.orders_.clear()
        fake.positions_.append(SimpleNamespace(ticket=o.ticket, volume=o.volume, price_open=o.price_open, sl=o.sl,
                                               tp=o.tp, price_current=o.price_open, d=-1, profit=0.0))
        bot.step()
        fake.positions_.clear()
        fake.position_close = lambda ticket: (-50.0, "sl")
        bot.step()
        self.assertTrue(any(t.startswith("STOP LOSS hit: SELL") for t in bot.pusher.sent))
        self.assertEqual(bot.signals.by_ticket(o.ticket)["status"], "sl")

    def test_paper_mode_sends_signal_and_follows_it(self):
        self.cfg.mode = "paper"
        bot, fake = self._bot()
        self._run_until(bot, fake, self.i + 4)
        self.assertEqual(fake.placed, [])
        self.assertTrue(any(t.startswith("SELL signal XAUUSD") for t in bot.pusher.sent))
        sig = bot.signals.recent(1)[0]
        self.assertEqual((sig["track"], sig["status"]), ("price", "waiting"))
        for n in range(self.i + 4, self.i + 40):     # price comes back up into the gap, then falls away
            fake.n = n
            bot.step()
        self.assertIn(sig["status"], ("active", "tp", "sl", "expired", "missed"))


if __name__ == "__main__":
    unittest.main()
