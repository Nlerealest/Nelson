# Nelson: XAUUSD trading bot for MetaTrader 5

Nelson trades **gold against the US dollar (XAUUSD)** on your MT5 account. It reads the market the way a smart-money trader does: market structure, liquidity, sweeps, fair value gaps and order flow. It stays out of the way of high-impact USD news, and every trade is sized so that a loss costs a fixed, small slice of your balance.

> **Read this first.** No bot can promise a high win rate or profits. Gold is one of the most volatile markets, and most retail accounts that trade it lose money. Nelson is built so you can **prove or disprove** the strategy on years of real XAUUSD data before risking anything. It starts in **paper mode** (analysis only). It will not touch a real-money account unless you switch it on deliberately in two separate places. Run it on a **demo account for at least 1–3 months** first.

---

## How Nelson trades

| Step | What Nelson checks |
| --- | --- |
| **1. Bias** | The H1 market structure (breaks of structure, BOS, and changes of character, CHoCH). It only buys when H1 is bullish and only sells when H1 is bearish. It buys in **discount** (below the middle of the H1 range) and sells in **premium**. |
| **2. Liquidity map** | Where stop orders are resting: **previous day high/low**, **Asian session high/low**, **equal highs/lows** and recent swing points. |
| **3. Liquidity sweep** | During the **London (07:00–10:30 UTC)** or **New York (12:30–16:00 UTC)** killzone, price wicks through one of those levels and **closes back inside**, meaning the stops were taken and the move was rejected. |
| **4. Order flow** | The sweep candle must carry above-normal **volume** (a real stop run). **Delta** (aggressive buying minus selling, from the MT5 tick stream) must agree with the reversal. |
| **5. Shift** | A strong **displacement** candle (body ≥ 1× ATR) closes through the internal swing that led into the sweep, leaving a **fair value gap (FVG)**. |
| **6. Entry** | A limit order in the FVG. The stop goes beyond the sweep wick plus a buffer. The target is 2.5R. Half the position closes at 1R and the stop moves to break-even. Orders not filled within 1 hour are cancelled. |
| **7. News** | No new trades 30 minutes either side of high-impact USD news, or 60 minutes for NFP, CPI, FOMC, Powell, PCE and GDP. Open trades are closed 10 minutes before those tier-1 events. If the calendar can't be loaded, Nelson doesn't trade. |

**Risk rules** (all in `config.yaml`):
* 0.5% risk per trade.
* Trading stops for the day after a 2% loss or 3 losses in a row.
* At most 3 trades a day and 1 position at a time.
* Trading stops completely at a 10% drawdown, and a human has to restart it.
* No trading when the spread is above $0.50.
* Positions are closed on Friday at 20:30 UTC so they don't sit through the weekend gap.

Every signal, skipped setup, order, fill, partial close and exit is written to `logs/journal.csv` with the reasons, so you can review each decision. Every hour Nelson also logs a **market brief**: bias, premium/discount, key levels, nearest liquidity, volume profile (POC and value area), order flow, and the next high-impact USD news.

### About "order flow" on spot gold
XAUUSD is traded over the counter, so there's no central order book and no true traded volume like on the COMEX futures (GC). Nelson uses what MT5 actually provides:
* **tick volume**, which closely follows real activity;
* **tick-by-tick delta**, which classifies upticks as buying and downticks as selling.

That's the honest form of order flow on this instrument.

### How Nelson "learns"
`optimize` runs a **walk-forward test**:
1. Pick the best settings on 6 months of history.
2. Trade those settings on the **next 2 months, which the optimiser has never seen**.
3. Roll forward and repeat across all the data.

Only the unseen results are reported. Fitting settings to all of history would look amazing on paper and then fail live. If the unseen results are profitable, the settings from the most recent period are saved to `learned_params.json` and the live bot uses them. If they aren't, Nelson refuses to save them.

The optimiser scores **expectancy and drawdown, not win rate**. A 2.5R strategy can be very profitable at a 40–45% win rate. A strategy tuned for a 90% win rate usually has tiny wins and occasional huge losses.

---

## Use Nelson from your phone

Phones can't run trading bots: the MT5 app on Android and iPhone has no automated trading. Nelson runs on a computer that stays on, and your phone is the remote control.

```
 Windows VPS (always on)                      Your phone
 ┌────────────────────────┐   alerts    ┌──────────────────────┐
 │ MetaTrader 5 + Nelson  │ ──────────▶ │ Telegram: Nelson bot │
 │                        │ ◀────────── │ /status /pause ...   │
 └────────────────────────┘  commands   ├──────────────────────┤
            │                           │ MT5 app: same account│
            └──── same MT5 account ───▶ │ (see trades on chart)│
                                        └──────────────────────┘
```

