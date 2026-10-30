# What Nelson learned from the TJR bootcamp

Nelson's notes on TJR's free YouTube bootcamps: **Boot Camp** (56 videos) and **Boot Camp 2.0** (14 videos), about 22 hours in all. 69 videos have speech; Day 48 part 1 was uploaded without sound and re-posted as part 2. Days 1–4 and 6 were watched with Gemini (video and audio). The rest were read from their captions. This is a summary in Nelson's own words, not a copy of the lessons. Watch the videos themselves to learn the method.

## The method, step by step

| Step | TJR's rule | In Nelson |
| --- | --- | --- |
| Candles | Decide only on **closed** candles. A wick is not a close. | Nelson only uses closed bars. |
| Structure | A swing high or low is a 2-candle turn. A **break of structure** is a candle **body closing** beyond the **most recent** swing. A wick through it is a liquidity sweep, not a break. Higher timeframes outrank lower ones. | `structure.py`. Daily and 4-hour swings use 1 candle each side (`bias_swing_length`). |
| Daily bias | Top-down: the weekly gives context, and the **direction of the last daily break of structure is the bias**. Trade only in that direction. The best trades come when the 4-hour pulls back against the daily and then turns back with it. | `use_daily_bias: true` (on). `use_h4_bias` is a switch. |
| Liquidity | Stops rest above highs and below lows. The ones that matter are **prominent**: previous day high/low, Asian and London session highs/lows, equal highs/lows, and swings that started a trend. Price is "magnetized" toward them. | Previous day, Asian, **London** (new), equal highs/lows and swings. |
| Sweep | Price runs a level and fails to close beyond it. On its own that is **not** a trade signal. | Unchanged. |
| Confirmation | After the sweep, a **break of structure** the other way. No minimum candle size. | `displacement_atr: 0`. The break must come within 24 candles. |
| Entry | Sweep + break of structure, then a pullback into an **order block** or a **fair value gap**. The highest-probability version also has the entry in **discount** (buys) or **premium** (sells) of that leg. Don't enter just because the gap is touched: wait for a reaction. | Limit order in the FVG, in discount/premium of the sweep-to-break leg (`premium_discount_mode: leg`). |
| Stop loss | Beyond the **sweep extreme**, where the idea is proven wrong, plus a little room for the spread. Never a fixed number of pips. | Sweep extreme + 0.2 ATR. |
| Take profit | At the next **liquidity**: the first target is at least 1:1 (close half and move the stop to break-even), then 2–4 more targets at the following levels. | `target_mode: liquidity`. First target ≥ 1R (half closed, stop to break-even), final target the next level, capped at 3R. |
| Sessions | Trade the London or New York open, within the first 1–1.5 hours. Never Asia, and nothing late in the session. | 06:00–17:00 UTC tested best on gold (see below). |
| News | **No trading at all on CPI, PPI, FOMC and NFP days.** For other red-folder news, wait for the release and let price settle. Trade smaller on news days. Skip US bank holidays. | Those four skip the whole day (`skip_day_keywords`). Other high-impact days use **half size** (`news_day_risk_factor: 0.5`). PPI added to tier-1. |
| Risk | 1–3% per day, total. 1 trade a day (2 at most, with the day's risk split). Learn from every loss, and don't switch strategies after a losing streak. | 0.5% per trade, 2% daily stop, 3-loss stop, and the learning system (lessons after every loss). |
| When not to trade | Against the daily bias, when timeframes disagree, in choppy markets, on big news days. "The best traders take the most days off." | Daily bias filter, news days, learned rules. |

Where TJR relies on judgement (which highs are "prominent", consolidation vs trend, when a retracement becomes a reversal), Nelson uses fixed, testable rules instead, and its learning system tracks how each kind of setup performs.

## What was tested on real gold prices

The backtests used 17 months of XAUUSD M5 from the MT5 demo feed (May 2025 – October 2026, ≈100,000 candles), with 0.5% risk, $0.25 spread, slippage and commission. Results are per trade, in R (multiples of the risk).

| Strategy | Trades | Win rate | Avg R | Profit factor | Max DD | 1st half | 2nd half |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Nelson before (H1 bias, big displacement, volume + delta) | 3 | 100% | +1.40 | – | 0% | 0 | +1.40 |
| TJR core (daily bias, any break, FVG, leg premium/discount) | 15 | 53% | +0.14 | 1.22 | 1.3% | +0.02 | +0.49 |
| + liquidity targets | 15 | 53% | +0.34 | 1.61 | 1.3% | +0.32 | +0.41 |
| + liquidity targets capped at 3R, 06:00–17:00 | 22 | 55% | +0.54 | 2.11 | 1.3% | +0.61 | +0.44 |
| **+ 24-candle sweep window (new default)** | **24** | **58%** | **+0.59** | **2.32** | **1.3%** | **+0.61** | **+0.58** |
| Same with the 4-hour filter on | 11 | 64% | +0.98 | 3.62 | 0.5% | +1.24 | +0.85 |
| Order-block entries (sweep candle body) | 27 | 11% | −0.74 | 0.16 | 9.1% | −0.75 | −0.73 |
| FVG without premium/discount | 71 | 41% | −0.15 | 0.73 | 6.4% | +0.01 | −0.45 |

What the tests show:
- **The old rules were so strict that Nelson barely traded**: 3 trades in 17 months.
- **The daily bias, liquidity targets and leg-based premium/discount** made the biggest difference.
- **Premium/discount is essential.** Without it the same setups lose money.
- **Order-block entries lost badly** as implemented: the stop sits just beyond the sweep wick, and price comes back to retest it. They're left as an option (`entry_mode: ob`) but are off.
- **The 4-hour filter** gives the best trades but very few of them. Turn it on with `use_h4_bias: true` if you prefer fewer, cleaner trades.

**Be careful with these numbers.** 24 trades is a small sample, and the default was picked after comparing several variants on the same data, so live results will likely be weaker. Run it on demo for 1–3 months, and let the learning system (the app's Learn tab) show what actually works.

## Switching back

Every rule is a setting in `config.yaml` under `strategy:`. The comment at the bottom of that section lists the values Nelson used before the TJR update.
