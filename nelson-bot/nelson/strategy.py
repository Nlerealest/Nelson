"""Nelson's trading model for XAUUSD.

The setup, in plain words:

1. Bias - read the H1 market structure. Only buy when H1 is bullish, only sell
   when it is bearish. Buy in discount (below the middle of the H1 range), sell
   in premium (above it).
2. Liquidity - mark where stops rest: previous day high/low, Asian session
   high/low, equal highs/lows and recent swing points.
3. Sweep - during London or New York, price wicks through one of those levels
   and closes back inside: the stops were taken and the move was rejected.
   The sweep candle must show above-normal volume (a real stop run).
4. Shift - within a few bars, a strong displacement candle closes beyond the
   internal swing that led into the sweep (change of character), leaving a
   fair value gap (an imbalance price tends to come back to).
5. Order flow - delta during the displacement must agree with the direction.
6. Entry - a limit order inside the fair value gap. Stop beyond the sweep
   wick. Target a fixed reward:risk, with partial profit and break-even.
7. News - no new trades around high-impact USD news.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd

from .config import StrategyConfig
from .indicators import atr as atr_fn
from .indicators import confirmed_pivots
from .liquidity import LiquidityBook, asia_levels, daily_levels, session_levels
from .orderflow import bar_delta_proxy, relative_volume
from .sessions import friday_cutoff, in_windows, session_name
from .structure import htf_context, htf_trend


@dataclass
class Setup:
    index: int                 # bar on whose close the setup was confirmed
    time: pd.Timestamp         # open time of that bar (UTC)
    direction: int             # +1 buy, -1 sell
    entry: float
    sl: float
    tp: float
    expiry_index: int
    atr: float
    level_name: str
    level_price: float
    sweep_extreme: float
    fvg_low: float
    fvg_high: float
    reasons: list[str] = field(default_factory=list)
    steps: list[dict] = field(default_factory=list)   # how the setup was found, for the app
    features: dict = field(default_factory=dict)      # what the setup looked like, for learning
    market: bool = False                              # enter at market now (True) or with a limit order
    partial_r: float | None = None                    # where to take the partial (R); None = config value
    strategy: str = "tjr_bootcamp"                    # which strategy in the playbook found it
    watch_only: bool = False                          # followed on price to learn from, never traded

    @property
    def side(self) -> str:
        return "BUY" if self.direction > 0 else "SELL"

    @property
    def risk(self) -> float:
        return abs(self.entry - self.sl)

    @property
    def rr(self) -> float:
        return round(abs(self.tp - self.entry) / self.risk, 2) if self.risk else 0.0

    def describe(self) -> str:
        kind = "market" if self.market else "limit"
        return (f"{self.side} XAUUSD {kind} {self.entry:.2f} | SL {self.sl:.2f} | TP {self.tp:.2f} "
                f"({self.risk:.2f} risk) - " + "; ".join(self.reasons))


@dataclass
class _Sweep:
    index: int
    level_name: str
    level_price: float
    extreme: float
    internal: float     # internal swing that must break for a change of character
    volume_ok: bool
    rel_volume: float


def infer_minutes(df: pd.DataFrame) -> int:
    return int(round(df["time"].diff().dropna().dt.total_seconds().median() / 60))


def prepare(df: pd.DataFrame, cfg: StrategyConfig, bar_minutes: int | None = None,
            history: pd.DataFrame | None = None) -> pd.DataFrame:
    """Adds every feature the strategy needs. Each value uses only data known at that bar's close.

    `history`: a longer run of the same bars, used only for the daily and 4-hour structure (live)."""
    df = df.reset_index(drop=True).copy()
    m = bar_minutes or infer_minutes(df)
    df.attrs["bar_minutes"] = m
    df["atr"] = atr_fn(df, cfg.atr_period)
    hc, hp, lc, lp = confirmed_pivots(df["high"].to_numpy(), df["low"].to_numpy(), cfg.swing_length)
    df["sh_confirmed"], df["sh_price"], df["sl_confirmed"], df["sl_price"] = hc, hp, lc, lp
    k = cfg.bias_swing_length
    daily = htf_trend(df, m, 1440, k, history, cfg.day_start_utc - 24)
    h4 = htf_trend(df, m, 240, k, history, cfg.day_start_utc - 24)
    df = pd.concat([df, htf_context(df, m, cfg.htf_minutes, cfg.htf_swing_length),
                    daily_levels(df), asia_levels(df, cfg.asia_session_utc, m),
                    session_levels(df, cfg.london_session_utc, m, "london")], axis=1)
    df["daily_trend"], df["h4_trend"] = daily["trend"].to_numpy(), h4["trend"].to_numpy()
    if "delta" not in df:
        df["delta"] = bar_delta_proxy(df)
    df["rel_volume"] = relative_volume(df["tick_volume"])
    df["in_killzone"] = in_windows(df["time"], cfg.killzones_utc)
    df["friday_late"] = friday_cutoff(df["time"], cfg.avoid_friday_after_utc)
    return df


class NelsonStrategy:
    def __init__(self, cfg: StrategyConfig, news_filter=None):
        self.cfg = cfg
        self.news = news_filter
        self.book: LiquidityBook | None = None
        self.rejected: list[tuple[int, str, str]] = []   # (bar, side, reason) for the journal
        self.skipped: list[dict] = []                     # the same, with levels and steps, for the app

    def scan(self, f: pd.DataFrame) -> list[Setup]:
        """Walks bar by bar through prepared data and returns every confirmed setup."""
        c = self.cfg
        m = f.attrs.get("bar_minutes", 5)
        t = f["time"]
        o, h, l, cl = (f[k].to_numpy() for k in ("open", "high", "low", "close"))
        a = f["atr"].to_numpy()
        tn = t.to_numpy().astype("datetime64[s]").astype(np.int64)   # epoch seconds: fast comparisons
        days = t.dt.normalize().to_numpy()
        pdh, pdl, asia_h, asia_l, rel_vol, sh_c, sh_p, sl_c, sl_p = (f[k].to_numpy() for k in (
            "pdh", "pdl", "asia_high", "asia_low", "rel_volume", "sh_confirmed", "sh_price", "sl_confirmed", "sl_price"))
        lon_h = f["london_high"].to_numpy() if "london_high" in f else np.full(len(f), np.nan)
        lon_l = f["london_low"].to_numpy() if "london_low" in f else np.full(len(f), np.nan)
        london_added = None
        self.book = book = LiquidityBook(c.equal_level_tolerance_atr, c.max_level_age_hours)
        self.rejected = []
        self.skipped = []
        pending: dict[int, _Sweep | None] = {1: None, -1: None}
        asia_added = None
        setups: list[Setup] = []
        warmup = max(c.atr_period * 2, c.swing_length * 2 + 2, c.choch_lookback_bars + 2)

        for i in range(len(f)):
            ti = tn[i]
            ai = a[i]
            # --- 1. update the liquidity map
            if c.use_prev_day_levels and (i == 0 or days[i] != days[i - 1]):
                book.add(pdh[i], "BSL", "PDH", ti, ai)
                book.add(pdl[i], "SSL", "PDL", ti, ai)
            if c.use_asia_levels and asia_added != days[i] and not np.isnan(asia_h[i]):
                asia_added = days[i]
                book.add(asia_h[i], "BSL", "Asia high", ti, ai)
                book.add(asia_l[i], "SSL", "Asia low", ti, ai)
            if c.use_london_levels and london_added != days[i] and not np.isnan(lon_h[i]):
                london_added = days[i]
                book.add(lon_h[i], "BSL", "London high", ti, ai)
                book.add(lon_l[i], "SSL", "London low", ti, ai)
            if c.use_swing_levels:
                if sh_c[i]:
                    book.add(sh_p[i], "BSL", "Swing high", ti, ai)
                if sl_c[i]:
                    book.add(sl_p[i], "SSL", "Swing low", ti, ai)
            book.expire(ti)

            if i < warmup or np.isnan(ai) or ai <= 0:
                book.check(h[i], l[i], cl[i])
                continue

            # --- 2. keep existing sweeps up to date (deeper wick, or acceptance beyond = cancel)
            for d in (1, -1):
                p = pending[d]
                if p is None:
                    continue
                if i - p.index > c.sweep_max_age_bars:
                    pending[d] = None
                elif d == -1 and h[i] > p.extreme:
                    pending[d] = None if cl[i] > p.level_price else _replace(p, extreme=h[i])
                elif d == 1 and l[i] < p.extreme:
                    pending[d] = None if cl[i] < p.level_price else _replace(p, extreme=l[i])

            # --- 3. new sweeps on this bar
            bsl, ssl = book.check(h[i], l[i], cl[i])
            lb = slice(max(0, i - c.choch_lookback_bars), i)
            rv = float(rel_vol[i])
            if bsl:   # buy stops above highs taken -> look to SELL
                lv = max(bsl, key=lambda x: (x.priority, x.price))
                pending[-1] = _Sweep(i, lv.name, lv.price, h[i], float(l[lb].min()), rv >= c.sweep_volume_mult, rv)
            if ssl:   # sell stops below lows taken -> look to BUY
                lv = max(ssl, key=lambda x: (x.priority, -x.price))
                pending[1] = _Sweep(i, lv.name, lv.price, l[i], float(h[lb].max()), rv >= c.sweep_volume_mult, rv)

            # --- 4. displacement + change of character + fair value gap
            for d in (1, -1):
                p = pending[d]
                if p is None or i <= p.index:
                    continue
                body = (cl[i] - o[i]) * d
                broke = cl[i] > p.internal if d == 1 else cl[i] < p.internal
                if body < c.displacement_atr * ai or not broke:
                    continue
                fvg = _find_fvg(h, l, i, d, p.index, c.min_fvg_atr * ai)
                if fvg is None:
                    if c.require_fvg:
                        continue
                    fvg = (float("nan"), float("nan"))
                pending[d] = None
                setup = self._build(f, i, d, p, fvg, ai, m)
                if setup is not None:
                    setups.append(setup)
        return setups

    def _build(self, f, i, d, p: _Sweep, fvg, ai, bar_minutes) -> Setup | None:
        c = self.cfg
        side = "BUY" if d > 0 else "SELL"
        gap_lo, gap_hi = fvg
        has_gap = not np.isnan(gap_lo)
        o_arr, cl_arr = f["open"].to_numpy(), f["close"].to_numpy()
        market = False
        mode = c.entry_mode if (has_gap or c.entry_mode in ("ob", "bos_close")) else "bos_close"
        if mode == "ob":
            # order block: the candle that made the sweep; price tends to react at the start of its body
            j = p.index
            entry = min(o_arr[j], cl_arr[j]) if d > 0 else max(o_arr[j], cl_arr[j])
        elif mode == "bos_close":
            entry, market = float(cl_arr[i]), True
        elif mode == "fvg_edge":
            entry = gap_hi if d > 0 else gap_lo
        else:
            entry = (gap_lo + gap_hi) / 2
        sl = p.extreme - c.sl_buffer_atr * ai if d > 0 else p.extreme + c.sl_buffer_atr * ai
        risk = (entry - sl) * d
        tp = entry + d * c.rr_target * risk
        partial_r = None
        if c.target_mode == "liquidity" and risk > 0:
            tp, partial_r = self._liquidity_targets(entry, risk, d, ai, tp)

        trend = int(f["htf_trend"].iat[i])
        eq = f["htf_equilibrium"].iat[i]
        delta = float(f["delta"].iloc[p.index + 1:i + 1].sum())
        body_atr = abs(float(f["close"].iat[i]) - float(f["open"].iat[i])) / ai
        close_time = f["time"].iat[i] + pd.Timedelta(minutes=bar_minutes)
        trend_word = "bullish" if trend > 0 else "bearish" if trend < 0 else "unclear"
        reasons = [
            f"swept {p.level_name} {p.level_price:.2f} (wick to {p.extreme:.2f}, volume x{p.rel_volume:.1f})",
            f"displacement closed through internal swing {p.internal:.2f}",
            f"fair value gap {gap_lo:.2f}-{gap_hi:.2f}",
            f"H1 trend {trend_word}",
            f"delta {delta:+.0f}",
        ]

        blocked, event = (False, None)
        if self.news is not None:
            blocked, event = self.news.blocked(close_time)
        in_zone = bool(f["in_killzone"].iat[i])
        friday = bool(f["friday_late"].iat[i])
        sl_ok = c.min_sl_atr * ai <= risk <= c.max_sl_atr * ai
        trend_ok = not c.use_htf_bias or trend == d
        daily_t, h4_t = int(f["daily_trend"].iat[i]), int(f["h4_trend"].iat[i])
        daily_ok = not c.use_daily_bias or daily_t == d
        h4_ok = not c.use_h4_bias or h4_t == d
        if c.premium_discount_mode == "leg":   # TJR: measure the leg from the sweep to the break
            eq = (p.extreme + (float(f["high"].iloc[p.index:i + 1].max()) if d > 0
                               else float(f["low"].iloc[p.index:i + 1].min()))) / 2
        pd_ok = not c.use_premium_discount or np.isnan(eq) or (entry < eq if d > 0 else entry > eq)
        vol_ok = not c.require_volume_spike or p.volume_ok
        delta_ok = not c.require_delta_confirmation or delta * d > 0
        stops = "sell stops below" if d > 0 else "buy stops above"
        zone = "" if np.isnan(eq) else ("discount" if entry < eq else "premium")
        off = " (filter switched off)"
        good_zone = "discount" if d > 0 else "premium"

        # How Nelson found it, step by step, in the order a trader reads the chart
        word = {1: "bullish", -1: "bearish", 0: "unclear"}
        steps = [
            {"title": "Daily bias", "ok": daily_ok, "off": not c.use_daily_bias,
             "detail": f"Daily structure is {word[daily_t]}, 4-hour is {word[h4_t]}; this is a {side}"
                       + ("" if c.use_daily_bias else off)},
            {"title": "H1 market structure", "ok": trend_ok, "off": not c.use_htf_bias,
             "detail": f"H1 is {trend_word}; this is a {side}" + ("" if c.use_htf_bias else off)},
            {"title": "Premium / discount", "ok": pd_ok, "off": not c.use_premium_discount,
             "detail": (f"Entry {entry:.2f} is in {zone} (H1 midpoint {eq:.2f}): "
                        + ("the right side for a " + side if zone == good_zone else f"{side}s belong in {good_zone}")
                        if zone else "H1 range not known yet") + ("" if c.use_premium_discount else off)},
            {"title": "Liquidity sweep", "ok": True,
             "detail": f"Price ran the {p.level_name} {p.level_price:.2f} (wick to {p.extreme:.2f}) and closed back "
                       f"inside: the {stops} were taken"},
            {"title": "Stop-run volume", "ok": vol_ok, "off": not c.require_volume_spike,
             "detail": f"Sweep candle volume x{p.rel_volume:.1f} normal" + ("" if c.require_volume_spike else off)},
            {"title": "Change of character", "ok": True,
             "detail": f"A strong candle (body {body_atr:.1f}x ATR) closed {'above' if d > 0 else 'below'} the "
                       f"internal swing {p.internal:.2f}"},
            {"title": "Entry", "ok": True,
             "detail": {"ob": f"Order block: limit at {entry:.2f}, where the sweep candle's body starts",
                        "bos_close": f"Market entry at {entry:.2f}, on the candle that broke structure"}.get(
                 mode, f"Gap {gap_lo:.2f}-{gap_hi:.2f} left behind; limit entry at {entry:.2f}")},
            {"title": "Order flow", "ok": delta_ok, "off": not c.require_delta_confirmation,
             "detail": f"Delta {delta:+.0f}: {'buyers' if delta > 0 else 'sellers'} more aggressive"
                       + ("" if c.require_delta_confirmation else off)},
            {"title": "Session", "ok": in_zone and not friday,
             "detail": session_name(close_time) + (" (trading hours)" if in_zone else " (outside the trading-hours killzones)")
                       + (", late Friday" if friday else "")},
            {"title": "News", "ok": not blocked,
             "detail": f"High-impact news: {event}" if blocked else "No high-impact USD news nearby"},
            {"title": "Risk", "ok": risk > 0 and sl_ok,
             "detail": f"Stop {abs(risk):.2f} away ({abs(risk) / c.pip_size:.0f} pips, {abs(risk) / ai:.1f} ATR), "
                       f"target {abs(tp - entry) / c.pip_size:.0f} pips ({abs(tp - entry) / risk if risk else 0:.1f}R)"
                       + (f", first partial at {partial_r:.1f}R" if partial_r else "")},
        ]

        checks = [
            (risk > 0, "stop on wrong side of entry"),
            (daily_ok, "against the daily bias"),
            (h4_ok, "against the 4-hour structure"),
            (in_zone, "outside the trading-hours killzones"),
            (not friday, "late Friday"),
            (sl_ok, f"stop {risk:.2f} outside {c.min_sl_atr}-{c.max_sl_atr} ATR"),
            (trend_ok, "against H1 structure"),
            (pd_ok, "buying in premium" if d > 0 else "selling in discount"),
            (vol_ok, f"sweep volume only x{p.rel_volume:.1f}"),
            (delta_ok, f"delta {delta:+.0f} disagrees"),
            (not blocked, f"news: {event}"),
        ]
        # The same facts as plain values, so Nelson can learn which kinds of setup work
        features = {
            "side": side, "level": p.level_name, "session": session_name(close_time), "hour": int(close_time.hour),
            "trend_aligned": trend == d, "zone_ok": None if not zone else zone == good_zone,
            "volume_spike": bool(p.volume_ok), "rel_volume": round(float(p.rel_volume), 2),
            "delta_agrees": delta * d > 0, "body_atr": round(body_atr, 2),
            "sl_atr": round(abs(risk) / ai, 2), "fvg_atr": round((gap_hi - gap_lo) / ai, 2) if has_gap else 0.0,
            "daily_aligned": daily_t == d, "h4_aligned": h4_t == d, "entry": mode,
        }

        why = next((w for ok, w in checks if not ok), None)
        if why is not None:
            self.rejected.append((i, side, why))
            self.skipped.append({"index": i, "time": f["time"].iat[i], "side": side, "entry": round(entry, 2),
                                 "sl": round(sl, 2), "tp": round(tp, 2), "reason": why, "steps": steps,
                                 "features": features})
            return None
        return Setup(
            index=i, time=f["time"].iat[i], direction=d, entry=round(entry, 2), sl=round(sl, 2), tp=round(tp, 2),
            expiry_index=i + c.order_expiry_bars, atr=float(ai), level_name=p.level_name,
            level_price=p.level_price, sweep_extreme=p.extreme, fvg_low=gap_lo, fvg_high=gap_hi, reasons=reasons,
            steps=steps, features=features, market=market,
            partial_r=None if partial_r is None else round(partial_r, 2),
        )

    def _liquidity_targets(self, entry: float, risk: float, d: int, ai: float, fallback: float):
        """TJR: take profit at the next liquidity levels. First target (partial + break-even) at least
        tp1_min_rr away, final target the next one at least final_min_rr away, capped at final_max_rr."""
        c = self.cfg
        side = "BSL" if d > 0 else "SSL"
        pad = 0.1 * ai                               # just before the level, where price may turn
        dists = sorted((lv.price - entry) * d - pad for lv in (self.book.levels if self.book else [])
                       if lv.alive and lv.side == side and (lv.price - entry) * d > pad)
        rs = [x / risk for x in dists]
        tp1 = next((r for r in rs if r >= c.tp1_min_rr), None)
        final = next((r for r in rs if r >= c.final_min_rr and (tp1 is None or r > tp1)), None)
        if final is None:
            final = c.final_max_rr if tp1 is not None and tp1 < c.final_max_rr else (fallback - entry) * d / risk
        final = min(final, c.final_max_rr)
        partial = tp1 if tp1 is not None and tp1 < final else None
        return entry + d * final * risk, partial


def _replace(p: _Sweep, **kw) -> _Sweep:
    return _Sweep(**{**p.__dict__, **kw})


def _find_fvg(h, l, i, d, sweep_index, min_size):
    """Most recent fair value gap in direction d formed after the sweep, ending at bar i or i-1.

    Bullish gap: low of bar k is above high of bar k-2. Bearish: high of k below low of k-2.
    """
    for k in (i, i - 1):
        if k - 2 < sweep_index:
            continue
        if d > 0 and l[k] - h[k - 2] >= min_size:
            return float(h[k - 2]), float(l[k])
        if d < 0 and l[k - 2] - h[k] >= min_size:
            return float(h[k]), float(l[k - 2])
    return None