### 1. Get a Windows VPS (a computer in the cloud)
* Many brokers give a **free VPS** once your account reaches a certain balance or trading volume. Ask yours first.
* Otherwise rent a small **Windows** VPS (2 GB RAM is enough). Pick one close to your broker's servers, usually London or New York.
* From your phone, install **Windows App** (Microsoft's Remote Desktop app; Android and iPhone) to log in to the VPS. On the VPS, install MT5 and Python and set up Nelson as described in "Setup" below. You only need to do this once. A laptop makes it easier, but it works from a phone.

### 2. Connect Telegram (5 minutes)
1. In Telegram, open **@BotFather**, send `/newbot` and pick a name (for example *Nelson Gold*). Copy the **token** it gives you. Keep it secret.
2. Open your new bot and press **START**.
3. On the VPS, run:
   ```bash
   python run_nelson.py telegram-setup --token <YOUR_TOKEN>
   ```
   Your phone receives a test message. The command prints the `telegram:` lines to paste into `config.yaml`.
4. Restart Nelson. You'll get a "Nelson started" message.

Nelson only answers the chat IDs listed in `config.yaml`. Anyone else who finds your bot is ignored.

### 3. What you get on your phone

**Alerts:**
* each order and the reasons for it;
* fills, partial profits and moves to break-even;
* every closed trade with its profit or loss and your new balance;
* trades cancelled or closed because of news or the weekend;
* daily-limit and drawdown stops;
* errors;
* an end-of-day summary at 21:05 UTC.

**Commands:**

| Command | What it does |
| --- | --- |
| `/status` | Balance, equity, today's profit/loss, open trades and orders |
| `/brief` | Nelson's current read of gold: bias, liquidity, key levels, order flow, news |
| `/news` | High-impact USD news in the next 48 hours |
| `/journal` | The last 10 journal entries |
| `/pause` / `/resume` | Stop or allow new trades. Open trades are still managed. Remembered after a restart. |
| `/closeall` | Closes every Nelson trade and cancels its orders. You must confirm with `/closeall yes`, and Nelson then pauses. |
| `/risk 0.5` | Change the risk per trade. It can never exceed `telegram.max_risk_pct` (1% by default). |

### 4. Watch the trades in the MT5 app
Install **MetaTrader 5** from the Play Store or App Store and log in to the **same account**. Nelson's trades appear on the chart with their stop and target. To be able to look but not trade from the phone, log in with the account's **investor (read-only) password**.

---

## Setup (Windows PC or Windows VPS)

The MetaTrader5 Python package only works on **Windows**, next to an MT5 terminal. To run Nelson 24/5, use a Windows VPS. Backtesting and optimising work on any computer.

1. Install **MetaTrader 5** from your broker. Log in to your **demo** account. Make sure XAUUSD shows in Market Watch, and press **Algo Trading** in the toolbar so it turns green.
2. Install **Python 3.11 or newer** from python.org and tick **"Add python.exe to PATH"**.
3. Double-click **`Start Nelson (Windows).bat`**. The first run installs everything and creates `config.yaml` in paper mode.
4. Open `config.yaml` and set `symbol` to the exact name your broker uses (for example `XAUUSD`, `XAUUSDm` or `GOLD`).

Or from a terminal:

```bash
cd nelson-bot
pip install -r requirements.txt
copy config.example.yaml config.yaml
python run_nelson.py brief            # Nelson's current read of XAUUSD
python run_nelson.py live             # run the bot
```

### Step 1: get real XAUUSD history

Pick one of these:
* **From your broker (best):** in MT5, go to *View → Symbols → XAUUSD → Bars*, choose M5, set a date range (2+ years), click *Request* and then *Export Bars*. Save the file as `data/xauusd_m5.csv`. Broker times are usually UTC+2 or UTC+3, so pass `--utc-offset 2` (or 3) when you run the backtest.
* **Free download from Dukascopy:**
  ```bash
  python run_nelson.py download --start 2022-01-01 --end 2025-12-31 --out data/xauusd_m5.csv
  ```

### Step 2: backtest and learn

```bash
python run_nelson.py backtest --csv data/xauusd_m5.csv --utc-offset 2
python run_nelson.py optimize --csv data/xauusd_m5.csv --utc-offset 2
```

The backtest reports win rate, profit factor, expectancy (in R), maximum drawdown and trades per month. It also breaks results down by session and by liquidity type, and saves every trade with its reasoning to `logs/backtest_trades.csv`.

The backtest is deliberately pessimistic:
* It uses bid data, and charges spread on buys and on closing sells.
* It charges slippage on stop-outs and commission on every lot.
* When one candle touches both the stop and the target, it counts the stop as hit first.

For the news filter in backtests, set `news.history_csv` to a CSV with columns `date,currency,impact,title`. You can export past events from an economic calendar.

### Step 3: demo, then (maybe) live

1. Set `mode: demo` and let it run for at least 1–3 months.
2. Compare the demo results and the journal with the backtest.
3. Only if they match, set `mode: live` **and** `allow_real_money: true`. Start with the default 0.5% risk or less.

---

## Files

```
run_nelson.py          command line: live | backtest | optimize | brief | download
nelson/strategy.py     the trading model (sweep -> displacement -> FVG, all filters)
nelson/structure.py    swing points, BOS/CHoCH, H1 trend, premium/discount
nelson/liquidity.py    liquidity levels and sweep detection
nelson/orderflow.py    tick volume, delta, volume profile
nelson/news.py         economic calendar filter
nelson/risk.py         position sizing and loss limits
nelson/backtest.py     realistic backtester
nelson/optimizer.py    walk-forward learning
nelson/live.py         the live MT5 loop and trade management
nelson/mt5_broker.py   everything that talks to MetaTrader 5
nelson/telegram.py     phone alerts and commands
tests/                 unit tests:  python -m unittest discover -s tests
```

Nelson only manages trades that carry its own magic number (`777001`), so it won't interfere with your manual trades. It's still best to give it its own account.
