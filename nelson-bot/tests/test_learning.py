"""Missed setups while Nelson was off, would-be results, lessons from losses and learned rules."""
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest import mock

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

import nelson.live as live
from nelson.api import build_snapshot
from nelson.config import Config, LearningConfig
from nelson.learning import Learner, buckets
from nelson.news import NewsFilter
from nelson.signals import SignalBook
from synthetic import planted_short, random_walk
from test_live import FakeBroker

T0 = pd.Timestamp("2026-03-04 08:00")
FEATURES = {"side": "SELL", "level": "Asia high", "session": "London", "hour": 8, "trend_aligned": True,
            "zone_ok": True, "volume_spike": True, "rel_volume": 2.0, "delta_agrees": True, "body_atr": 1.6,
            "sl_atr": 1.2, "fvg_atr": 0.3}


def item(n, status, result_r=None, features=None, track="price", kind="signal", note=""):
    """A finished SELL signal: entry 100, stop 101, target 97.5."""
    t = T0 + pd.Timedelta(minutes=5 * n)
    x = {"id": f"x{n}", "kind": kind, "time": t.isoformat(), "confirmed": t.isoformat(), "side": "SELL", "dir": -1,
         "entry": 100.0, "sl": 101.0, "tp": 97.5, "rr": 2.5, "level": "Asia high", "track": track, "note": note,
         "features": dict(FEATURES if features is None else features)}
    h = {"status": status, "status_time": (t + pd.Timedelta(minutes=10)).isoformat(), "result_r": result_r,
         "entered": (t + pd.Timedelta(minutes=5)).isoformat()}
    if track == "shadow":
        x["sim"] = h
    else:
        x.update(h)
    return x


def bars(start, n, high, low, trend=-1):
    t = pd.date_range(start, periods=n, freq="5min")
    df = pd.DataFrame({"time": t, "open": 100.0, "high": high, "low": low, "close": 100.0, "htf_trend": trend})
    df.attrs["bar_minutes"] = 5
    return df


class TestShadowResults(unittest.TestCase):
    def test_skipped_setup_is_followed_without_changing_its_status(self):
        with tempfile.TemporaryDirectory() as tmp:
            book = SignalBook(Path(tmp) / "s.json", spread=0.0)
            x = book.add_skipped({"time": T0, "side": "SELL", "entry": 100.0, "sl": 101.0, "tp": 97.5,
                                  "reason": "against H1 structure", "steps": [], "features": FEATURES}, 5, 12, 2.5)
            self.assertEqual(x["track"], "shadow")
            book.on_bar(T0 + pd.Timedelta(minutes=5), 100.2, 99.5)     # fills the sell limit
            book.on_bar(T0 + pd.Timedelta(minutes=10), 99.0, 97.0)     # reaches the target
            self.assertEqual(x["status"], "skipped")
            self.assertEqual((x["sim"]["status"], x["sim"]["result_r"]), ("tp", 2.5))
            book.on_bar(T0 + pd.Timedelta(minutes=10), 103, 90)        # same bar again changes nothing
            self.assertEqual(x["sim"]["status"], "tp")


