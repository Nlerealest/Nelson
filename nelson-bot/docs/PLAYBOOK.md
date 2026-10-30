# Nelson's playbook

Nelson hunts with 11 strategies at once. Four place demo trades. Seven are watch-only: Nelson follows their setups on live prices and records the result, so the Learn tab shows how each one does without risking money.

Each setup says which strategy found it. Every strategy still passes the news rules, the late-Friday cut-off, the 0.5% risk per trade and the daily loss stop.

## What was learned

| Source | Main rules |
| --- | --- |
| TJR, "My UPDATED Day Trading Strategy (2026)" and his confluence and time videos | Liquidity is session, 1-hour and 4-hour highs and lows. Step 1: a sweep. Step 2: a 5-minute break of structure or inverse fair value gap. Step 3: a retrace. Step 4: a 1-minute break back with the trend, stop beyond the retrace, target the next liquidity. His own view: a strategy's job is to stop bad trades, and data has to back it. |
| Your notes | Sessions in Eastern time, sweeps of Asian, London and untested levels, continuation when a level breaks and holds, 07:00–07:15 ET range on gold, 18:00 ET first 5-minute range for Asia. |
| ICT (third-party summaries, not ICT's own material) | Optimal trade entry at the 62–79% retrace, silver bullet in one-hour windows, Judas swing in London against the Asian range, power of three. |
| General trading research | Trend following, momentum, opening range with volatility and volume filters, mean reversion in low-volatility ranges (ADX under 20–25). |

TJR's 2026 method uses ES and NQ agreement. Nelson trades gold only, so that check isn't included. His entry is on the 1-minute chart; Nelson works on 5-minute candles, so the retrace and break back are an approximation. That may be why it tested flat here.

## Backtest on 17 months of gold (May 2025 – October 2026)

0.5% risk, with spread, slippage and commission. "1st" and "2nd" are the average result in each half of the data, each run separately.

**Each strategy alone, as first written:**

| Strategy | Trades | Won | Avg | 1st half | 2nd half | Status |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| TJR bootcamp | 53 | 49% | +0.29R | +0.42 | +0.18 | **Trading**, with the 4-hour filter |
| Mean reversion | 44 | 50% | +0.44R | +0.85 | −0.01 | **Trading**, with the 4-hour filter |
| Break and retest | 363 | 50% | +0.05R | +0.07 | −0.01 | **Trading**, with filters |
| Momentum | 192 | 48% | +0.03R | −0.02 | +0.06 | **Trading**, with filters |
| ICT silver bullet | 75 | 43% | −0.01R | −0.15 | +0.06 | Watch only |
| TJR 2026 (5-minute version) | 133 | 44% | −0.10R | −0.10 | +0.03 | Watch only |
| Trend following | 425 | 48% | −0.02R | +0.02 | −0.07 | Watch only |
| Opening range 07:00 ET | 21 | 38% | −0.12R | −0.19 | −0.08 | Watch only |
| ICT optimal trade entry | 37 | 16% | −0.58R | −0.58 | −0.13 | Watch only |
| ICT Judas swing | 9 | 22% | −0.65R | −1.00 | −0.13 | Watch only |
| Asia opening range | 1 | 0% | – | – | – | Watch only (too few trades) |

The drawdown stop halted a few of the worst runs early. With it off, TJR 2026 averaged −0.06R over about 860 trades and optimal trade entry −0.19R over about 270.

**With filters that held in both halves:**

| Strategy | Filter | Trades | Won | Avg | 1st half | 2nd half |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| TJR bootcamp | 4-hour agrees | 27 | 59% | +0.81R | +0.85 | +0.78 |
| Mean reversion | 4-hour agrees | 20 | 65% | +0.63R | +1.06 | +0.19 |
| Break and retest | 4-hour agrees, 00:00–12:00 UTC | 130 | 53% | +0.18R | +0.19 | +0.13 |
| Momentum | 12:00–16:00 UTC | 108 | 53% | +0.14R | +0.11 | +0.16 |
| **All four together** (2 trades at once, 5 a day) | | **288** | **55%** | **+0.26R** | **+0.31** | **+0.21** |

All four together: about 17 trades a month, +41% return, 4.7% worst drawdown, about +5,750 pips. TJR bootcamp alone made +10%.

**Be careful with these numbers.** Filters were chosen by looking at this same data, so live results will likely be weaker, and 20–27 trades is a small sample for the first two rows. Spread at thin hours can be wider than the $0.25 tested.

## Changing it

In `config.yaml`, under `playbook:`, move a name between `enabled` (places trades) and `watch` (learns only). Promote a watch-only strategy only after the Learn tab shows it working on live prices.
