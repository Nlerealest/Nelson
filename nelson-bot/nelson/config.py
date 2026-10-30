"""Nelson's settings.

Every setting has a safe default here. Override any of them in config.yaml
(copy config.example.yaml). Secrets (MT5 password) can come from environment
variables instead of the file: NELSON_MT5_LOGIN, NELSON_MT5_PASSWORD,
NELSON_MT5_SERVER, NELSON_MT5_PATH.
"""
from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field, fields, is_dataclass
from pathlib import Path
from typing import Any

import yaml


@dataclass
class StrategyConfig:
    pip_size: float = 0.10           # gold: 1 pip = a $0.10 move (stops, targets and results in pips)
    # Market structure
    swing_length: int = 3            # bars each side that make a swing high/low on the entry timeframe
    htf_minutes: int = 60            # higher timeframe used for bias (60 = H1)
    htf_swing_length: int = 3
    atr_period: int = 14

    # Liquidity
    use_prev_day_levels: bool = True     # previous day high / low
    use_asia_levels: bool = True         # Asian session high / low
    use_london_levels: bool = True       # London session high / low (liquidity for New York)
    london_session_utc: tuple[str, str] = ("07:00", "12:00")
    use_swing_levels: bool = True        # recent swing highs / lows (resting stops)
    asia_session_utc: tuple[str, str] = ("00:00", "06:00")
    equal_level_tolerance_atr: float = 0.10   # two swings this close count as equal highs/lows
    max_level_age_hours: float = 48.0

    # Sweep -> displacement -> fair value gap
    sweep_max_age_bars: int = 24     # the break of structure must happen within this many bars of the sweep
    choch_lookback_bars: int = 10    # bars before the sweep that define the internal swing to break
    displacement_atr: float = 0.0    # body of the breaking candle >= this x ATR (TJR: any body close counts)
    min_fvg_atr: float = 0.10        # minimum fair value gap size (x ATR)
    entry_mode: str = "fvg_mid"      # "fvg_mid" (50% of gap), "fvg_edge" (first touch of gap),
                                     # "ob" (order block: body edge of the sweep candle) or
                                     # "bos_close" (market order on the candle that breaks structure)
    require_fvg: bool = True         # the shift must leave a fair value gap (TJR: not needed for OB entries)
    order_expiry_bars: int = 12      # cancel the limit order if not filled in time

    # Stops and targets
    sl_buffer_atr: float = 0.20      # stop goes beyond the sweep wick plus this buffer
    min_sl_atr: float = 0.5
    max_sl_atr: float = 4.0
    rr_target: float = 2.5           # take profit at this many R
    target_mode: str = "liquidity"   # "rr" (fixed R) or "liquidity" (TJR: the next liquidity levels)
    tp1_min_rr: float = 1.0          # liquidity mode: first target (partial + break-even) at least this far
    final_min_rr: float = 2.0        # liquidity mode: final target at least this far...
    final_max_rr: float = 3.0        # ...and at most this far (capped)
    partial_at_r: float = 1.0        # take partial profit at this R (0 = off)
    partial_fraction: float = 0.5
    breakeven_at_r: float = 1.0      # move stop to entry at this R (0 = off)

    # Filters
    use_htf_bias: bool = False           # trade only with the H1 market structure
    use_daily_bias: bool = True          # TJR: trade only with the daily market structure
    use_h4_bias: bool = False            # TJR: ...and with the 4-hour structure
    bias_swing_length: int = 1           # candles each side for daily / 4h swings (TJR: a 2-candle turn)
    day_start_utc: float = 22.0          # daily candles start at the New York close (22:00 UTC)
    premium_discount_mode: str = "leg"   # "leg" (TJR: the sweep-to-break leg) or "htf_range" (H1 range)
    use_premium_discount: bool = True    # buy in discount, sell in premium of the H1 dealing range
    require_volume_spike: bool = False   # sweep candle must carry above-normal volume (stop run)
    sweep_volume_mult: float = 1.2
    require_delta_confirmation: bool = False  # order-flow delta must agree with the displacement
    killzones_utc: list[tuple[str, str]] = field(
        default_factory=lambda: [("00:00", "24:00")]  # every session: any confirmed setup is traded
    )
    avoid_friday_after_utc: str = "18:00"


