import sys
import unittest
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.insert(0, str(Path(__file__).resolve().parent))

from nelson.backtest import run_backtest, simulate
from nelson.config import Config, NewsConfig
from nelson.indicators import confirmed_pivots
from nelson.liquidity import LiquidityBook
from nelson.news import NewsFilter
from nelson.orderflow import bar_delta_proxy, tick_delta
from nelson.risk import RiskManager
from nelson.strategy import NelsonStrategy, Setup, prepare
from nelson.structure import market_structure
from synthetic import classic, planted_short, random_walk


def loose_cfg() -> Config:
    return classic(Config())


class TestPivotsAndStructure(unittest.TestCase):
    def test_pivot_is_known_only_k_bars_later(self):
        high = np.array([1, 2, 5, 2, 1, 1, 1], float)
        low = high - 0.5
        hc, hp, _, _ = confirmed_pivots(high, low, 2)
        self.assertEqual(list(np.where(hc)[0]), [4])
        self.assertEqual(hp[4], 5)

    def test_bullish_break_of_structure(self):
        close = [10, 11, 13, 11, 10, 10.5, 12, 14]
        df = pd.DataFrame({"open": close, "high": np.array(close) + 0.1, "low": np.array(close) - 0.1, "close": close})
        st = market_structure(df, 2)
        self.assertEqual(st["trend"].iloc[-1], 1)
        self.assertEqual(st["bos"].iloc[-1], 1)


class TestLiquidity(unittest.TestCase):
    def test_sweep_versus_break(self):
        t = 0
        book = LiquidityBook(0.1, 48)
        book.add(100.0, "BSL", "PDH", t, 1.0)
        book.add(90.0, "SSL", "PDL", t, 1.0)
        bsl, ssl = book.check(high=100.5, low=99, close=99.8)   # wick above, close back below = sweep
        self.assertEqual([l.name for l in bsl], ["PDH"])
        bsl, ssl = book.check(high=99, low=89, close=89.5)      # closed below = break, not sweep
        self.assertEqual(ssl, [])

    def test_equal_highs_merge(self):
        t = 0
        book = LiquidityBook(0.2, 48)
        book.add(100.0, "BSL", "Swing high", t, 1.0)
        book.add(100.1, "BSL", "Swing high", t, 1.0)
        self.assertEqual(len(book.levels), 1)
        self.assertEqual(book.levels[0].name, "Equal highs")


class TestStrategy(unittest.TestCase):
    def test_finds_planted_short_setup(self):
        df, i = planted_short(random_walk(10, seed=3), "2025-03-06 08:30")
        f = prepare(df, loose_cfg().strategy)
        setups = NelsonStrategy(loose_cfg().strategy).scan(f)
        near = [s for s in setups if i <= s.index <= i + 3]
        self.assertTrue(near, "planted sweep + displacement + FVG should give a setup")
        s = near[0]
        self.assertEqual(s.direction, -1)
        self.assertGreater(s.sl, s.sweep_extreme)
        self.assertLess(s.tp, s.entry)
        self.assertAlmostEqual((s.entry - s.tp) / (s.sl - s.entry), 2.5, places=1)

    def test_no_lookahead(self):
        """Setups found on a prefix of the data must be identical to those found on all of it."""
        df = random_walk(15, seed=7)
        cfg = loose_cfg().strategy
        cfg.require_volume_spike = False
        full = NelsonStrategy(cfg).scan(prepare(df, cfg))
        cut = len(df) * 2 // 3
        part = NelsonStrategy(cfg).scan(prepare(df.iloc[:cut], cfg))
        key = lambda s: (s.index, s.direction, s.entry, s.sl, s.tp)
        self.assertGreater(len(full), 0)
        self.assertEqual([key(s) for s in part], [key(s) for s in full if s.index < cut])

    def test_killzone_filter(self):
        df, i = planted_short(random_walk(10, seed=3), "2025-03-06 03:00")   # Asian session
        cfg = loose_cfg().strategy
        strat = NelsonStrategy(cfg)
        setups = strat.scan(prepare(df, cfg))
        self.assertFalse([s for s in setups if i <= s.index <= i + 3])
        self.assertTrue(any("killzone" in why for idx, _, why in strat.rejected if i <= idx <= i + 3))


