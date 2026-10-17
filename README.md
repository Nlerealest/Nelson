# Ndalama: a money manager for Malawi

*Ndalama* means "money" in Chichewa. This app helps people see where their Kwacha goes and how much they can safely spend each day. It runs on **Android and iPhone**, and also in a web browser, from one codebase built with [Expo](https://expo.dev) and React Native.

Picture someone earning **K250,000 a month**. They pay rent, buy groceries, send money to relatives, pay for transport and airtime, and cover surprises. By the end of the month the money is gone and they're not sure where. Ndalama puts all of that in one place.

## Features

| Area | What it does |
| --- | --- |
| **Daily tracking** | Record money in and out in seconds. Categories fit everyday life in Malawi (Rent, Groceries, Transport, ESCOM electricity, Water, Airtime & Data, Family support, School fees, Church & Giving…). Each entry also records how it was paid: Cash, Airtel Money, TNM Mpamba or Bank. |
| **Safe to spend today** | Takes this month's income, subtracts what's already spent, and holds back unpaid bills, debts due this month and this month's savings target. What's left is shared out over the remaining days. If there is a shortfall, the app says so plainly. |
| **Budgets from real income** | "Suggest from my income" splits your earned income across categories (borrowed money and loan repayments don't count). You can then adjust each amount. Each category is flagged when it goes over, or when the current pace means it will. |
| **Savings goals** | A phone, a car, a house or school fees. Each goal shows how much to save per month and per day to meet its deadline. |
| **Goal warnings** | Forecasts the month's spending and warns when your habits make a goal unlikely. It says how many months the goal will actually take at this rate, and names your biggest everyday cost to cut. |
| **Bill reminders** | Monthly bills with a due day. They show as overdue, due soon or paid. "Mark paid" also records the expense. Phone notifications arrive the day before a bill is due and on the day. |
| **Loans & debts** | Money you lent to friends and relatives, and money you borrowed. Records repayments, outstanding balances and overdue loans, with a reminder on the repayment date. |
| **Monthly reports** | Money in and out compared with last month, where the money went (shown against each budget), where it came from, and plain-language insights. |
| **Backup** | Save a backup file to WhatsApp, Google Drive or email, and restore it on a new phone. |

Data stays on the phone. There's no account and no server, and the app works fully offline.

---

## Test it on your own phone (Android or iPhone)

The quickest way is **Expo Go**, a free app that runs this project straight from your computer. You don't need Android Studio, Xcode or a Mac.

1. **On your phone**, install **Expo Go** from the Google Play Store or the Apple App Store.
2. **On your computer**, install [Node.js](https://nodejs.org) (version 20 or newer). Then:

   ```bash
   git clone https://github.com/nlerealest/nelson.git
   cd nelson
   git checkout claude/malawi-money-management-knal4c
   npm install
   npx expo start
   ```

3. A QR code appears in the terminal.
   - **Android:** open Expo Go and tap *Scan QR code*.
   - **iPhone:** open the normal Camera app, point it at the QR code and tap the banner.
4. The app opens on your phone. Save a file on your computer and the phone updates instantly.

If the phone and computer are on different networks (for example, the phone is on mobile data), run `npx expo start --tunnel` instead.

> Tip: tap **Try with sample data** on the first screen to see a full month of the K250,000 example.

### Install a real Android app (APK) for testing

To keep Ndalama on your phone like any other app, without needing your computer running, build an APK in the cloud with EAS. It's free for occasional builds.

```bash
npm install -g eas-cli
eas login                      # create a free account at expo.dev if you don't have one
eas init                       # links this project to your Expo account (one time)
eas build --platform android --profile preview
```

After about 10–20 minutes you get a link and a QR code. Open it on your Android phone, download the APK and install it. You may need to allow "Install unknown apps" for your browser. You can send the same link to friends who want to test.

### Install on iPhone for testing

Apple doesn't allow installing apps from a link the way Android does. You have two options:

- **Expo Go** (above): free, and good for day-to-day testing.
- **TestFlight**: needs an [Apple Developer account](https://developer.apple.com/programs/) (US$99/year). Then:

  ```bash
  eas build --platform ios --profile production
  eas submit --platform ios
  ```

  Then add yourself and other testers in App Store Connect → TestFlight. No Mac is required; EAS builds and signs the app in the cloud.

---

## Publish on the Google Play Store

1. **Create a Google Play Developer account** at [play.google.com/console](https://play.google.com/console). It costs a one-time US$25, and Google asks for ID verification.
2. **Choose your app ID.** `app.json` currently uses `com.ndalama.app`. Change `android.package` (and `ios.bundleIdentifier`) to something you own, for example `mw.yourname.ndalama`, **before the first upload**. It can never be changed afterwards.
3. **Build the store version.** This produces an Android App Bundle (.aab), the format Play requires:

   ```bash
   eas build --platform android --profile production
   ```

4. **Create the app in Play Console**, then fill in:
   - **Store listing**: name, short and full description, icon (`assets/icon.png`) and phone screenshots.
   - **Privacy policy URL**: host [`PRIVACY.md`](PRIVACY.md), for example on GitHub Pages or Google Sites, and paste the link.
   - **Data safety**: Ndalama collects and shares **no data**, because everything stays on the device.
   - **Content rating** questionnaire, target audience, and app category (*Finance*).
5. **Upload the first build by hand**, to *Testing → Internal testing*. Add your Gmail as a tester and install from the Play Store link.
6. **Later uploads** can be automated: create a Google service-account key in Play Console, then run `eas submit --platform android`. `eas.json` sends builds to the internal testing track by default.
7. When you're happy, promote the release from internal testing to closed testing, then production. New personal developer accounts must run a closed test with at least 12 testers for 14 days before production access is granted.

Each new release needs a higher version number. EAS bumps `versionCode` automatically (`autoIncrement` in `eas.json`); change `version` in `app.json` for user-visible versions, such as `1.1.0`.

### Updates without a new store release

Small fixes to screens and logic can be pushed straight to installed apps with [EAS Update](https://docs.expo.dev/eas-update/introduction/) (`eas update`), with no store review needed.

---

## How the numbers are worked out

All calculations are in [`src/logic.js`](src/logic.js), plain JavaScript shared by every platform and covered by tests.

- **Safe daily amount** = (income − spent before today − unpaid bills − debts due this month − savings for this month) ÷ days left, including today.
  - Lump sums paid today, such as rent or a debt repayment, come out of the monthly pool rather than today's allowance.
- **Monthly saving needed for a goal** = amount remaining ÷ months until the deadline. Money already saved this month counts towards it.
- **Spending forecast** = spent so far + unpaid bills + an estimate for the rest of the month.
  - Everyday spending tends to be heavier just after payday. When there's history, the estimate gives double weight to what was actually spent in the same remaining days of past months, and single weight to this month's pace.
  - Lump sums (rent, utilities, school fees, family support) are never extrapolated.
- **Goal warning**: when the forecast leftover is smaller than what your goals need each month, the leftover is shared between goals in proportion to what each needs. Any goal that falls short gets a warning.

## Development

```bash
npm install
npx expo start         # dev server; press a for Android emulator, i for iOS simulator, w for web
npm test               # calculation tests (Node 20+)
npx expo lint          # lint
```

### Project layout

```
app.json                 App name, icons, app IDs, permissions, plugins
eas.json                 Cloud build profiles: development, preview (APK), production (store)
assets/                  App icon, Android adaptive icon, splash, notification icon
src/app/                 Screens (Expo Router): _layout.js (tabs), index.js (Home),
                         budget.js, goals.js, bills.js, loans.js, report.js
src/components/ui.js     Shared building blocks: cards, buttons, fields, date picker
src/components/forms.js  All forms, shown in one bottom sheet
src/components/rows.js   Bill row
src/logic.js             Pure calculations (budgets, safe spend, goals, bills, loans, reports)
src/data.js              App state: saved data, today's date, sheet, toasts
src/storage.js           On-device storage (AsyncStorage)
src/reminders.js         Local bill and loan notifications
src/backup.js            Backup export and restore
src/demo.js              Sample data
tests/logic.test.js      Unit tests for the calculations
```
