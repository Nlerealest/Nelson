"""Nelson - XAUUSD trading bot for MetaTrader 5.

  python run_nelson.py backtest  --csv data/xauusd_m5.csv
  python run_nelson.py optimize  --csv data/xauusd_m5.csv     (walk-forward "learning")
  python run_nelson.py brief     [--csv data/xauusd_m5.csv]   (market analysis)
  python run_nelson.py download  --start 2023-01-01 --end 2025-12-31
  python run_nelson.py live                                   (runs on your MT5 terminal)
  python run_nelson.py telegram-setup --token <TOKEN>         (alerts + commands in Telegram)
  python run_nelson.py app-setup --url https://...            (connect the Nelson phone app)
  python run_nelson.py demo                                   (try the app on practice prices)
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


def cmd_telegram_setup(cfg, args):
    from nelson.telegram import TelegramLink, find_chat_ids
    token = args.token or cfg.telegram.token
    if not token:
        print("Create a bot: open Telegram, message @BotFather, send /newbot, copy the token, then run\n"
              "  python run_nelson.py telegram-setup --token <TOKEN>")
        return
    chats = find_chat_ids(token)
    if not chats:
        print("No messages yet. Open your new bot in Telegram, press START (or send 'hi'), then run this again.")
        return
    for cid, name in chats:
        print(f"Found chat {cid} ({name})")
    cid = chats[-1][0]
    TelegramLink(token, [cid]).send("Nelson is connected to this chat. You will get trade alerts here. Send /help after Nelson starts.")
    print(f"\nSent a test message. Now put this in config.yaml:\n\ntelegram:\n  enabled: true\n"
          f"  token: \"{token}\"\n  chat_ids: [{cid}]\n")


def _save_section(path: str, name: str, lines: list[str], comment: str = "") -> bool:
    """Writes a top-level section of config.yaml (replacing an existing one). False if there is no config."""
    import re
    cfg_file = Path(path)
    if not cfg_file.exists():
        return False
    head = f"{name}:" + (f"{' ' * max(1, 30 - len(name) - 1)}# {comment}" if comment else "")
    block = head + "\n" + "".join(f"  {ln}\n" for ln in lines)
    text = cfg_file.read_text(encoding="utf-8")
    pattern = re.compile(rf"^{name}:.*\n(?:[ \t]+.*\n?|[ \t]*\n)*", re.MULTILINE)
    if pattern.search(text):
        text = pattern.sub(lambda _m: block + "\n", text, count=1).rstrip("\n") + "\n"
    else:
        text = text.rstrip("\n") + "\n\n" + block
    cfg_file.write_text(text, encoding="utf-8")
    return True


def cmd_app_setup(cfg, args):
    import secrets
    key = cfg.app.api_key if len(cfg.app.api_key) >= 24 and not args.new_key else secrets.token_urlsafe(32)
    url = args.url.strip().rstrip("/")
    topic = cfg.notify.topic or f"nelson-{secrets.token_hex(8)}"
    saved = _save_section(args.config, "app", ["enabled: true", "host: 127.0.0.1", f"port: {cfg.app.port}",
                                               f'api_key: "{key}"'], "the Nelson phone app (written by app-setup)")
    if saved:
        _save_section(args.config, "notify", ["enabled: true", f'server: "{cfg.notify.server}"', f'topic: "{topic}"',
                                              f"signals: {'true' if cfg.notify.signals else 'false'}"],
                      "phone notifications via the free ntfy app (written by app-setup)")
        print(f"Saved the app key and notification channel in {args.config}. Restart Nelson for it to take effect.\n")
    else:
        print("Put this in config.yaml (then restart Nelson):\n")
        print(f"app:\n  enabled: true\n  host: 127.0.0.1\n  port: {cfg.app.port}\n  api_key: \"{key}\"\n")
    if not url:
        print("Next: publish it privately with Tailscale, e.g.  tailscale serve --bg "
              f"{cfg.app.port}\nand run this again with --url https://<your-vps>.<tailnet>.ts.net")
        return
    payload = json.dumps({"url": url, "key": key})
    link_file = Path("nelson_app_link.txt")
    link_file.write_text(payload + "\n", encoding="utf-8")
    print(f"Connection code saved to {link_file.resolve()}")
    print("  Phone-only setup: open that file in Notepad, press Ctrl+A then Ctrl+C, and in the Nelson app")
    print("  long-press the Address box > Paste. Address and key fill in by themselves.\n")
    print(f"Or type them in:  Address: {url}\n                  Key:     {key}\n")
    try:
        import qrcode
    except ImportError:
        return
    qr = qrcode.QRCode(border=2)
    qr.add_data(payload)
    qr.make(fit=True)
    print("Or, from another screen, scan this with the Nelson app (Scan QR code):\n")
    qr.print_ascii(invert=True)


def cmd_demo(cfg, args):
    from nelson.demo import run_demo
    cfg.app.enabled = True
    cfg.app.host = args.host
    cfg.app.api_key = args.key
    cfg.log_dir = "demo_logs"
    print(f"DEMO mode - practice prices, no broker. In the app use address http://<this computer's IP>:{cfg.app.port} "
          f"and key {args.key}")
    run_demo(cfg, args.seconds_per_bar)


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
    ap = sub.add_parser("app-setup", help="create the key and QR code for the Nelson phone app")
    ap.add_argument("--url", default="", help="the https address the phone will use")
    ap.add_argument("--new-key", action="store_true")
    dm = sub.add_parser("demo", help="run on practice prices so you can try the app without MT5")
    dm.add_argument("--host", default="0.0.0.0")
    dm.add_argument("--key", default="nelson-demo-key-not-for-real-trading")
    dm.add_argument("--seconds-per-bar", type=float, default=5.0)
    tg = sub.add_parser("telegram-setup", help="connect Nelson to your phone via Telegram")
    tg.add_argument("--token", default="")
    args = p.parse_args()
    cfg = load_config(args.config, use_learned=args.cmd != "optimize")
    _setup_logging(cfg.log_dir)
    {"backtest": cmd_backtest, "optimize": cmd_optimize, "brief": cmd_brief,
     "download": cmd_download, "live": cmd_live,
     "telegram-setup": cmd_telegram_setup, "app-setup": cmd_app_setup, "demo": cmd_demo}[args.cmd](cfg, args)


if __name__ == "__main__":
    main()