class TestRisk(unittest.TestCase):
    def test_lot_size_risks_exact_percent(self):
        rm = RiskManager(Config().risk, 10_000)
        # $5 stop on gold = $500 per lot; 0.5% of 10k = $50 -> 0.10 lots
        self.assertAlmostEqual(rm.lot_size(10_000, 500, 0.01, 0.01, 100), 0.10)

    def test_too_small_account_skips(self):
        rm = RiskManager(Config().risk, 100)
        self.assertEqual(rm.lot_size(100, 2000, 0.01, 0.01, 100), 0.0)

    def test_daily_loss_and_streak_limits(self):
        cfg = Config().risk
        rm = RiskManager(cfg, 10_000)
        rm.new_day("d1", 10_000)
        self.assertTrue(rm.can_open(10_000, 9_850, 0)[0])
        self.assertFalse(rm.can_open(10_000, 9_790, 0)[0])        # 2.1% down today
        for _ in range(3):
            rm.on_close(-50, 9_900)
        self.assertFalse(rm.can_open(9_900, 9_900, 0)[0])
        rm.new_day("d2", 9_900)
        self.assertTrue(rm.can_open(9_900, 9_900, 0)[0])

    def test_max_drawdown_halts(self):
        rm = RiskManager(Config().risk, 10_000)
        ok, why = rm.can_open(8_900, 8_900, 0)
        self.assertFalse(ok)
        self.assertIn("halted", why)


class TestNews(unittest.TestCase):
    def setUp(self):
        self.cfg = NewsConfig()
        items = [
            {"title": "Non-Farm Employment Change", "country": "USD", "date": "2025-03-07T08:30:00-05:00", "impact": "High"},
            {"title": "Retail Sales m/m", "country": "USD", "date": "2025-03-10T08:30:00-04:00", "impact": "High"},
            {"title": "German Factory Orders", "country": "EUR", "date": "2025-03-07T07:00:00+00:00", "impact": "High"},
            {"title": "Crude Oil Inventories", "country": "USD", "date": "2025-03-07T15:30:00+00:00", "impact": "Medium"},
        ]
        self.nf = NewsFilter(self.cfg, NewsFilter.parse_forexfactory(items))

    def test_only_high_impact_usd(self):
        self.assertEqual([e.title for e in self.nf.events], ["Non-Farm Employment Change", "Retail Sales m/m"])
        self.assertTrue(self.nf.events[0].tier1)

    def test_nfp_day_is_skipped_all_day(self):
        blocked, why = self.nf.blocked(pd.Timestamp("2025-03-07 19:00"))     # hours after NFP
        self.assertTrue(blocked)
        self.assertIn("no trading all day", why)

    def test_windows(self):
        self.cfg.skip_day_keywords = []          # only the time windows around each release
        nfp = pd.Timestamp("2025-03-07 13:30")   # 08:30 EST = 13:30 UTC
        self.assertTrue(self.nf.blocked(nfp - pd.Timedelta(minutes=55))[0])    # tier 1: 60 min before
        self.assertFalse(self.nf.blocked(nfp - pd.Timedelta(minutes=65))[0])
        retail = pd.Timestamp("2025-03-10 12:30")   # 08:30 EDT = 12:30 UTC
        self.assertTrue(self.nf.blocked(retail + pd.Timedelta(minutes=25))[0])
        self.assertFalse(self.nf.blocked(retail + pd.Timedelta(minutes=35))[0])

    def test_unavailable_blocks_by_default(self):
        nf = NewsFilter(self.cfg)
        self.assertTrue(nf.blocked(pd.Timestamp("2025-03-07"))[0])


class TestOrderFlow(unittest.TestCase):
    def test_bar_delta_sign(self):
        df = pd.DataFrame({"open": [1, 2], "high": [2, 2], "low": [1, 1], "close": [2, 1], "tick_volume": [100, 50]})
        self.assertEqual(list(bar_delta_proxy(df)), [100, -50])

    def test_tick_rule(self):
        ticks = pd.DataFrame({"time": pd.to_datetime(["2025-01-01 10:00:01", "2025-01-01 10:00:02",
                                                      "2025-01-01 10:00:03", "2025-01-01 10:05:01"]),
                              "bid": [1.0, 1.1, 1.1, 1.0], "flags": [2, 2, 2, 2]})
        bars = pd.Series(pd.to_datetime(["2025-01-01 10:00", "2025-01-01 10:05"]))
        d = tick_delta(ticks, bars, 5)
        self.assertEqual(list(d), [2.0, -1.0])


