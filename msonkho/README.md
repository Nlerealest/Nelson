# Msonkho Pocket

*Msonkho* means "tax" in Chichewa. Msonkho Pocket is an **independent prototype** of a taxpayer app for Malawi, built to show how the Malawi Revenue Authority's services could come together in one simple phone app. It is **not an official MRA app** and is not endorsed by MRA.

It runs on Android (and iPhone and the web) from one Expo codebase, works offline, keeps everything on the phone and never asks for an MRA password.

**Install on Android:** https://github.com/Nlerealest/Nelson/releases/download/msonkho-latest/msonkho-pocket.apk
(built by the *Msonkho Pocket APK* GitHub Action whenever `msonkho/` changes).

## Features

| Area | What it does |
| --- | --- |
| **Home** | Next deadline with a countdown, quick actions, "What changed in 2026", a sample tax account and a scam warning |
| **PAYE** | 2026 bands (0/30/35/40%), band by band, monthly or yearly, optional 5% pension, and **salary from take-home pay** |
| **VAT** | Add or remove 17.5% VAT, and **check a receipt**: flags VAT still charged at the old 16.5% |
| **Withholding tax** | 15 payment types with their rates, exemptions, final-tax notes and the remittance date |
| **Presumptive tax** | Annual and quarterly tax for small businesses under K12.5m |
| **VAT registration check** | Progress towards the K50m threshold |
| **Import duty estimate** | Duty, excise and import VAT on the CIF value; EV exemption |
| **Transfer levy** | The 0.05% bank and mobile money levies |
| **Scan and check** | Scans the QR code on EIS receipts and MRA documents and tells you whether it points to mra.mw; also checks links pasted from SMS or WhatsApp and catches lookalikes such as `mra.mw.verify.com`, `rnra.mw` or `mra.mw@evil.com` |
| **Tax calendar** | Deadlines for your profile (employee, employer, VAT-registered, small business, company, importer) and financial year end, with phone reminders 3 days before and on the day |
| **Sales record** | Small businesses log sales; the app shows presumptive tax and the VAT threshold |
| **How to pay** | PRN steps, Airtel Money and TNM Mpamba with dial buttons, and a PRN notepad |
| **Learn** | 12 plain-language guides (PAYE, VAT, EIS, WHT, TPIN, Kalondola, imports, scams and more), each with sources |
| **Help** | Call 672, email, website, regional offices with directions, and how to report fakes |
| **My tax account (demo)** | Sample data showing what a version connected to Msonkho Online could do |
| **About** | Every rate with its effective date, source and how sure we are |
| **Languages** | English and Chichewa (beta) |

The research behind the features and rates is in [`RESEARCH.md`](RESEARCH.md).

## Run it

```bash
cd msonkho
npm install
npx expo start          # scan the QR code with Expo Go (Android), or press w for the web
npm test                # 31 calculation tests (Node 22+)
npx expo lint           # lint
npx tsc --noEmit        # typecheck
```

In Expo Go, phone reminders are switched off (Expo Go no longer includes them); they work in the installed APK.

## Updating rates

Every rate, band and threshold lives in [`src/data/rates.ts`](src/data/rates.ts), with its source and status. Change the figure there, update the matching test in `tests/`, and update `RATES_CHECKED`. Deadlines are generated in [`src/lib/calendar.ts`](src/lib/calendar.ts).

## Project layout

```
app.json                 App name, icon, Android package (mw.nelson.msonkho), permissions
src/app/                 Screens (Expo Router)
  (tabs)/                Home, Tools, Scan, Calendar, More
  calc/                  PAYE, VAT, WHT, presumptive, VAT registration, imports, levy
  learn/                 Guides list and article page
  welcome, pay, business, account, help, settings, about
src/lib/                 Pure logic: tax.ts, calendar.ts, verify.ts, sales.ts, format.ts
src/data/                rates.ts (every figure + sources), content.ts (guides, offices)
src/i18n/                en.ts, ny.ts (Chichewa), dates and helpers
src/components/          Shared UI
src/state/store.tsx      Saved app state (AsyncStorage, on the phone only)
src/reminders.ts         Local deadline notifications
tests/                   Node tests for the calculations, calendar and link checker
```

## Permissions

Camera (QR codes only, nothing saved), notifications (deadline reminders), vibration (scan feedback) and internet (only to open MRA's website). Microphone, storage and draw-over-other-apps are removed.
