"""Trade journal: every signal, order, fill and exit with the reasoning, as CSV."""
from __future__ import annotations

import csv
from datetime import datetime, timezone
from pathlib import Path

FIELDS = ["logged_utc", "event", "side", "price", "sl", "tp", "lots", "ticket", "pnl", "details", "pips"]


class Journal:
    def __init__(self, folder: str):
        self.path = Path(folder) / "journal.csv"
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            with self.path.open("w", newline="", encoding="utf-8") as fh:
                csv.writer(fh).writerow(FIELDS)
        else:
            self._upgrade()

    def _upgrade(self) -> None:
        """Adds the newer columns (pips) to a journal written by an older Nelson."""
        with self.path.open(newline="", encoding="utf-8") as fh:
            if fh.readline().strip().split(",") == FIELDS:
                return
        with self.path.open(newline="", encoding="utf-8") as fh:
            rows = list(csv.DictReader(fh))
        with self.path.open("w", newline="", encoding="utf-8") as fh:
            w = csv.DictWriter(fh, FIELDS, extrasaction="ignore")
            w.writeheader()
            w.writerows(rows)

    def write(self, event: str, **kw) -> None:
        row = {"logged_utc": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"), "event": event, **kw}
        with self.path.open("a", newline="", encoding="utf-8") as fh:
            csv.DictWriter(fh, FIELDS, extrasaction="ignore").writerow(row)
