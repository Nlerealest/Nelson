"""The TJR bootcamp rules: daily bias, liquidity targets, news days, market entries, London levels."""
import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from nelson.backtest import simulate
from nelson.config import Config, NewsConfig
from nelson.liquidity import Level, LiquidityBook, session_levels
from nelson.news import Event, NewsFilter
from nelson.strategy import NelsonStrategy, Setup, prepare
from nelson.structure import htf_trend
from synthetic import random_walk


def day_bars(closes, start="2026-03-02 22:00"):
    """One M5 bar per daily close, padded to whole days of 288 bars (flat inside each day)."""
    rows = []
    t = pd.Timestamp(start)
    prev = closes[0]
    for c in closes:
        for k in range(288):
            o = prev if k == 0 else c
            rows.append((t, o, max(o, c) + 0.1, min(o, c) - 0.1, c, 100.0))
            t += pd.Timedelta(minutes=5)
        prev = c
    return pd.DataFrame(rows, columns=["time", "open", "high", "low", "close", "tick_volume"])


class TestDailyBias(unittest.TestCase):
    def test_daily_structure_without_look_ahead(self):
        # swing high at day 2, pullback, then day 5 closes above it: bullish break of structure
        df = day_bars([100, 105, 110, 104, 103, 112, 113])
        tr = htf_trend(df, 5, 1440, 1, offset_hours=-2)["trend"].to_numpy()
        day = np.arange(len(df)) // 288
        last_of_day5 = 6 * 288 - 1                          # this M5 bar closes as the daily candle closes
        self.assertEqual(set(tr[:last_of_day5]), {0})       # the break is only known once day 5 has closed
        self.assertTrue((tr[last_of_day5:] == 1).all())
        self.assertTrue((tr[day == 6] == 1).all())

    def test_long_history_is_used_for_the_daily_trend(self):
        df = day_bars([100, 105, 110, 104, 103, 112, 113])
        recent = df.tail(288).reset_index(drop=True)        # one day only: too short on its own
        alone = htf_trend(recent, 5, 1440, 1, offset_hours=-2)["trend"]
        with_history = htf_trend(recent, 5, 1440, 1, source=df, offset_hours=-2)["trend"]
        self.assertEqual(set(alone), {0})
        self.assertEqual(set(with_history), {1})


class TestLiquidityTargets(unittest.TestCase):
    def _strategy(self, prices, **kw):
        cfg = Config().strategy
        for k, v in kw.items():
            setattr(cfg, k, v)
        st = NelsonStrategy(cfg)
        st.book = LiquidityBook(0.1, 48)
        st.book.levels = [Level(p, "BSL", "Swing high", 0) for p in prices]
        return st

    def test_first_target_partial_and_final_target(self):
        st = self._strategy([101.5, 102.7, 109.0])          # entry 100, risk 1, ATR 1 (pad 0.1)
        tp, partial = st._liquidity_targets(100.0, 1.0, 1, 1.0, 102.5)
        self.assertAlmostEqual(partial, 1.4)
        self.assertAlmostEqual(tp, 102.6)

    def test_final_target_is_capped(self):
        st = self._strategy([101.2, 109.0], final_max_rr=3.0)
        tp, partial = st._liquidity_targets(100.0, 1.0, 1, 1.0, 102.5)
        self.assertAlmostEqual(tp, 103.0)
        self.assertAlmostEqual(partial, 1.1)

    def test_no_liquidity_falls_back_to_fixed_target(self):
        st = self._strategy([])
        tp, partial = st._liquidity_targets(100.0, 1.0, 1, 1.0, 102.5)
        self.assertAlmostEqual(tp, 102.5)
        self.assertIsNone(partial)


class TestNewsDays(unittest.TestCase):
    def setUp(self):
        self.cfg = NewsConfig()

    def test_cpi_day_is_skipped_all_day_and_ppi_is_tier1(self):
        cpi = Event(pd.Timestamp("2026-03-11 12:30"), "USD", "High", "CPI m/m")
        ppi = Event(pd.Timestamp("2026-03-12 12:30"), "USD", "High", "PPI m/m")
        nf = NewsFilter(self.cfg, [cpi, ppi])
        blocked, why = nf.blocked(pd.Timestamp("2026-03-11 19:00"))     # hours after the release
        self.assertTrue(blocked)
        self.assertIn("no trading all day", why)
        self.assertTrue(nf.events[1].tier1)

    def test_other_news_halves_the_risk_that_day_only(self):
        nf = NewsFilter(self.cfg, [Event(pd.Timestamp("2026-03-10 14:00"), "USD", "High", "ISM Services PMI")])
        self.assertEqual(nf.risk_factor(pd.Timestamp("2026-03-10 08:00")), 0.5)
        self.assertEqual(nf.risk_factor(pd.Timestamp("2026-03-09 08:00")), 1.0)
        self.assertFalse(nf.blocked(pd.Timestamp("2026-03-10 08:00"))[0])


class TestMarketEntries(unittest.TestCase):
    def test_market_setup_fills_on_its_own_bar(self):
        cfg = Config()
        f = prepare(random_walk(3, seed=2), cfg.strategy, 5)
        i = 400
        c = float(f["close"].iat[i])
        s = Setup(index=i, time=f["time"].iat[i], direction=-1, entry=c, sl=c + 3, tp=c - 6, expiry_index=i + 12,
                  atr=1.0, level_name="Swing high", level_price=c + 2, sweep_extreme=c + 2.5, fvg_low=np.nan,
                  fvg_high=np.nan, market=True)
        res = simulate(f, [s], cfg)
        self.assertEqual(len(res.trades), 1)
        self.assertEqual(res.trades[0].fill_index, i)

    def test_default_strategy_finds_trades_with_daily_bias(self):
        cfg = Config()
        self.assertTrue(cfg.strategy.use_daily_bias)
        self.assertEqual(cfg.strategy.target_mode, "liquidity")
        f = prepare(random_walk(40, seed=7), cfg.strategy, 5)
        st = NelsonStrategy(cfg.strategy)
        setups = st.scan(f)
        for s in setups:                                    # every setup agrees with the daily structure
            self.assertEqual(int(f["daily_trend"].iat[s.index]), s.direction)
            self.assertTrue(s.features["daily_aligned"])
        self.assertTrue(any("daily bias" in w for _, _, w in st.rejected))


class TestLondonLevels(unittest.TestCase):
    def test_london_range_known_after_the_session(self):
        df = random_walk(2, seed=4)
        lv = session_levels(df, ("07:00", "12:00"), 5, "london")
        t = df["time"]
        morning = (t.dt.hour < 12) & (t.dt.normalize() == t.iloc[0].normalize())
        self.assertTrue(lv.loc[morning, "london_high"].isna().all())
        day1 = (t.dt.normalize() == t.iloc[0].normalize()) & (t.dt.hour >= 12)
        inside = df[(t.dt.normalize() == t.iloc[0].normalize()) & (t.dt.hour >= 7) & (t.dt.hour < 12)]
        self.assertAlmostEqual(lv.loc[day1, "london_high"].iloc[0], inside["high"].max())


if __name__ == "__main__":
    unittest.main()