class TestBacktest(unittest.TestCase):
    def _one_setup(self, df, direction, entry, sl, tp):
        f = prepare(df, Config().strategy)
        s = Setup(index=100, time=f["time"].iat[100], direction=direction, entry=entry, sl=sl, tp=tp,
                  expiry_index=120, atr=1.0, level_name="PDH", level_price=0, sweep_extreme=0, fvg_low=0, fvg_high=0)
        cfg = Config()
        cfg.strategy.partial_at_r = 0
        cfg.strategy.breakeven_at_r = 0
        cfg.backtest.slippage_usd = 0
        cfg.backtest.commission_per_lot = 0
        return simulate(f, [s], cfg)

    def _flat(self, n=300, price=2000.0):
        t = pd.date_range("2025-03-03 08:00", periods=n, freq="5min")
        return pd.DataFrame({"time": t, "open": price, "high": price + 0.1, "low": price - 0.1, "close": price, "tick_volume": 100.0})

    def test_short_hits_target_with_spread(self):
        df = self._flat()
        df.loc[105, ["high", "close"]] = [2005.0, 2004.0]          # rally fills the sell limit at 2004
        df.loc[110:, ["open", "high", "low", "close"]] = 1990.0       # then drop to target
        res = self._one_setup(df, -1, 2004.0, 2008.0, 1994.0)
        t = res.trades[0]
        self.assertEqual(t.exit_reason, "target")
        # 0.5% of 10k = $50 risk, $4 stop = $400/lot -> 0.12 lots; win 10 * 100 * 0.12 = $120
        self.assertAlmostEqual(t.lots, 0.12)
        self.assertAlmostEqual(t.pnl, 120.0)

    def test_same_bar_stop_and_target_is_a_loss(self):
        df = self._flat()
        df.loc[105, ["high", "close"]] = [2004.5, 2004.0]
        df.loc[106, ["high", "low"]] = [2009.0, 1990.0]               # huge bar through both
        res = self._one_setup(df, -1, 2004.0, 2008.0, 1994.0)
        self.assertEqual(res.trades[0].exit_reason, "stop")
        self.assertLess(res.trades[0].pnl, 0)

    def test_full_run_on_random_data_is_consistent(self):
        cfg = loose_cfg()
        res = run_backtest(random_walk(60, seed=11), cfg)
        st = res.stats()
        self.assertGreaterEqual(st["trades"], 0)
        bal = cfg.backtest.initial_balance + sum(t.pnl for t in res.trades)
        self.assertAlmostEqual(res.equity.iloc[-1], bal, places=4)
        for t in res.trades:   # never more than ~risk% lost on a single trade
            self.assertGreater(t.pnl, -cfg.backtest.initial_balance * 0.012)


class TestGoldSymbol(unittest.TestCase):
    def sym(self, name, desc="", base="", profit=""):
        from types import SimpleNamespace
        return SimpleNamespace(name=name, description=desc, currency_base=base, currency_profit=profit)

    def test_finds_broker_variants(self):
        from nelson.mt5_broker import find_gold_symbol
        eur = self.sym("EURUSD", "Euro vs US Dollar", "EUR", "USD")
        self.assertEqual(find_gold_symbol([eur, self.sym("XAUUSDm", "Gold Spot vs US Dollar", "XAU", "USD")]), "XAUUSDm")
        self.assertEqual(find_gold_symbol([self.sym("XAUUSD.r"), self.sym("XAUUSD")]), "XAUUSD")
        self.assertEqual(find_gold_symbol([eur, self.sym("GOLD", "Gold Spot vs US Dollar")]), "GOLD")
        self.assertEqual(find_gold_symbol([self.sym("XAUEUR", "Gold vs Euro", "XAU", "EUR"), eur]), None)
        self.assertEqual(find_gold_symbol([self.sym("GC_Z6", "Gold Futures (US Dollar)")]), None)


if __name__ == "__main__":
    unittest.main()
