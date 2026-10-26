"""Nelson - XAUUSD trading bot for MetaTrader 5.

  python run_nelson.py backtest  --csv data/xauusd_m5.csv
  python run_nelson.py optimize  --csv data/xauusd_m5.csv     (walk-forward "learning")
  python run_nelson.py brief     [--csv data/xauusd_m5.csv]   (market analysis)
  python run_nelson.py download  --start 2023-01-01 --end 2025-12-31
  python run_nelson.py live                                   (runs on your MT5 terminal)
"""
from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import date
from pathlib import Path

from nelson.config import load_config


def _setup_logging(folder: str) -> None:
    Path(folder).mkdir(parents=True, exist_ok=True)
    logging.basicConfig(
        level=logging.INFO, format="%(asctime)s %(levelname)-7s %(message)s",
        handlers=[logging.StreamHandler(sys.stdout), logging.FileHandler(Path(folder) / "nelson.log", encoding="utf-8")],
    )


def _news_for_backtest(cfg):
    from nelson.news import NewsFilter
    if cfg.news.enabled and cfg.news.history_csv:
        return NewsFilter.from_csv(cfg.news, cfg.news.history_csv)
    logging.warning("No news history (news.history_csv) - backtest runs WITHOUT the news filter")
    return None


def cmd_backtest(cfg, args):
    from nelson.backtest import run_backtest
    from nelson.data import load_csv
    df = load_csv(args.csv, args.utc_offset)
    logging.info("Loaded %d bars %s -> %s", len(df), df["time"].iloc[0], df["time"].iloc[-1])
    res = run_backtest(df, cfg, _news_for_backtest(cfg))
    stats = res.stats()
    print("\n=== NELSON BACKTEST: XAUUSD ===")
    for k, v in stats.items():
        print(f"{k:>20}: {v}")
    if res.skipped:
        print("\nSetups not traded:", json.dumps(res.skipped, indent=1))
    out = Path(cfg.log_dir) / "backtest_trades.csv"
    tf = res.trades_frame()
    tf.to_csv(out, index=False)
    res.equity.to_csv(Path(cfg.log_dir) / "backtest_equity.csv", header=["balance"])
    if not tf.empty:
        print("\nBy session:\n", tf.groupby("session")["R"].agg(["count", "mean", "sum"]).round(2))
        print("\nBy liquidity swept:\n", tf.groupby("liquidity")["R"].agg(["count", "mean", "sum"]).round(2))
    print(f"\nTrades saved to {out}")


def cmd_optimize(cfg, args):
    from nelson.data import load_csv
    from nelson.optimizer import save_learned, walk_forward
    df = load_csv(args.csv, args.utc_offset)
    res = walk_forward(df, cfg, _news_for_backtest(cfg), args.train_months, args.test_months)
    print("\n=== WALK-FORWARD (unseen data only) ===")
    for f in res["folds"]:
        print(f"{f['test']}: {f['oos']['trades']} trades, win {f['oos']['win_rate_pct']}%, "
              f"exp {f['oos']['expectancy_R']}R, DD {f['oos']['max_drawdown_pct']}%  params={f['params']}")
    print("\nSummary:", json.dumps(res["summary"], indent=1))
    print("Settings learned from the most recent data:", res["final_params"])
    if res["summary"]["out_of_sample_expectancy_R"] <= 0:
        print("\n!! Out-of-sample expectancy is not positive. Do NOT trade this live. Not saving.")
        return
    save_learned(res, cfg.learned_params_file)
    print(f"Saved to {cfg.learned_params_file} - the bot will use these settings.")


def cmd_brief(cfg, args):
    from nelson.news import NewsFilter
    from nelson.report import market_brief
    from nelson.strategy import NelsonStrategy, prepare
    news = NewsFilter(cfg.news)
    news.refresh()
    if args.csv:
        from nelson.data import load_csv
        bars = load_csv(args.csv, args.utc_offset).tail(cfg.mt5.bars_to_load)
    else:
        from nelson.mt5_broker import MT5Broker
        b = MT5Broker(cfg)
        b.connect()
        bars = b.bars()
        b.shutdown()
    f = prepare(bars, cfg.strategy)
    strat = NelsonStrategy(cfg.strategy, news)
    setups = strat.scan(f)
    print(market_brief(f, strat.book, news, setups))


def cmd_download(cfg, args):
    from nelson.data import download_dukascopy
    df = download_dukascopy(date.fromisoformat(args.start), date.fromisoformat(args.end), args.out)
    print(f"Saved {len(df)} bars to {args.out}")


def cmd_live(cfg, args):
    from nelson.live import NelsonBot
    NelsonBot(cfg).run()


def main():
    p = argparse.ArgumentParser(description="Nelson - XAUUSD trading bot for MT5")
    p.add_argument("--config", default="config.yaml")
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("backtest", "optimize", "brief"):
        s = sub.add_parser(name)
        s.add_argument("--csv", required=name != "brief")
        s.add_argument("--utc-offset", type=float, default=0.0, help="broker clock offset of the CSV times (e.g. 2)")
        if name == "optimize":
            s.add_argument("--train-months", type=int, default=6)
            s.add_argument("--test-months", type=int, default=2)
    d = sub.add_parser("download")
    d.add_argument("--start", required=True)
    d.add_argument("--end", required=True)
    d.add_argument("--out", default="data/xauusd_m5.csv")
    sub.add_parser("live")
    args = p.parse_args()
    cfg = load_config(args.config, use_learned=args.cmd != "optimize")
    _setup_logging(cfg.log_dir)
    {"backtest": cmd_backtest, "optimize": cmd_optimize, "brief": cmd_brief,
     "download": cmd_download, "live": cmd_live}[args.cmd](cfg, args)


if __name__ == "__main__":
    main()
