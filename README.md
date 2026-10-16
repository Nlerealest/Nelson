# Ndalama: a money manager for Malawi

*Ndalama* means "money" in Chichewa. This app helps people see where their Kwacha goes and how much they can safely spend each day.

Picture someone earning **K250,000 a month**. They pay rent, buy groceries, send money to relatives, pay for transport and airtime, and cover surprises. By the end of the month the money is gone and they're not sure where. Ndalama puts all of that in one place.

## Features

| Area | What it does |
| --- | --- |
| **Daily tracking** | Record money in and out in seconds. Categories fit everyday life in Malawi (Rent, Groceries, Transport, ESCOM electricity, Water, Airtime & Data, Family support, School fees, Church & Giving…). Each entry also records how it was paid: Cash, Airtel Money, TNM Mpamba or Bank. |
| **Safe to spend today** | Takes this month's income, subtracts what's already spent, and holds back unpaid bills, debts due this month and this month's savings target. What's left is shared out over the remaining days. If there is a shortfall, the app says so plainly. |
| **Budgets from real income** | "Suggest from my income" splits your actual income (this month, or your recent average) across categories. You can then adjust each amount. Each category shows a progress bar and is flagged when it goes over, or when the current pace means it will. |
| **Savings goals** | A phone, a car, a house or school fees. Each goal shows how much to save per month and per day to meet its deadline. |
| **Goal warnings** | Forecasts the month's spending and warns when your habits make a goal unlikely. It says how many months the goal will actually take at this rate, and names your biggest everyday cost to cut. |
| **Bill reminders** | Monthly bills with a due day. They show as overdue, due soon or paid. "Mark paid" also records the expense. Optional phone notifications appear once a day. |
| **Loans & debts** | Money you lent to friends and relatives, and money you borrowed. Records repayments, outstanding balances and overdue loans. |
| **Monthly reports** | Money in and out compared with last month, where the money went (shown against each budget), where it came from, and plain-language insights such as "Transport rose by K10,000". |

### How the numbers are worked out

All calculations are in [`src/logic.js`](src/logic.js) and are covered by tests.

- **Safe daily amount** = (income − spent before today − unpaid bills − debts due this month − savings for this month) ÷ days left, including today.
  - Lump sums paid today, such as rent or a debt repayment, come out of the monthly pool rather than today's allowance.
- **Monthly saving needed for a goal** = amount remaining ÷ months until the deadline. Money already saved this month counts towards it.
- **Spending forecast** = spent so far + unpaid bills + an estimate for the rest of the month.
  - Everyday spending tends to be heavier just after payday. When there's history, the estimate gives double weight to what was actually spent in the same remaining days of past months, and single weight to this month's pace.
  - Lump sums (rent, utilities, school fees, family support) are never extrapolated.
- **Goal warning**: when the forecast leftover is smaller than what your goals need each month, the leftover is shared between goals in proportion to what each needs. Any goal that falls short gets a warning.

## Designed for real conditions

- **Works offline.** After the first visit, a service worker keeps the app working with no data bundle.
- **Installable.** Add it to the home screen on Android; it opens like a normal app.
- **Private.** Data stays on the phone, in browser storage. There's no account and no server. A backup can be downloaded and restored, for example when moving to a new phone.
- **Light.** No frameworks or build step, and only a few small files. It suits basic phones and slow connections.

## Running it

Any static file server works. For example:

```bash
npm start            # python3 -m http.server 8080
# open http://localhost:8080
```

Tap **Try with sample data** to see a month of a K250,000 income with bills, goals and loans already filled in.

To publish it, host the folder on any static host (GitHub Pages, Netlify and so on). Offline support and notifications need HTTPS.

## Tests

```bash
npm test             # Node 18+, no dependencies
```

## Project layout

```
index.html            App shell
manifest.webmanifest  Install-to-home-screen metadata
sw.js                 Offline cache and notification clicks
src/logic.js          Pure calculations (budgets, safe spend, goals, bills, loans, reports)
src/store.js          localStorage persistence, backup, sample data
src/app.js            UI rendering and interactions
src/styles.css        Mobile-first styles (light and dark)
tests/logic.test.js   Unit tests for the calculations
```