@dataclass
class RiskConfig:
    risk_per_trade_pct: float = 0.5      # % of balance lost if the stop is hit
    max_daily_loss_pct: float = 2.0      # stop trading for the day after this loss
    max_total_drawdown_pct: float = 10.0  # stop trading completely (needs a human) after this drawdown
    max_trades_per_day: int = 3
    max_consecutive_losses: int = 3      # stop for the day after this many losses in a row
    max_open_positions: int = 1
    max_spread_usd: float = 0.50         # skip if spread is wider than this (gold, in dollars)
    max_lot: float = 5.0                 # hard cap whatever the maths says
    close_friday_utc: str = "20:30"      # flatten before the weekend gap ("" = off)
    flatten_minutes_before_tier1: int = 10


@dataclass
class NewsConfig:
    enabled: bool = True
    calendar_url: str = "https://nfs.faireconomy.media/ff_calendar_thisweek.json"
    currencies: list[str] = field(default_factory=lambda: ["USD"])
    impacts: list[str] = field(default_factory=lambda: ["High"])
    minutes_before: int = 30
    minutes_after: int = 30
    # Tier-1 events move gold the most; wider window and optionally flatten before them
    tier1_keywords: list[str] = field(default_factory=lambda: [
        "Non-Farm", "CPI", "PPI", "FOMC", "Federal Funds Rate", "Fed Chair", "Powell", "PCE", "GDP",
    ])
    # TJR: no trading at all on CPI, PPI, FOMC and NFP days (the whole UTC day)
    skip_day_keywords: list[str] = field(default_factory=lambda: [
        "CPI", "PPI", "FOMC", "Federal Funds Rate", "Non-Farm",
    ])
    news_day_risk_factor: float = 0.5    # TJR: half size on days with other high-impact USD news
    tier1_minutes_before: int = 60
    tier1_minutes_after: int = 60
    flatten_before_tier1: bool = True
    block_if_unavailable: bool = True    # if the calendar cannot be loaded, do not trade
    cache_minutes: int = 60
    history_csv: str = ""                # past events for backtests (date,currency,impact,title)


@dataclass
class BacktestConfig:
    initial_balance: float = 10_000.0
    contract_size: float = 100.0         # 1 lot XAUUSD = 100 oz on most brokers
    spread_usd: float = 0.25
    slippage_usd: float = 0.05
    commission_per_lot: float = 7.0      # round turn
    volume_step: float = 0.01
    min_lot: float = 0.01


@dataclass
class MT5Config:
    login: int = 0
    password: str = ""
    server: str = ""
    path: str = ""                       # path to terminal64.exe (optional)
    server_utc_offset_hours: Any = "auto"  # broker clock offset from UTC, or "auto"
    deviation_points: int = 30
    bars_to_load: int = 3000
    history_bars: int = 30000            # longer M5 history for the daily / 4-hour structure (refreshed hourly)
    history_bars: int = 30000            # longer M5 history for the daily / 4-hour structure (refreshed hourly)


@dataclass
class TelegramConfig:
    enabled: bool = False
    token: str = ""                      # from @BotFather; better via env NELSON_TELEGRAM_TOKEN
    chat_ids: list[int] = field(default_factory=list)   # only these chats may see or control Nelson
    daily_summary_utc: str = "21:05"     # end-of-day report ("" = off)
    max_risk_pct: float = 1.0            # /risk cannot go above this from the phone


@dataclass
class NotifyConfig:
    """Phone notifications through the free ntfy app (set up by app-setup)."""
    enabled: bool = False
    server: str = "https://ntfy.sh"
    topic: str = ""                      # private random channel name; anyone who knows it can read the alerts
    signals: bool = True                 # alert on every new signal (with entry, stop and target)


