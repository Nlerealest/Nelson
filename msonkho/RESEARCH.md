# Msonkho Pocket: research notes

Research for version 2, done on **25 November 2026**. It covers what MRA is planning, which rules changed in 2026, what other revenue authorities' apps do well, and how each finding shaped the app.

> **How this was researched.** Web searches over MRA's own public notices, the Ministry of Finance budget documents, tax-firm summaries (PwC, KPMG, Grant Thornton), payroll vendors and Malawian news. The build environment could not open mra.mw directly, so figures come from search extracts of those documents. Each figure in the app is tagged as **MRA notice**, **Reported** or **Older table** (see `src/data/rates.ts` and the app's About screen).

## 1. MRA's direction: the 2026–2031 Corporate Strategic Plan

- Launched on **24 August 2026** in Blantyre, themed *"Leveraging Digital Transformation for Sustained Revenue Growth and Efficient Service"*.
- **Three pillars:** sustainable revenue mobilisation, **digital transformation**, and people and institutional culture.
- **Priorities:** integrated tax and customs systems, **expanded digital services for taxpayers**, data-driven decisions, risk-based compliance and a more taxpayer-oriented authority.
- Source: [UNDP Malawi](https://www.undp.org/malawi/news/malawi-revenue-authority-launches-five-year-plan-modernise-revenue-administration), [AllAfrica](https://allafrica.com/stories/202608240329.html).

**What this means for the app:** Msonkho Pocket is pitched as a self-service front door to MRA's existing systems, not a replacement for them. Every screen works offline, and the "My tax account" demo shows what a version connected to Msonkho Online could do.

## 2. MRA's digital systems today

| System | What it does | In the app |
| --- | --- | --- |
| **Msonkho Online** | Registration, returns, PRNs, taxpayer account | "How to pay" guide; account demo; links |
| **EIS** (Electronic Invoicing System) | Real-time validated receipts with a QR code; compulsory for VAT-registered businesses from **1 May 2026**; replaced EFDs; about 91% of 9,000 VAT businesses migrated by June 2026 | QR scanner that checks the link is on mra.mw; receipt VAT check |
| **Kalondola** | Digital excise tax stamps since May 2024 (cigarettes, alcohol, soft drinks, bottled water, some personal care items) | Learn article; report via 672 |
| **MRA Mobile App** | PAYE and duty calculators, customs clearance tracking, document verification ([App Store](https://apps.apple.com/eg/app/mra-mobile-app/id6504921130)) | Msonkho Pocket complements it, and could be delivered as an upgrade to it |
| **Call centre 672** | Toll-free on Airtel and TNM | One-tap call; "Report it" button on fake links |
| **Mobile money** | Pay with a PRN via Airtel Money (*211#) and TNM Mpamba (*444#) | Step-by-step guide with dial buttons |

A genuine EIS validation link looks like `https://eservices.mra.mw/doc/v/?vc=…&c=…` ([integration notes](https://wiki.portaone.com/x/xKx8EQ)). The scanner treats any `https` address on `mra.mw` or a subdomain as MRA's, and flags lookalikes such as `mra.mw.verify-receipt.com`.

## 3. Tax rules in force (November 2026)

| Rule | Figure | Status | Source |
| --- | --- | --- | --- |
| PAYE (monthly) | 0% ≤ K170,000; 30% to K1,570,000; 35% to K10,000,000; 40% above | MRA notice, from 31 Dec 2025 | [MRA public notice](https://www.mra.mw/admin/storage/download_files/1767952247_NEW%20TAX%20MEASURES...pdf) |
| VAT | **17.5%** (was 16.5%) | MRA notice, from 31 Dec 2025 | MRA notice; [VATupdate](https://www.vatupdate.com/2026/01/07/malawi-raises-vat-to-17-5-following-presidential-assent-to-value-added-amendment-act-2025/) |
| VAT registration threshold | **K50 million** a year (was K25m) | Reported, from 15 Apr 2026 | [VATupdate](https://www.vatupdate.com/2026/05/23/malawi-enacts-2026-27-budget-with-tax-reforms-and-higher-vat-threshold/), [KPMG](https://kpmg.com/us/en/taxnewsflash/news/2026/05/tnf-malawi-nonresident-digital-services-providers-to-register-for-vat.html) |
| Winnings | 15% WHT, no tax-free amount | MRA notice | MRA notice |
| Minimum alternative tax | 0.5% of turnover above K5bn | MRA notice | MRA notice |
| Withholding tax | Services, fees, commission, rent, royalties, interest, entertainment 20%; haulage 10%; construction 4%; supplies and farm produce 3%; dividends 10%; non-residents 15%; casual labour 20% above K35,000 | Reported | [MRA WHT leaflet](https://elibrary.mra.mw/server/api/core/bitstreams/69ae3ba3-ce66-422d-b224-a4726c6939d4/content), [PwC](https://taxsummaries.pwc.com/malawi/corporate/withholding-taxes) |
| Presumptive tax | Below K12.5m turnover: K0 / K110,000 / K170,000 / K225,000 a year | Older table (2021) | [PwC](https://taxsummaries.pwc.com/malawi/corporate/other-taxes), [Lloyds](https://www.lloydsbanktrade.com/en/market-potential/malawi/taxes) |
| Fringe benefits tax | 30%, quarterly, 14 days after each quarter | Reported | PwC |
| Transfer levies | 0.05% on bank transfers; mobile money only above K100,000 | Reported, from Jan 2026 | [Regfollower](https://regfollower.com/?p=76755), [ITWeb](https://itweb.africa/article/new-mobile-money-levies-baffle-malawians/JBwErvn38OV76Db2) |
| Electric vehicles | No import or excise duty (2026/27 budget) | Reported | [AllAfrica](https://allafrica.com/stories/202603160666.html) |
| Deadlines | PAYE and WHT by the 14th; VAT by the 25th; provisional tax by the 25th after each quarter; presumptive tax by the 20th after each quarter; annual return within 180 days of year end | Reported | PwC, [Grant Thornton](https://grantthornton.global/en/insights/indirect-tax-guide/indirect-tax---Malawi) |

**Worked checks:** PAYE on K500,000 = 30% × K330,000 = **K99,000**. K117,500 including VAT contains **K17,500** VAT.

> **Note on the email sent to MRA on 25 November 2026:** it describes the prototype as using **16.5%** VAT. VAT has been 17.5% since 31 December 2025, and version 2 uses 17.5%. Mention the update in any follow-up.

## 4. What other revenue authorities' apps do

| App | Features worth borrowing |
| --- | --- |
| **KRA M-Service** (Kenya) | PIN checker, tax compliance certificate checker, staff verification, PRN checking, nil returns, pay taxes ([KRA](https://www.kra.go.ke/m-services)) |
| **SARS MobiApp** (South Africa) | File returns, pay, compliance status, payment arrangements, appointments ([SARS](https://www.sars.gov.za/guide-to-services-offered-via-the-sars-mobiapp)) |
| **URA EFRIS** (Uganda) | Scan an e-receipt's QR code or enter its number to validate it ([URA handbook](https://ura.go.ug/storage/2026/08/EFRIS-HANDBOOK-FY-2026-27.pdf)) |
| **ZRA Smart Invoice** (Zambia) | Offline invoicing that syncs later; QR codes on every invoice |
| **TRA** (Tanzania) | Receipt verification by code or QR at verify.tra.go.tz |

The common thread is **verify, calculate, remind, pay**. Version 2 covers verification (QR and link checks), calculation, reminders and payment guidance offline, and shows account, payment and filing features as a clearly labelled demo.

## 5. What changed from version 1

| Version 1 | Version 2 |
| --- | --- |
| VAT at 16.5% | **VAT at 17.5%**, plus a receipt check that spots the old rate |
| PAYE, VAT, scan, calendar, help | Adds withholding tax, presumptive tax, VAT registration check, import duty estimate, transfer levy, salary from take-home pay |
| Fixed sample deadlines | Personal calendar by taxpayer type and financial year end, with local reminders and "mark done" |
| English only | **English and Chichewa** |
| — | Sales record for small businesses (presumptive tax and VAT threshold) |
| — | Phishing and SMS link checker with lookalike detection |
| — | Plain-language guides with sources; every rate shows its source and status |
| — | Unit tests for every calculation (31 tests) |

## 6. To confirm with MRA before a pilot

1. Presumptive tax bands for 2026/27 (the 2021 table is the latest found).
2. PAYE and WHT remittance day: most sources say the **14th**, one says the 15th.
3. Casual labour WHT: the K35,000 threshold and whether 20% applies to the whole payment.
4. The exact QR formats of EIS receipts, tax clearance certificates and other MRA documents (so the scanner can show MRA's record directly).
5. The recommended app for checking Kalondola stamps.
6. Current regional office addresses and phone numbers.
7. Whether MRA would offer an API (Msonkho Online sign-in, account balance, PRN generation) for a connected version.
