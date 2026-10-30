"""Nelson's playbook: several trading strategies hunting setups side by side.

Each strategy walks the same prepared M5 bars and uses only what was known at a bar's close. Every setup
carries its strategy's name, so the learning system tracks each one separately. docs/PLAYBOOK.md has the
rules and the backtest of each. Enable or disable them with `playbook.enabled` in config.yaml.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np
import pandas as pd

from .config import PlaybookConfig, StrategyConfig
from .sessions import in_windows, session_name
from .strategy import NelsonStrategy, Setup

LABELS = {
    "tjr_bootcamp": "TJR bootcamp (sweep, break, FVG)",
    "tjr_2026": "TJR 2026 (sweep, break or IFVG, retrace, break back)",
    "ict_ote": "ICT optimal trade entry (70.5% retrace)",
    "ict_silver_bullet": "ICT silver bullet (FVG in the 1-hour windows)",
    "ict_judas": "ICT Judas swing (London fakes the Asian range)",
    "orb_gold": "Opening range 07:00-07:15 ET (break and retest)",
    "orb_asia": "Asia opening range 18:00 ET (break and retest)",
    "continuation": "Liquidity break and retest (continuation)",
    "trend": "Trend following (pullback to the 20 EMA)",
    "momentum": "Momentum (breakout with volatility expansion)",
    "mean_reversion": "Mean reversion (Bollinger snap-back in a range)",
}
BSL = (("pdh", "Previous day high"), ("london_high", "London high"), ("asia_high", "Asia high"),
       ("wk_high", "Weekly high"), ("ny_high", "New York high"), ("untested_high", "Untested high"),
       ("h4_high", "4-hour high"), ("h1_high", "1-hour high"))
SSL = (("pdl", "Previous day low"), ("london_low", "London low"), ("asia_low", "Asia low"),
       ("wk_low", "Weekly low"), ("ny_low", "New York low"), ("untested_low", "Untested low"),
       ("h4_low", "4-hour low"), ("h1_low", "1-hour low"))
KEY_LEVELS = {n for _, n in BSL[:6] + SSL[:6]}     # big enough for an early "setup forming" alert
SILVER_BULLET_ET = ((180, 240), (600, 660), (840, 900))     # minutes after midnight, New York time
LONDON_KZ_ET = ((120, 300),)
NY_KZ_ET = ((420, 660),)


def ema(x: np.ndarray, n: int) -> np.ndarray:
    return pd.Series(x).ewm(span=n, adjust=False).mean().to_numpy()


def adx(h: np.ndarray, l: np.ndarray, c: np.ndarray, n: int = 14) -> np.ndarray:
    up, down = np.diff(h, prepend=h[0]), -np.diff(l, prepend=l[0])
    plus = np.where((up > down) & (up > 0), up, 0.0)
    minus = np.where((down > up) & (down > 0), down, 0.0)
    prev = np.roll(c, 1)
    prev[0] = c[0]
    tr = np.maximum.reduce([h - l, np.abs(h - prev), np.abs(l - prev)])
    w = lambda a: pd.Series(a).ewm(alpha=1 / n, adjust=False).mean()
    atr = w(tr).replace(0, np.nan)
    pdi, mdi = 100 * w(plus) / atr, 100 * w(minus) / atr
    dx = (100 * (pdi - mdi).abs() / (pdi + mdi).replace(0, np.nan)).fillna(0)
    return w(dx.to_numpy()).to_numpy()


def rsi(c: np.ndarray, n: int = 14) -> np.ndarray:
    d = np.diff(c, prepend=c[0])
    w = lambda a: pd.Series(a).ewm(alpha=1 / n, adjust=False).mean()
    return (100 - 100 / (1 + w(np.maximum(d, 0)) / w(np.maximum(-d, 0)))).fillna(50).to_numpy()


@dataclass
class Bars:
    """Arrays and indicators shared by the strategies."""
    f: pd.DataFrame

    def __post_init__(self):
        f = self.f
        self.n = len(f)
        self.t = f["time"]
        self.o, self.h, self.l, self.c = (f[k].to_numpy() for k in ("open", "high", "low", "close"))
        self.a = f["atr"].to_numpy()
        self.vol = f["rel_volume"].to_numpy()
        self.m15 = f["m15_close"].to_numpy()
        self.daily, self.h4 = f["daily_trend"].to_numpy(), f["h4_trend"].to_numpy()
        et = f["time"].dt.tz_localize("UTC").dt.tz_convert("America/New_York")
        self.et_min = (et.dt.hour * 60 + et.dt.minute).to_numpy()
        self.et_day = et.dt.strftime("%Y%m%d").to_numpy()
        self.ema20, self.ema50, self.ema200 = ema(self.c, 20), ema(self.c, 50), ema(self.c, 200)
        self.adx = adx(self.h, self.l, self.c)
        self.rsi = rsi(self.c)
        s = pd.Series(self.c)
        mid, sd = s.rolling(20).mean(), s.rolling(20).std()
        self.bb_mid, self.bb_hi, self.bb_lo = mid.to_numpy(), (mid + 2 * sd).to_numpy(), (mid - 2 * sd).to_numpy()
        self.atr_fast = pd.Series(self.a).rolling(6).mean().to_numpy()
        self.atr_slow = pd.Series(self.a).rolling(96).mean().to_numpy()
        hs, ls = pd.Series(self.h), pd.Series(self.l)
        self.dc_hi, self.dc_lo = hs.rolling(48).max().shift(1).to_numpy(), ls.rolling(48).min().shift(1).to_numpy()
        self.levels = {k: f[k].to_numpy() for k, _ in BSL + SSL if k in f}
        for bars, name in ((12, "h1"), (48, "h4"), (1440, "wk")):
            self.levels[f"{name}_high"] = hs.rolling(bars, min_periods=bars // 2).max().shift(1).to_numpy()
            self.levels[f"{name}_low"] = ls.rolling(bars, min_periods=bars // 2).min().shift(1).to_numpy()
        self.last_sh = f["sh_price"].where(f["sh_confirmed"].astype(bool)).ffill().to_numpy()
        self.last_sl = f["sl_price"].where(f["sl_confirmed"].astype(bool)).ffill().to_numpy()
        self.sweeps = self._sweeps()

    def _sweeps(self) -> list[tuple[int, int, str, float]]:
        """(bar, direction to trade, level name, level): wick through a level, close back inside, first touch."""
        out = []
        h, l, c = self.h, self.l, self.c
        for i in range(1, self.n):
            for key, name in BSL:
                x = self.levels.get(key)
                if x is not None and h[i] > x[i] > c[i] and h[i - 1] <= x[i]:
                    out.append((i, -1, name, float(x[i])))
                    break
            for key, name in SSL:
                x = self.levels.get(key)
                if x is not None and l[i] < x[i] < c[i] and l[i - 1] >= x[i]:
                    out.append((i, 1, name, float(x[i])))
                    break
        return out

    def in_et(self, i: int, windows) -> bool:
        return any(a <= self.et_min[i] < b for a, b in windows)


class Playbook:
    """Same interface as NelsonStrategy, for every enabled strategy together."""

    def __init__(self, cfg: StrategyConfig, pb: PlaybookConfig, news_filter=None):
        self.cfg, self.pb = cfg, pb
        self.core = NelsonStrategy(cfg, news_filter)
        self.rejected: list[tuple[int, str, str]] = []

    @property
    def news(self):
        return self.core.news

    @news.setter
    def news(self, value) -> None:
        self.core.news = value

    @property
    def book(self):
        return self.core.book

    @property
    def skipped(self):
        return self.core.skipped

    def scan(self, f: pd.DataFrame) -> list[Setup]:
        on = list(self.pb.enabled) + [w for w in self.pb.watch if w not in self.pb.enabled]
        setups: list[Setup] = []
        if "tjr_bootcamp" in on:
            setups = self.core.scan(f)
            for s in setups:
                s.strategy = "tjr_bootcamp"
                s.features["strategy"] = "tjr_bootcamp"
        self.rejected = list(self.core.rejected)
        x = self.bars = Bars(f)
        self._last: dict[str, int] = {}
        runs = {
            "tjr_2026": lambda: self._reversal(x, "tjr_2026", "retrace"),
            "ict_ote": lambda: self._reversal(x, "ict_ote", "ote", windows=LONDON_KZ_ET + NY_KZ_ET),
            "ict_silver_bullet": lambda: self._reversal(x, "ict_silver_bullet", "fvg", windows=SILVER_BULLET_ET),
            "ict_judas": lambda: self._reversal(x, "ict_judas", "fvg", windows=LONDON_KZ_ET, only=("Asia high", "Asia low")),
            "orb_gold": lambda: self._orb(x, "orb_gold", 420, 3, 60),
            "orb_asia": lambda: self._orb(x, "orb_asia", 1080, 1, 48),
            "continuation": lambda: self._continuation(x),
            "trend": lambda: self._trend(x),
            "momentum": lambda: self._momentum(x),
            "mean_reversion": lambda: self._mean_reversion(x),
        }
        for name, run in runs.items():
            if name in on:
                setups += run()
        rank = {n: k for k, n in enumerate(on)}
        setups.sort(key=lambda s: (s.index, rank.get(s.strategy, 99)))
        seen, out = set(), []
        for s in setups:              # one traded setup per candle
            s.watch_only = s.strategy not in self.pb.enabled
            if s.watch_only or s.index not in seen:
                out.append(s)
            if not s.watch_only:
                seen.add(s.index)
        return out

    def forming(self, i: int) -> list[tuple[int, str, float]]:
        """Key levels swept on bar i: a setup may follow, so the trader gets an early warning."""
        return [(d, name, level) for k, d, name, level in self.bars.sweeps if k == i and name in KEY_LEVELS]

    # ---------- shared
    def _emit(self, x: Bars, name, i, d, entry, sl, tp, level, details, market=True, partial_r=None,
              bias=True, cooldown=12) -> Setup | None:
        c, m = self.cfg, x.f.attrs.get("bar_minutes", 5)
        side = "BUY" if d > 0 else "SELL"
        ai = float(x.a[i])
        risk = (entry - sl) * d
        if i - self._last.get(name, -10 ** 9) < cooldown or risk <= 0 or np.isnan(ai):
            return None
        close_time = x.t.iat[i] + pd.Timedelta(minutes=m)
        blocked, event = self.news.blocked(close_time) if self.news is not None else (False, None)
        checks = [(c.min_sl_atr * ai <= risk <= c.max_sl_atr * ai, f"stop {risk:.2f} outside the ATR limits"),
                  ((tp - entry) * d / risk >= self.pb.min_rr, "target too close"),
                  (not bias or not c.use_daily_bias or x.daily[i] == d, "against the daily bias"),
                  (not bool(x.f["friday_late"].iat[i]), "late Friday"),
                  (bool(x.f["in_killzone"].iat[i]), "outside the trading-hours killzones"),
                  (name not in self.pb.need_h4 or x.h4[i] == d, "against the 4-hour structure"),
                  (name not in self.pb.hours_utc or in_windows(x.t.iloc[[i]], self.pb.hours_utc[name])[0],
                   "outside this strategy's hours"),
                  (not blocked, f"news: {event}")]
        why = next((w for ok, w in checks if not ok), None)
        if why is not None:
            if name in self.pb.enabled:
                self.rejected.append((i, side, f"{name}: {why}"))
            return None
        self._last[name] = i
        steps = [{"title": "Strategy", "ok": True, "detail": LABELS[name]}]
        steps += [{"title": t, "ok": True, "detail": v} for t, v in details]
        steps.append({"title": "Risk", "ok": True,
                      "detail": f"Stop {risk / c.pip_size:.0f} pips, target {(tp - entry) * d / c.pip_size:.0f} pips "
                                f"({(tp - entry) * d / risk:.1f}R)"})
        features = {"strategy": name, "side": side, "level": level, "session": session_name(close_time),
                    "hour": int(close_time.hour), "daily_aligned": bool(x.daily[i] == d),
                    "h4_aligned": bool(x.h4[i] == d), "sl_atr": round(risk / ai, 2),
                    "regime": "trend" if x.adx[i] >= 25 else "range" if x.adx[i] < 20 else "mixed"}
        return Setup(index=i, time=x.t.iat[i], direction=d, entry=round(float(entry), 2), sl=round(float(sl), 2),
                     tp=round(float(tp), 2), expiry_index=i + c.order_expiry_bars, atr=ai, level_name=level,
                     level_price=float(entry), sweep_extreme=float(sl), fvg_low=float("nan"), fvg_high=float("nan"),
                     reasons=[LABELS[name]] + [v for _, v in details], steps=steps, features=features,
                     market=market, partial_r=partial_r, strategy=name)

    def _target(self, x: Bars, i, d, entry, risk) -> tuple[float, float | None]:
        """Next liquidity (TJR): first level at least 1R away for the partial, a later one as the target."""
        keys = [k for k, _ in (BSL if d > 0 else SSL)]
        dists = sorted(r for r in (((x.levels[k][i] - entry) * d) / risk for k in keys if k in x.levels)
                       if r == r and r >= 1.0)
        pb = self.pb
        final = next((r for r in dists if r >= pb.target_rr), pb.target_rr)
        final = min(final, pb.max_rr)
        first = dists[0] if dists and dists[0] < final else None
        return entry + d * final * risk, first

    @staticmethod
    def _fvg(x: Bars, a, b, d) -> tuple[float, float] | None:
        """Latest fair value gap in direction d between bars a and b."""
        for k in range(b, max(a, 2) - 1, -1):
            if d > 0 and x.l[k] > x.h[k - 2]:
                return float(x.h[k - 2]), float(x.l[k])
            if d < 0 and x.h[k] < x.l[k - 2]:
                return float(x.h[k]), float(x.l[k - 2])
        return None

    @staticmethod
    def _ifvg_edge(x: Bars, i, d) -> float | None:
        """Far edge of the last opposing gap (stacked gaps: the lowest group's edge) in the move into a sweep."""
        edge = None
        for k in range(i, max(i - 12, 2), -1):
            bull, bear = x.l[k] > x.h[k - 2], x.h[k] < x.l[k - 2]
            if (d < 0 and bull) or (d > 0 and bear):
                edge = float(x.h[k - 2]) if d < 0 else float(x.l[k - 2])
            elif edge is not None:
                break
        return edge

    # ---------- reversals: sweep, confirmation, then each school's entry
    def _reversal(self, x: Bars, name, mode, windows=None, only=None) -> list[Setup]:
        out = []
        pb = self.pb
        for i0, d, level_name, level in x.sweeps:
            if only and level_name not in only:
                continue
            extreme = x.h[i0] if d < 0 else x.l[i0]
            internal = x.last_sl[i0] if d < 0 else x.last_sh[i0]
            ifvg = self._ifvg_edge(x, i0, d)
            j = None
            for k in range(i0 + 1, min(i0 + pb.confirm_bars + 1, x.n)):
                if (x.c[k] - level) * d < 0:          # accepted beyond the level: the sweep failed
                    break
                extreme = min(extreme, x.l[k]) if d > 0 else max(extreme, x.h[k])
                if self.cfg.use_m15_reaction and (x.m15[k] - level) * d <= 0:
                    continue
                broke = internal == internal and (x.c[k] - internal) * d > 0
                inv = ifvg is not None and (x.c[k] - ifvg) * d > 0
                if broke or inv:
                    j = k
                    how = "Break of structure" if broke else "Inverse fair value gap"
                    break
            if j is None:
                continue
            leg_end = x.h[i0:j + 1].max() if d > 0 else x.l[i0:j + 1].min()
            pad = self.cfg.sl_buffer_atr * x.a[j]
            sl = extreme - d * pad
            base = [("Liquidity sweep", f"Took the {level_name} at {level:.2f}"), ("Confirmation", how)]
            s = None
            if mode in ("ote", "fvg"):
                if windows and not x.in_et(j, windows):
                    continue
                if mode == "ote":
                    entry = leg_end - d * pb.ote_level * abs(leg_end - extreme)
                    base.append(("Entry", f"Limit at the {pb.ote_level:.1%} retrace of the leg, {entry:.2f}"))
                else:
                    gap = self._fvg(x, i0, j, d)
                    if gap is None:
                        continue
                    entry = sum(gap) / 2
                    base.append(("Entry", f"Limit in the fair value gap {gap[0]:.2f}-{gap[1]:.2f}"))
                risk = (entry - sl) * d
                if risk <= 0:
                    continue
                tp, first = self._target(x, j, d, entry, risk)
                s = self._emit(x, name, j, d, entry, sl, tp, level_name, base, market=False, partial_r=first)
            else:
                # TJR 2026: wait for a pullback, then enter when price breaks back with the new trend
                back = None
                pull = None
                for k in range(j + 1, min(j + pb.retrace_bars + 1, x.n)):
                    if (x.c[k] - extreme) * d <= 0:
                        break
                    if pull is None:
                        if (x.c[k] > x.h[k - 1]) if d < 0 else (x.c[k] < x.l[k - 1]):   # pullback starts
                            pull = k
                        continue
                    if d < 0 and x.c[k] < x.l[pull:k].min():
                        back = k
                        break
                    if d > 0 and x.c[k] > x.h[pull:k].max():
                        back = k
                        break
                if back is None:
                    continue
                far = x.h[pull:back + 1].max() if d < 0 else x.l[pull:back + 1].min()
                entry = float(x.c[back])
                sl = far - d * pad
                risk = (entry - sl) * d
                if risk <= 0:
                    continue
                tp, first = self._target(x, back, d, entry, risk)
                base.append(("Entry", "Retrace, then a close back with the trend; stop beyond the retrace"))
                s = self._emit(x, name, back, d, entry, sl, tp, level_name, base, partial_r=first)
            if s is not None:
                out.append(s)
        return out

    # ---------- opening range: mark it, wait for a break and a retest, target liquidity
    def _orb(self, x: Bars, name, start_et, range_bars, active_bars) -> list[Setup]:
        out = []
        pb = self.pb
        for i in np.flatnonzero(x.et_min == start_et):
            end = i + range_bars
            if end + 2 >= x.n or x.et_day[end - 1] != x.et_day[i]:
                continue
            hi, lo = x.h[i:end].max(), x.l[i:end].min()
            ai = x.a[end - 1]
            if not ai > 0 or not pb.orb_min_range_atr <= (hi - lo) / ai <= pb.orb_max_range_atr:
                continue
            broke, d = None, 0
            for k in range(end, min(end + active_bars, x.n)):
                if broke is None:
                    if x.c[k] > hi or x.c[k] < lo:
                        d = 1 if x.c[k] > hi else -1
                        # filters: volatility expansion and volume on the break
                        if x.atr_fast[k] < pb.orb_expansion * x.atr_slow[k] or x.vol[k] < pb.orb_volume \
                                or x.adx[k] < pb.orb_adx:
                            break
                        broke = k
                    continue
                edge = hi if d > 0 else lo
                if (x.c[k] - edge) * d < 0:          # back inside: failed break
                    break
                touched = x.l[k] <= edge if d > 0 else x.h[k] >= edge
                if touched:
                    entry = float(x.c[k])
                    sl = (x.l[k] if d > 0 else x.h[k]) - d * self.cfg.sl_buffer_atr * x.a[k]
                    risk = (entry - sl) * d
                    if risk <= 0:
                        break
                    tp, first = self._target(x, k, d, entry, risk)
                    s = self._emit(x, name, k, d, entry, sl, tp, "Opening range",
                                   [("Opening range", f"{lo:.2f}-{hi:.2f}"),
                                    ("Break and retest", f"Closed beyond, came back to {edge:.2f} and held"),
                                    ("Filters", f"Volatility expansion, volume x{x.vol[broke]:.1f}, "
                                                f"ADX {x.adx[broke]:.0f}")],
                                   partial_r=first, bias=False)
                    if s is not None:
                        out.append(s)
                    break
        return out

    def _continuation(self, x: Bars) -> list[Setup]:
        """Price closes through a key level with force and holds it on the retest: go with it."""
        out = []
        pb = self.pb
        for i in range(1, x.n - 1):
            d = 0
            for keys, side in ((BSL, 1), (SSL, -1)):
                for key, nm in keys[:4]:
                    lv = x.levels.get(key)
                    if lv is None or lv[i] != lv[i]:
                        continue
                    if (x.c[i] - lv[i]) * side > 0 and (x.c[i - 1] - lv[i]) * side <= 0 \
                            and (x.c[i] - x.o[i]) * side >= pb.cont_body_atr * x.a[i]:
                        d, level, level_name = side, float(lv[i]), nm
                        break
                if d:
                    break
            if not d or x.daily[i] != d:
                continue
            for k in range(i + 1, min(i + 13, x.n)):
                if (x.c[k] - level) * d < 0:
                    break
                if (x.l[k] <= level) if d > 0 else (x.h[k] >= level):
                    entry = float(x.c[k])
                    sl = (x.l[k] if d > 0 else x.h[k]) - d * self.cfg.sl_buffer_atr * x.a[k]
                    risk = (entry - sl) * d
                    if risk > 0:
                        tp, first = self._target(x, k, d, entry, risk)
                        s = self._emit(x, "continuation", k, d, entry, sl, tp, level_name,
                                       [("Break", f"Closed through the {level_name} {level:.2f} with force"),
                                        ("Retest", "Came back to the level and held")], partial_r=first)
                        if s is not None:
                            out.append(s)
                    break
        return out

    # ---------- regime strategies
    def _trend(self, x: Bars) -> list[Setup]:
        out = []
        pb = self.pb
        up = (x.ema20 > x.ema50) & (x.ema50 > x.ema200)
        down = (x.ema20 < x.ema50) & (x.ema50 < x.ema200)
        for i in range(200, x.n):
            d = 1 if up[i] else -1 if down[i] else 0
            if not d or x.adx[i] < pb.trend_adx or x.daily[i] != d:
                continue
            touched = x.l[i] <= x.ema20[i] if d > 0 else x.h[i] >= x.ema20[i]
            if not touched or (x.c[i] - x.ema20[i]) * d <= 0 or (x.c[i] - x.o[i]) * d <= 0:
                continue
            far = x.l[i - 6:i + 1].min() if d > 0 else x.h[i - 6:i + 1].max()
            entry = float(x.c[i])
            sl = far - d * self.cfg.sl_buffer_atr * x.a[i]
            tp = entry + d * pb.target_rr * (entry - sl) * d
            s = self._emit(x, "trend", i, d, entry, sl, tp, "20 EMA",
                           [("Trend", f"20/50/200 EMAs stacked, ADX {x.adx[i]:.0f}"),
                            ("Pullback", "Dipped to the 20 EMA and closed back with the trend")], cooldown=24)
            if s is not None:
                out.append(s)
        return out

    def _momentum(self, x: Bars) -> list[Setup]:
        out = []
        pb = self.pb
        for i in range(100, x.n):
            d = 1 if x.c[i] > x.dc_hi[i] else -1 if x.c[i] < x.dc_lo[i] else 0
            if not d or (x.c[i] - x.o[i]) * d < pb.mom_body_atr * x.a[i]:
                continue
            if x.atr_fast[i] < pb.mom_expansion * x.atr_slow[i] or x.vol[i] < pb.mom_volume or x.adx[i] < pb.mom_adx:
                continue
            entry = float(x.c[i])
            sl = entry - d * pb.mom_stop_atr * x.a[i]
            tp = entry + d * pb.target_rr * pb.mom_stop_atr * x.a[i]
            s = self._emit(x, "momentum", i, d, entry, sl, tp, "4-hour range",
                           [("Breakout", "Closed beyond the last 4 hours' range"),
                            ("Filters", f"Volatility expansion, volume x{x.vol[i]:.1f}, ADX {x.adx[i]:.0f}")],
                           bias=False, cooldown=24)
            if s is not None:
                out.append(s)
        return out

    def _mean_reversion(self, x: Bars) -> list[Setup]:
        out = []
        pb = self.pb
        for i in range(100, x.n):
            if x.adx[i] >= pb.mr_adx or x.atr_fast[i] > pb.mr_max_vol * x.atr_slow[i]:
                continue
            if x.c[i - 1] < x.bb_lo[i - 1] and x.c[i] > x.bb_lo[i] and x.rsi[i - 1] <= pb.mr_rsi:
                d = 1
            elif x.c[i - 1] > x.bb_hi[i - 1] and x.c[i] < x.bb_hi[i] and x.rsi[i - 1] >= 100 - pb.mr_rsi:
                d = -1
            else:
                continue
            far = min(x.l[i - 1], x.l[i]) if d > 0 else max(x.h[i - 1], x.h[i])
            entry = float(x.c[i])
            sl = far - d * pb.mr_stop_atr * x.a[i]
            s = self._emit(x, "mean_reversion", i, d, entry, sl, float(x.bb_mid[i]), "Bollinger band",
                           [("Range", f"ADX {x.adx[i]:.0f}, low volatility"),
                            ("Snap-back", f"Closed back inside the band, RSI {x.rsi[i - 1]:.0f}")],
                           partial_r=0.0, bias=False)
            if s is not None:
                out.append(s)
        return out
