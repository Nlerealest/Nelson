"""The playbook: several strategies, watch-only tracking and per-strategy filters."""
import unittest

import numpy as np
import pandas as pd

from nelson.backtest import simulate
from nelson.config import Config
from nelson.liquidity import untested_levels
from nelson.playbook import KEY_LEVELS, LABELS, Playbook, adx, rsi
from nelson.strategy import prepare


def bars(n=3000, seed=3):
    r = np.random.default_rng(seed)
    c = 2000 + np.cumsum(r.normal(0, 0.6, n))
    o = np.r_[c[0], c[:-1]]
    h, l = np.maximum(o, c) + r.uniform(0, 0.8, n), np.minimum(o, c) - r.uniform(0, 0.8, n)
    t = pd.date_range("2026-01-05", periods=n, freq="5min")
    return pd.DataFrame({"time": t, "open": o, "high": h, "low": l, "close": c, "tick_volume": r.integers(50, 300, n)})


class TestPlaybook(unittest.TestCase):
    def setUp(self):
        self.cfg = Config()
        self.cfg.strategy.use_daily_bias = False
        self.cfg.strategy.use_h4_bias = False
        self.cfg.playbook.need_h4 = []
        self.f = prepare(bars(), self.cfg.strategy, 5)

    def scan(self):
        return Playbook(self.cfg.strategy, self.cfg.playbook, None).scan(self.f)

    def test_every_strategy_runs_and_is_named(self):
        self.cfg.playbook.enabled = list(LABELS)
        self.cfg.playbook.watch = []
        setups = self.scan()
        self.assertTrue(setups)
        for s in setups:
            self.assertIn(s.strategy, LABELS)
            self.assertGreater((s.entry - s.sl) * s.direction, 0)
            self.assertGreater((s.tp - s.entry) * s.direction, 0)
            self.assertEqual(s.features["strategy"], s.strategy)

    def test_no_future_data(self):
        self.cfg.playbook.enabled = list(LABELS)
        self.cfg.playbook.watch = []
        self.cfg.playbook.hours_utc = {}
        full = {(s.index, s.strategy, s.entry) for s in self.scan()}
        cut = 2400
        f2 = prepare(bars().iloc[:cut], self.cfg.strategy, 5)
        part = Playbook(self.cfg.strategy, self.cfg.playbook, None).scan(f2)
        for s in part:
            if s.strategy != "tjr_bootcamp" and s.index < cut - 100:
                self.assertIn((s.index, s.strategy, s.entry), full)

    def test_watch_only_never_traded(self):
        self.cfg.playbook.enabled = []
        self.cfg.playbook.watch = list(LABELS)
        setups = self.scan()
        self.assertTrue(setups)
        self.assertTrue(all(s.watch_only for s in setups))
        self.assertEqual(simulate(self.f, setups, self.cfg).stats()["trades"], 0)

    def test_hours_filter(self):
        self.cfg.playbook.enabled = ["momentum"]
        self.cfg.playbook.watch = []
        self.cfg.playbook.hours_utc = {"momentum": [("12:00", "16:00")]}
        for s in self.scan():
            self.assertTrue(12 * 60 <= s.time.hour * 60 + s.time.minute < 16 * 60)

    def test_untested_levels_vanish_when_traded(self):
        t = pd.date_range("2026-01-05", periods=288 * 3, freq="5min")
        n = len(t)
        h = np.full(n, 100.0)
        h[10] = 110.0                     # day 1 high
        h[288 * 2 + 20] = 111.0           # traded through on day 3
        df = pd.DataFrame({"time": t, "high": h, "low": h - 1, "close": h - 0.5})
        u = untested_levels(df, 14)["untested_high"].to_numpy()
        self.assertEqual(u[288 + 5], 110.0)
        self.assertEqual(u[288 * 2 + 20], 100.0)    # nearest above: day 2 high
        self.assertTrue(np.isnan(u[288 * 2 + 21]))

    def test_forming_lists_key_sweeps(self):
        pb = Playbook(self.cfg.strategy, self.cfg.playbook, None)
        pb.scan(self.f)
        for i, d, name, level in pb.bars.sweeps:
            self.assertEqual(bool(pb.forming(i)), any(n in KEY_LEVELS for k, _, n, _ in pb.bars.sweeps if k == i))

    def test_indicators(self):
        c = np.arange(100.0)
        self.assertGreater(rsi(c)[-1], 90)
        self.assertGreater(adx(c + 1, c - 1, c)[-1], 50)


if __name__ == "__main__":
    unittest.main()
