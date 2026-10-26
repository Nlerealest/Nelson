"""How Nelson "learns": walk-forward optimisation.

Fitting settings to all of history makes any strategy look amazing and then
fail live (overfitting). Instead Nelson:

1. splits history into consecutive windows,
2. picks the best settings on a training window,
3. trades them on the *next*, unseen window,
4. repeats, rolling forward.

Only the unseen (out-of-sample) results are reported - that is the honest
estimate of how the strategy might do live. The settings chosen on the most
recent training window are saved to learned_params.json and used by the bot.
"""
from __future__ import annotations

import copy
import itertools
import json
import logging

import numpy as np
import pandas as pd

from .backtest import BacktestResult, simulate
from .config import Config
from .strategy import NelsonStrategy, prepare

log = logging.getLogger("nelson.optimizer")

DEFAULT_GRID = {
    "displacement_atr": [0.8, 1.0, 1.3],
    "rr_target": [1.5, 2.0, 2.5, 3.0],
    "sweep_max_age_bars": [6, 12],
    "require_volume_spike": [True, False],
    "use_premium_discount": [True, False],
}


def score(res: BacktestResult, min_trades: int) -> float:
    """Reward steady profit, punish drawdown and tiny samples. Win rate alone is not the goal."""
    s = res.stats()
    if s["trades"] < min_trades:
        return -1e9
    return s["expectancy_R"] * np.sqrt(s["trades"]) - 0.05 * s["max_drawdown_pct"]


def _with(cfg: Config, params: dict) -> Config:
    c = copy.deepcopy(cfg)
    for k, v in params.items():
        setattr(c.strategy, k, v)
    return c


def _run(f: pd.DataFrame, cfg: Config, news) -> BacktestResult:
    """`f` is prepared data. The grid only holds settings that do not change the prepared features."""
    return simulate(f, NelsonStrategy(cfg.strategy, news).scan(f), cfg)


def _best(f: pd.DataFrame, cfg: Config, news, combos: list[dict], min_trades: int) -> tuple[dict, float]:
    best, best_score = combos[0], -np.inf
    for p in combos:
        sc = score(_run(f, _with(cfg, p), news), min_trades)
        if sc > best_score:
            best, best_score = p, sc
    return best, best_score


def walk_forward(df: pd.DataFrame, cfg: Config, news=None, train_months: int = 6, test_months: int = 2,
                 grid: dict | None = None, min_trades: int = 15) -> dict:
    grid = grid or DEFAULT_GRID
    keys = list(grid)
    combos = [dict(zip(keys, vals)) for vals in itertools.product(*grid.values())]
    start, end = df["time"].iloc[0], df["time"].iloc[-1]
    folds, oos_trades = [], []
    cursor = start
    while True:
        train_end = cursor + pd.DateOffset(months=train_months)
        test_end = train_end + pd.DateOffset(months=test_months)
        if train_end >= end:
            break
        train = df[(df["time"] >= cursor) & (df["time"] < train_end)]
        # test data includes a warm-up tail of the training window so indicators are ready
        test = df[(df["time"] >= train_end - pd.Timedelta(days=5)) & (df["time"] < test_end)]
        best, best_score = _best(prepare(train, cfg.strategy), cfg, news, combos, min_trades)
        res = _run(prepare(test, cfg.strategy), _with(cfg, best), news)
        res.trades = [t for t in res.trades if t.setup.time >= train_end]
        st = res.stats()
        folds.append({"train": f"{cursor:%Y-%m-%d}..{train_end:%Y-%m-%d}", "test": f"{train_end:%Y-%m-%d}..{min(test_end, end):%Y-%m-%d}",
                      "params": best, "train_score": round(best_score, 2), "oos": st})
        log.info("fold %s -> OOS %s", folds[-1]["test"], st)
        oos_trades += res.trades
        cursor = cursor + pd.DateOffset(months=test_months)

    # Final settings: fit on the most recent training window
    recent = df[df["time"] >= end - pd.DateOffset(months=train_months)]
    final, final_score = _best(prepare(recent, cfg.strategy), cfg, news, combos, min_trades)

    r = np.array([t.r_multiple for t in oos_trades])
    pnl = np.array([t.pnl for t in oos_trades])
    summary = {
        "out_of_sample_trades": int(len(r)),
        "out_of_sample_win_rate_pct": round(float((pnl > 0).mean() * 100), 1) if len(r) else 0.0,
        "out_of_sample_expectancy_R": round(float(r.mean()), 3) if len(r) else 0.0,
        "out_of_sample_total_R": round(float(r.sum()), 1) if len(r) else 0.0,
        "profitable_folds": f"{sum(f['oos']['net_profit'] > 0 for f in folds)}/{len(folds)}",
    }
    return {"summary": summary, "folds": folds, "final_params": final, "final_train_score": final_score}


def save_learned(result: dict, path: str) -> None:
    payload = {"strategy": result["final_params"], "walk_forward": result["summary"]}
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(payload, fh, indent=2, default=str)