class TestLearner(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cfg = LearningConfig(review_bars=6)
        self.learner = Learner(Path(self.tmp.name) / "learning.json", self.cfg, rr=2.5)

    def tearDown(self):
        self.tmp.cleanup()

    def test_lesson_after_a_loss_then_stop_hunt_review(self):
        x = item(0, "sl", -1.0, features={**FEATURES, "sl_atr": 0.6})
        lessons = self.learner.update([x], None)
        self.assertEqual(len(lessons), 1)
        les = lessons[0]
        self.assertEqual(les["cause"], "tight_stop")
        self.assertIn("0.6 ATR", " ".join(les["notes"]))
        # two hours after the stop price falls through the target: the stop was hunted
        after = bars(pd.Timestamp(les["time"]) + pd.Timedelta(minutes=5), 6, 100.5, [99.5, 99, 98.5, 98, 97.4, 97])
        self.learner.update([x], after)
        les = self.learner.lessons[0]
        self.assertTrue(les["reviewed"])
        self.assertEqual(les["cause"], "stop_hunt")
        self.assertIn("target", les["follow_up"])
        again = Learner(Path(self.tmp.name) / "learning.json", self.cfg)        # survives a restart
        self.assertEqual(len(again.lessons), 1)
        self.assertEqual(again.update([x], None), [])                         # nothing learned twice

    def test_failed_fast_and_against_trend(self):
        x = item(0, "sl", -1.0, features={**FEATURES, "trend_aligned": False})
        held = bars(x["entered"], 2, 101.2, 99.8)
        les = self.learner.update([x], held)[0]
        self.assertEqual(les["causes"][:2], ["failed_fast", "against_trend"])

    def test_wins_and_filtered_setups_give_no_lesson(self):
        got = self.learner.update([item(0, "tp", 2.5), item(1, "sl", -1.0, track="shadow", kind="skipped",
                                                            note="against H1 structure")], None)
        self.assertEqual(got, [])
        self.assertEqual(self.learner.summary()["by_source"]["filtered"], 1)

    def test_avoid_rule_needs_evidence_and_lifts_again(self):
        asia = [item(n, "sl", -1.0) for n in range(7)]
        self.learner.update(asia, None)
        self.assertIsNone(self.learner.blocking_rule(FEATURES))             # 7 results: not enough yet
        self.learner.update([item(7, "sl", -1.0)], None)
        rule = self.learner.blocking_rule(FEATURES)
        self.assertIsNotNone(rule)
        self.assertIn("won 0 of 8", rule["text"])
        # setups Nelson skipped because of the rule are still followed; when they win the rule lifts
        recovered = [item(10 + n, "tp", 2.5, track="shadow", note="lesson: ...") for n in range(6)]
        self.learner.update(recovered, None)
        self.assertIsNone(self.learner.blocking_rule(FEATURES))

    def test_rule_switch_off(self):
        self.learner.update([item(n, "sl", -1.0) for n in range(10)], None)
        self.cfg.apply_lessons = False
        self.assertIsNone(self.learner.blocking_rule(FEATURES))

    def test_filter_suggestion_from_skipped_winners(self):
        skipped = [item(n, "tp", 2.5, track="shadow", kind="skipped", note="sweep volume only x1.0")
                   for n in range(10)]
        self.learner.update(skipped, None)
        titles = [s["title"] for s in self.learner.summary()["suggestions"]]
        self.assertIn("The Stop-run volume filter may be too strict", titles)

    def test_buckets_have_plain_labels(self):
        labels = dict(buckets(FEATURES))
        self.assertEqual(labels["level:Asia high"], "Sweeps of the Asia high")
        self.assertEqual(labels["trend:with"], "With H1 structure")


class TestMissedWhileOff(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.cwd = os.getcwd()
        os.chdir(self.tmp.name)
        self.df, self.i = planted_short(random_walk(10, seed=3), "2025-03-06 08:30")
        self.cfg = Config()
        self.cfg.mode = "demo"
        self.cfg.log_dir = "logs"
        self.cfg.strategy.use_htf_bias = False
        self.cfg.strategy.use_premium_discount = False

    def tearDown(self):
        os.chdir(self.cwd)
        self.tmp.cleanup()

    def _bot(self):
        fake = FakeBroker(self.cfg, self.df)
        with mock.patch.object(live, "MT5Broker", lambda cfg: fake):
            bot = live.NelsonBot(self.cfg)
        bot.news = NewsFilter(self.cfg.news, [])
        bot.news.refresh = lambda force=False: None
        bot.strategy.news = bot.news
        bot.start()
        return bot, fake

    def test_setup_formed_while_off_is_shown_with_its_result_and_not_traded(self):
        bot, fake = self._bot()
        for n in range(self.i - 40, self.i - 30):          # running normally
            fake.n = n
            bot.step()
        # the very first start only looks back over the last 24 h
        self.assertEqual([w["first_run"] for w in bot.signals.windows], [True])
        fake.n = self.i + 30                               # Nelson was off while the setup formed and played out
        bot.step()
        self.assertEqual(fake.placed, [])                  # nothing is traded late
        self.assertEqual(len(bot.signals.windows), 2)
        w = bot.signals.windows[-1]
        self.assertFalse(w["first_run"])
        self.assertGreaterEqual(w["bars"], 60)
        missed = bot.signals.missed()
        sig = next(x for x in missed["items"] if x["kind"] == "signal" and x["offline"] == w["id"])
        self.assertEqual((sig["status"], sig["side"]), ("offline", "SELL"))
        self.assertNotEqual(sig["sim"]["status"], "waiting")   # its result was replayed on the real candles
        self.assertEqual(missed["windows"][0]["trades"], 1)   # newest window first
        self.assertNotIn(sig["id"], [x["id"] for x in bot.signals.recent()])
        snap = build_snapshot(bot, fake.now_utc(), fake.account())
        self.assertEqual(len(snap["missed"]["windows"]), 2)
        self.assertIn("lessons", snap["learning"])
        self.assertIn("offline", Path("logs/journal.csv").read_text())

    def test_learned_rule_stops_a_live_setup(self):
        bot, fake = self._bot()
        bot.learner.blocking_rule = lambda ft: {"label": "Sweeps of the Swing high", "wins": 0, "n": 9,
                                                "avg_r": -1.0, "key": "x", "text": ""}
        for n in range(self.i - 56, self.i + 4):
            fake.n = n
            bot.step()
        self.assertEqual(fake.placed, [])
        x = next(x for x in bot.signals.recent() if x["kind"] == "signal")
        self.assertEqual((x["status"], x["track"]), ("not_taken", "shadow"))
        self.assertTrue(x["note"].startswith("lesson:"))


if __name__ == "__main__":
    unittest.main()
