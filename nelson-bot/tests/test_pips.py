"""Pips (gold: 1 pip = $0.10) and trading in every session."""
import csv
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

import pandas as pd

from nelson.config import Config
from nelson.journal import FIELDS, Journal
from nelson.sessions import in_windows
from nelson.signals import SignalBook


def setup(entry=2000.0, sl=1995.0, tp=2010.0):
    return SimpleNamespace(time=pd.Timestamp("2026-01-05 03:00"), side="BUY", direction=1, entry=entry, sl=sl, tp=tp,
                           risk=abs(entry - sl), level_name="Asia low", steps=[], reasons=[], features={})


class TestPips(unittest.TestCase):
    def test_every_session_by_default(self):
        cfg = Config()
        times = pd.Series(pd.date_range("2026-01-05", periods=288, freq="5min"))
        self.assertTrue(in_windows(times, cfg.strategy.killzones_utc).all())
        self.assertAlmostEqual(cfg.strategy.pip_size, 0.10)

    def test_signal_pips_and_results(self):
        with tempfile.TemporaryDirectory() as d:
            book = SignalBook(Path(d) / "s.json", spread=0.0)
            x = book.add_setup(setup(), 5, 12, 2.0, "price")
            self.assertEqual((x["sl_pips"], x["tp_pips"]), (50.0, 100.0))
            book.on_bar(pd.Timestamp("2026-01-05 03:10"), 2001.0, 1999.0)   # fills
            book.on_bar(pd.Timestamp("2026-01-05 03:15"), 2011.0, 2001.0)   # target
            self.assertEqual(x["status"], "tp")
            self.assertEqual(x["result_pips"], 100.0)

    def test_old_journal_gets_pips_column(self):
        with tempfile.TemporaryDirectory() as d:
            p = Path(d) / "journal.csv"
            old = FIELDS[:-1]
            with p.open("w", newline="", encoding="utf-8") as fh:
                w = csv.writer(fh)
                w.writerow(old)
                w.writerow(["2026-01-05 03:00:00", "closed", "", "", "", "", "", "1", "12.5", ""])
            j = Journal(d)
            j.write("closed", ticket=2, pnl=-5.0, pips=-50.0)
            rows = list(csv.DictReader(p.open(encoding="utf-8")))
            self.assertEqual(rows[0]["pnl"], "12.5")
            self.assertEqual(rows[1]["pips"], "-50.0")


if __name__ == "__main__":
    unittest.main()