@dataclass
class LearningConfig:
    """Learning from real-market results while Nelson runs (see nelson/learning.py)."""
    enabled: bool = True
    track_missed: bool = True            # when Nelson starts, check the candles it missed while it was off
    first_run_lookback_hours: float = 24.0   # with no record of the last run, look this far back
    min_offline_bars: int = 3            # shorter gaps are not reported as "Nelson was off"
    apply_lessons: bool = True           # skip kinds of setup that keep losing (needs min_samples results)
    min_samples: int = 8
    avoid_below_r: float = -0.3          # ...and an average result at or below this many R
    window: int = 40                     # judge each kind of setup on its latest N results
    review_bars: int = 24                # bars after a stop-out to check where price went next


@dataclass
class AppConfig:
    """The private API the Nelson phone app connects to."""
    enabled: bool = False
    host: str = "127.0.0.1"              # keep 127.0.0.1 and publish it with Tailscale (see README)
    port: int = 8765
    api_key: str = ""                    # long random secret; better via env NELSON_APP_KEY


@dataclass
class Config:
    symbol: str = "XAUUSD"               # some brokers use XAUUSDm, XAUUSD.r, GOLD ...
    timeframe: str = "M5"
    mode: str = "paper"                  # paper = analyse and log only, demo, live
    allow_real_money: bool = False       # must be true AND mode=live to trade a real account
    magic: int = 777001
    log_dir: str = "logs"
    learned_params_file: str = "learned_params.json"
    strategy: StrategyConfig = field(default_factory=StrategyConfig)
    risk: RiskConfig = field(default_factory=RiskConfig)
    news: NewsConfig = field(default_factory=NewsConfig)
    backtest: BacktestConfig = field(default_factory=BacktestConfig)
    mt5: MT5Config = field(default_factory=MT5Config)
    telegram: TelegramConfig = field(default_factory=TelegramConfig)
    app: AppConfig = field(default_factory=AppConfig)
    notify: NotifyConfig = field(default_factory=NotifyConfig)
    learning: LearningConfig = field(default_factory=LearningConfig)

    def to_dict(self) -> dict:
        return asdict(self)


def _merge(obj: Any, values: dict) -> None:
    known = {f.name: f for f in fields(obj)}
    for key, value in (values or {}).items():
        if key not in known:
            raise ValueError(f"Unknown setting '{key}' in {type(obj).__name__}")
        current = getattr(obj, key)
        if is_dataclass(current):
            _merge(current, value)
        elif isinstance(current, tuple) and isinstance(value, list):
            setattr(obj, key, tuple(value))
        else:
            setattr(obj, key, value)


def load_config(path: str | os.PathLike | None = "config.yaml", use_learned: bool = True) -> Config:
    cfg = Config()
    if path and Path(path).exists():
        with open(path, encoding="utf-8") as fh:
            _merge(cfg, yaml.safe_load(fh) or {})

    # Parameters chosen by the walk-forward optimiser ("what Nelson learned")
    learned = Path(cfg.learned_params_file)
    if use_learned and learned.exists():
        data = json.loads(learned.read_text(encoding="utf-8"))
        _merge(cfg.strategy, data.get("strategy", {}))

    env = os.environ
    if env.get("NELSON_MT5_LOGIN"):
        cfg.mt5.login = int(env["NELSON_MT5_LOGIN"])
    cfg.mt5.password = env.get("NELSON_MT5_PASSWORD", cfg.mt5.password)
    cfg.mt5.server = env.get("NELSON_MT5_SERVER", cfg.mt5.server)
    cfg.mt5.path = env.get("NELSON_MT5_PATH", cfg.mt5.path)

    cfg.telegram.token = env.get("NELSON_TELEGRAM_TOKEN", cfg.telegram.token)
    if env.get("NELSON_TELEGRAM_CHAT_ID"):
        cfg.telegram.chat_ids = [int(x) for x in env["NELSON_TELEGRAM_CHAT_ID"].split(",") if x.strip()]
    if env.get("NELSON_TELEGRAM_TOKEN") and cfg.telegram.chat_ids:
        cfg.telegram.enabled = True

    cfg.app.api_key = env.get("NELSON_APP_KEY", cfg.app.api_key)

    if cfg.mode not in ("paper", "demo", "live"):
        raise ValueError("mode must be paper, demo or live")
    return cfg
