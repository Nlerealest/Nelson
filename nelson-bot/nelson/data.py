"""Loading XAUUSD price history for backtests."""
from __future__ import annotations

import io
import logging
import lzma
import struct
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

log = logging.getLogger("nelson.data")
COLUMNS = ["time", "open", "high", "low", "close", "tick_volume"]


def load_csv(path: str, utc_offset_hours: float = 0.0) -> pd.DataFrame:
    """Reads bars from a CSV.

    Accepts the MetaTrader 5 export (History Center / right-click chart ->
    Bars -> Export: <DATE> <TIME> <OPEN> ... tab separated) or any CSV with
    time, open, high, low, close and a volume column. `utc_offset_hours` is the
    broker clock offset (e.g. 2 or 3 for most brokers) and is removed so that
    all times are UTC.
    """
    raw = pd.read_csv(path, sep=None, engine="python")
    raw.columns = [c.strip("<>").strip().lower() for c in raw.columns]
    if "date" in raw and "time" in raw:
        t = pd.to_datetime(raw["date"].astype(str) + " " + raw["time"].astype(str))
    else:
        tcol = next(c for c in raw.columns if c in ("time", "datetime", "timestamp", "date", "gmt time", "local time"))
        t = pd.to_datetime(raw[tcol], dayfirst=tcol in ("gmt time", "local time"), utc=False)
        if getattr(t.dt, "tz", None) is not None:
            t = t.dt.tz_convert("UTC").dt.tz_localize(None)
    vol = next((c for c in ("tick_volume", "tickvol", "volume", "vol") if c in raw), None)
    df = pd.DataFrame({
        "time": t - pd.Timedelta(hours=utc_offset_hours),
        "open": raw["open"].astype(float), "high": raw["high"].astype(float),
        "low": raw["low"].astype(float), "close": raw["close"].astype(float),
        "tick_volume": raw[vol].astype(float) if vol else 1.0,
    })
    if "spread" in raw:
        df["spread"] = raw["spread"].astype(float)
    return df.sort_values("time").drop_duplicates("time").reset_index(drop=True)


def resample_bars(df: pd.DataFrame, minutes: int) -> pd.DataFrame:
    agg = {"open": "first", "high": "max", "low": "min", "close": "last", "tick_volume": "sum"}
    out = df.set_index("time")[list(agg)].resample(f"{minutes}min", label="left", closed="left").agg(agg)
    return out.dropna(subset=["open"]).reset_index()


def download_dukascopy(start: date, end: date, out_csv: str, symbol: str = "XAUUSD", minutes: int = 5) -> pd.DataFrame:
    """Downloads free 1-minute XAUUSD bid candles from Dukascopy (times in UTC) and saves `minutes` bars.

    Dukascopy volume is used as the tick-volume stand-in. Their prices can
    differ from your broker's by a few cents; for final checks use your own
    broker's history exported from MT5.
    """
    import requests

    frames = []
    day = start
    session = requests.Session()
    session.headers["User-Agent"] = "Mozilla/5.0 Nelson/1.0"
    while day <= end:
        if day.weekday() != 5:   # no gold trading on Saturday
            url = (f"https://datafeed.dukascopy.com/datafeed/{symbol}/{day.year}/{day.month - 1:02d}/"
                   f"{day.day:02d}/BID_candles_min_1.bi5")
            try:
                r = session.get(url, timeout=30)
                if r.status_code == 200 and r.content:
                    frames.append(_parse_bi5_candles(r.content, day))
            except Exception as exc:
                log.warning("%s: %s", day, exc)
        day += timedelta(days=1)
        if day.day == 1:
            log.info("downloaded up to %s", day)
    if not frames:
        raise RuntimeError("No data downloaded")
    df = pd.concat(frames, ignore_index=True)
    df = df[df["tick_volume"] > 0]
    if minutes > 1:
        df = resample_bars(df, minutes)
    Path(out_csv).parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_csv, index=False)
    return df


def _parse_bi5_candles(blob: bytes, day: date, point: float = 0.001) -> pd.DataFrame:
    data = lzma.LZMADecompressor().decompress(blob)
    rows = []
    base = pd.Timestamp(day)
    rec = struct.Struct(">5if")
    with io.BytesIO(data) as buf:
        while chunk := buf.read(rec.size):
            if len(chunk) < rec.size:
                break
            secs, o, c, lo, hi, vol = rec.unpack(chunk)
            rows.append((base + pd.Timedelta(seconds=secs), o * point, hi * point, lo * point, c * point, vol))
    return pd.DataFrame(rows, columns=COLUMNS)
