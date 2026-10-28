"""Broker clock offset from a fresh tick, reconnecting when MT5 drops, and repairing a bad 'last candle' mark."""
import os
import sys
import tempfile
import time
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest import mock

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import nelson.live as live
import nelson.mt5_broker as mt5_broker
from nelson.config import Config
from nelson.news import NewsFilter
from synthetic import random_walk
from test_live import FakeBroker


class FakeMT5:
    """Ticks whose server time is `offset` hours ahead of UTC; `stale_hours` makes the first tick old."""
    def __init__(self, offset=2, stale_hours=0.0, fresh=True):
        self.offset, self.stale, self.fresh, self.calls = offset, stale_hours, fresh, 0

    def symbol_info_tick(self, symbol):
        self.calls += 1
        moving = self.fresh and self.calls > 1
        t = time.time() + self.offset * 3600 - (0 if moving else self.stale * 3600)
        return SimpleNamespace(time=int(t), time_msc=self.calls if moving else 1, bid=1.0, ask=1.2)


class TestBrokerClock(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cwd = os.getcwd()
        os.chdir(self.tmp.name)

    def tearDown(self):
        os.chdir(self.cwd)
        self.tmp.cleanup()

    def _broker(self, fake):
        with mock.patch.object(mt5_broker, "mt5", fake):
            b = mt5_broker.MT5Broker(Config())
        return b

    def test_offset_comes_from_a_fresh_tick_not_a_stale_one(self):
        fake = FakeMT5(offset=2, stale_hours=16)        # the old tick alone would say UTC-14
        with mock.patch.object(mt5_broker, "mt5", fake):
            b = mt5_broker.MT5Broker(Config())
            self.assertEqual(b._detect_offset(), 2)
        self.assertIn('"offset_hours": 2', Path("broker_clock.json").read_text())

    def test_no_fresh_tick_uses_the_last_measured_offset(self):
        fake = FakeMT5(offset=3, stale_hours=16, fresh=False)
        with mock.patch.object(mt5_broker, "mt5", fake):
            b = mt5_broker.MT5Broker(Config())
            self.assertIsNone(b._fresh_tick_offset(wait_seconds=0.6))
            with mock.patch.object(b, "_fresh_tick_offset", lambda **k: None):
                self.assertEqual(b._detect_offset(), 2)            # nothing known yet: the usual UTC+2
                Path("broker_clock.json").write_text('{"offset_hours": 3}')
                self.assertEqual(b._detect_offset(), 3)

    def test_hourly_check_follows_a_clock_change(self):
        fake = FakeMT5(offset=3)
        with mock.patch.object(mt5_broker, "mt5", fake):
            b = mt5_broker.MT5Broker(Config())
            b.offset_hours = 2
            b.check_offset()
        self.assertEqual(b.offset_hours, 3)


class FlakyBroker(FakeBroker):
    """MT5 that stops answering, then comes back when reconnected."""
    def __init__(self, *a, **kw):
        super().__init__(*a, **kw)
        self.down = False
        self.reconnects = 0

    def account(self):
        return None if self.down else super().account()

    def reconnect(self):
        self.reconnects += 1
        self.down = False
        return True


class TestLiveRecovery(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cwd = os.getcwd()
        os.chdir(self.tmp.name)
        self.cfg = Config()
        self.cfg.mode = "demo"
        self.df = random_walk(4, seed=5)

    def tearDown(self):
        os.chdir(self.cwd)
        self.tmp.cleanup()

    def _bot(self):
        fake = FlakyBroker(self.cfg, self.df)
        with mock.patch.object(live, "MT5Broker", lambda cfg: fake):
            bot = live.NelsonBot(self.cfg)
        bot.news = NewsFilter(self.cfg.news, [])
        bot.news.refresh = lambda force=False: None
        bot.strategy.news = bot.news
        bot.start()
        return bot, fake

    def test_lost_mt5_is_reported_once_and_reconnected(self):
        bot, fake = self._bot()
        fake.n = 500
        bot.step()
        fake.down = True
        with mock.patch.object(bot, "notify") as told:
            bot.step()                                   # no exception: says so and reconnects
            self.assertEqual(fake.reconnects, 1)
            self.assertIsNone(bot.mt5_lost_since)
            self.assertEqual(told.call_count, 2)          # "lost" then "reconnected"
            fake.down = True
            fake.reconnect = lambda: False                # still down
            bot.step()
            bot.step()                                    # second failure inside 30 s: no new attempt or alert
            self.assertEqual(told.call_count, 3)

    def test_last_candle_mark_in_the_future_is_repaired(self):
        bot, fake = self._bot()
        fake.n = 500
        bot.signals.last_bar = (self.df["time"].iat[499] + pd.Timedelta(hours=14)).isoformat()
        bot.step()
        self.assertEqual(pd.Timestamp(bot.signals.last_bar), self.df["time"].iat[499])
        self.assertTrue(all(w["first_run"] for w in bot.signals.windows))


if __name__ == "__main__":
    unittest.main()
