// Every tax rate, band and threshold the app uses, in one place, so a change
// announced by MRA is a one-line edit. Each figure records where it comes from
// and how sure we are about it (see `Confidence`), and the About screen lists
// them all so users and MRA staff can check them.
//
// Research date: 25 November 2026. See RESEARCH.md for the full notes.

export const RATES_CHECKED = '2026-11-25';

/**
 * official: MRA's own public notice or the Act itself.
 * reported: the enacted law as reported consistently by tax firms and the press.
 * older:    the latest published table found; no 2026 change found, but not
 *           confirmed for 2026 either.
 */
export type Confidence = 'official' | 'reported' | 'older';

export type SourceId = keyof typeof SOURCES;

export const SOURCES = {
  mraNotice: {
    title: 'Public notice: new tax measures under the Taxation and VAT (Amendment) (No. 2) Acts 2025',
    publisher: 'Malawi Revenue Authority',
    date: 'Dec 2025',
    url: 'https://www.mra.mw/admin/storage/download_files/1767952247_NEW%20TAX%20MEASURES...pdf',
  },
  mraWht: {
    title: 'Withholding tax leaflet, April 2024 – March 2025',
    publisher: 'Malawi Revenue Authority e-library',
    date: '2024',
    url: 'https://elibrary.mra.mw/server/api/core/bitstreams/69ae3ba3-ce66-422d-b224-a4726c6939d4/content',
  },
  vat175: {
    title: 'Malawi raises VAT to 17.5% following presidential assent to the VAT (Amendment) Act 2025',
    publisher: 'VATupdate',
    date: 'Jan 2026',
    url: 'https://www.vatupdate.com/2026/01/07/malawi-raises-vat-to-17-5-following-presidential-assent-to-value-added-amendment-act-2025/',
  },
  budget2026: {
    title: 'Malawi enacts 2026–27 budget with tax reforms and higher VAT threshold',
    publisher: 'VATupdate',
    date: 'May 2026',
    url: 'https://www.vatupdate.com/2026/05/23/malawi-enacts-2026-27-budget-with-tax-reforms-and-higher-vat-threshold/',
  },
  digitalVat: {
    title: 'Malawi: non-resident digital services providers to register for VAT',
    publisher: 'KPMG',
    date: 'May 2026',
    url: 'https://kpmg.com/us/en/taxnewsflash/news/2026/05/tnf-malawi-nonresident-digital-services-providers-to-register-for-vat.html',
  },
  pwcOther: {
    title: 'Malawi: other taxes (presumptive tax, fringe benefits tax)',
    publisher: 'PwC Worldwide Tax Summaries',
    date: 'reviewed 2023–2026',
    url: 'https://taxsummaries.pwc.com/malawi/corporate/other-taxes',
  },
  pwcAdmin: {
    title: 'Malawi: tax administration (provisional tax, returns)',
    publisher: 'PwC Worldwide Tax Summaries',
    date: 'reviewed 2023–2026',
    url: 'https://taxsummaries.pwc.com/malawi/corporate/tax-administration',
  },
  pwcWht: {
    title: 'Malawi: withholding taxes',
    publisher: 'PwC Worldwide Tax Summaries',
    date: 'reviewed 2023–2026',
    url: 'https://taxsummaries.pwc.com/malawi/corporate/withholding-taxes',
  },
  lloyds: {
    title: 'Tax rates in Malawi (presumptive tax table)',
    publisher: 'Lloyds Bank International Trade Portal',
    date: 'undated',
    url: 'https://www.lloydsbanktrade.com/en/market-potential/malawi/taxes',
  },
  grantThornton: {
    title: 'Indirect tax guide: Malawi (VAT returns)',
    publisher: 'Grant Thornton',
    date: '2022',
    url: 'https://grantthornton.global/en/insights/indirect-tax-guide/indirect-tax---Malawi',
  },
  levies: {
    title: 'Mid-year budget review: bank and mobile money transfer levies',
    publisher: 'Regfollower',
    date: 'Nov 2025',
    url: 'https://regfollower.com/?p=76755',
  },
  levyNews: {
    title: 'New mobile money levies baffle Malawians',
    publisher: 'ITWeb Africa',
    date: 'Feb 2026',
    url: 'https://itweb.africa/article/new-mobile-money-levies-baffle-malawians/JBwErvn38OV76Db2',
  },
  eis: {
    title: 'Malawi e-invoicing and e-reporting country booklet',
    publisher: 'VATupdate',
    date: 'Oct 2026',
    url: 'https://www.vatupdate.com/2026/10/02/malawi-e-invoicing-e-reporting-country-booklet/',
  },
  eisUrl: {
    title: 'EIS integration notes (example MRA validation link on eservices.mra.mw)',
    publisher: 'PortaOne wiki',
    date: '2026',
    url: 'https://wiki.portaone.com/x/xKx8EQ',
  },
  ev: {
    title: 'Govt removes taxes on electric and hybrid vehicles',
    publisher: 'AllAfrica',
    date: 'Mar 2026',
    url: 'https://allafrica.com/stories/202603160666.html',
  },
  strategy: {
    title: 'Malawi Revenue Authority launches five-year plan to modernise revenue administration',
    publisher: 'UNDP Malawi',
    date: 'Aug 2026',
    url: 'https://www.undp.org/malawi/news/malawi-revenue-authority-launches-five-year-plan-modernise-revenue-administration',
  },
  kalondola: {
    title: 'Two years of Kalondola: Malawi’s digital tax stamps',
    publisher: 'AllAfrica',
    date: 'Jul 2026',
    url: 'https://allafrica.com/stories/202607220359.html',
  },
  mraApp: {
    title: 'MRA Mobile App (App Store listing)',
    publisher: 'Malawi Revenue Authority',
    date: '2024–2026',
    url: 'https://apps.apple.com/eg/app/mra-mobile-app/id6504921130',
  },
  mpamba: {
    title: 'TNM Mpamba partners MRA for electronic tax payment',
    publisher: 'Nyasa Times',
    date: 'undated',
    url: 'https://nyasatimes.com/tnm-mpamba-partners-mra-for-electronic-tax-payment',
  },
  airtel: {
    title: 'Tax payments now possible with Airtel Money, says MRA',
    publisher: 'Nyasa Times',
    date: '2020',
    url: 'https://www.nyasatimes.com/?p=187695',
  },
} as const;

// ---------------------------------------------------------------- PAYE

export type Band = { upTo: number; rate: number };

/** Monthly PAYE bands, in force from 31 December 2025. */
export const PAYE_BANDS_MONTHLY: readonly Band[] = [
  { upTo: 170_000, rate: 0 },
  { upTo: 1_570_000, rate: 0.3 },
  { upTo: 10_000_000, rate: 0.35 },
  { upTo: Infinity, rate: 0.4 },
];
export const PAYE_EFFECTIVE = '2025-12-31';

/** National Pension Scheme minimums, as a share of pensionable pay. */
export const PENSION_EMPLOYEE = 0.05;
export const PENSION_EMPLOYER = 0.1;

// ---------------------------------------------------------------- VAT

export const VAT_RATE = 0.175;
export const VAT_OLD_RATE = 0.165;
export const VAT_EFFECTIVE = '2025-12-31';
/** Annual turnover at which registering for VAT becomes compulsory. */
export const VAT_THRESHOLD = 50_000_000;
export const VAT_THRESHOLD_EFFECTIVE = '2026-04-15';

// ---------------------------------------------------------------- Withholding tax

export type WhtId =
  | 'services'
  | 'fees'
  | 'commission'
  | 'rent'
  | 'royalties'
  | 'interest'
  | 'entertainment'
  | 'supplies'
  | 'construction'
  | 'haulage'
  | 'produce'
  | 'casual'
  | 'dividends'
  | 'winnings'
  | 'nonResident';

export type WhtRate = {
  id: WhtId;
  rate: number;
  /** Payments up to this amount are not taxed. */
  exemptUpTo?: number;
  /** The tax withheld is final: the payee owes nothing more on this income. */
  final?: boolean;
  confidence: Confidence;
};

export const WHT_RATES: readonly WhtRate[] = [
  { id: 'services', rate: 0.2, confidence: 'reported' },
  { id: 'fees', rate: 0.2, confidence: 'reported' },
  { id: 'commission', rate: 0.2, confidence: 'reported' },
  { id: 'rent', rate: 0.2, confidence: 'reported' },
  { id: 'royalties', rate: 0.2, confidence: 'reported' },
  { id: 'interest', rate: 0.2, confidence: 'reported' },
  { id: 'entertainment', rate: 0.2, confidence: 'reported' },
  { id: 'supplies', rate: 0.03, confidence: 'reported' },
  { id: 'construction', rate: 0.04, confidence: 'reported' },
  { id: 'haulage', rate: 0.1, confidence: 'reported' },
  { id: 'produce', rate: 0.03, confidence: 'reported' },
  { id: 'casual', rate: 0.2, exemptUpTo: 35_000, confidence: 'older' },
  { id: 'dividends', rate: 0.1, final: true, confidence: 'reported' },
  { id: 'winnings', rate: 0.15, final: true, confidence: 'official' },
  { id: 'nonResident', rate: 0.15, final: true, confidence: 'reported' },
];

// ---------------------------------------------------------------- Presumptive tax

/** Small businesses below this annual turnover may pay presumptive tax. */
export const PRESUMPTIVE_CEILING = 12_500_000;

/** Annual presumptive tax by turnover band (paid in four quarterly parts). */
export const PRESUMPTIVE_BANDS: readonly { upTo: number; annualTax: number }[] = [
  { upTo: 4_000_000, annualTax: 0 },
  { upTo: 7_000_000, annualTax: 110_000 },
  { upTo: 10_000_000, annualTax: 170_000 },
  { upTo: PRESUMPTIVE_CEILING, annualTax: 225_000 },
];

// ---------------------------------------------------------------- Other

export const FBT_RATE = 0.3;
export const CORPORATE_TAX_RATE = 0.3;
/** Minimum alternative tax: share of turnover, for companies above the turnover below. */
export const MIN_ALT_TAX_RATE = 0.005;
export const MIN_ALT_TAX_TURNOVER = 5_000_000_000;

/** Levies from January 2026, paid by the sender. */
export const LEVY_RATE = 0.0005;
/** Mobile money transfers up to this amount carry no levy. */
export const MOBILE_LEVY_FREE_UP_TO = 100_000;

// ---------------------------------------------------------------- What the About screen lists

export type RateFact = {
  /** i18n key of the label */
  label: string;
  value: string;
  effective?: string;
  confidence: Confidence;
  sources: SourceId[];
};

export const RATE_FACTS: readonly RateFact[] = [
  { label: 'facts.paye', value: '0% ≤ K170,000 · 30% ≤ K1.57m · 35% ≤ K10m · 40% above', effective: PAYE_EFFECTIVE, confidence: 'official', sources: ['mraNotice'] },
  { label: 'facts.vat', value: '17.5%', effective: VAT_EFFECTIVE, confidence: 'official', sources: ['mraNotice', 'vat175'] },
  { label: 'facts.vatThreshold', value: 'K50,000,000 a year', effective: VAT_THRESHOLD_EFFECTIVE, confidence: 'reported', sources: ['budget2026', 'digitalVat'] },
  { label: 'facts.winnings', value: '15%, no tax-free amount', effective: PAYE_EFFECTIVE, confidence: 'official', sources: ['mraNotice'] },
  { label: 'facts.minAlt', value: '0.5% of turnover above K5 billion', effective: PAYE_EFFECTIVE, confidence: 'official', sources: ['mraNotice'] },
  { label: 'facts.wht', value: '3% to 20% by type of payment', confidence: 'reported', sources: ['mraWht', 'pwcWht'] },
  { label: 'facts.presumptive', value: 'K0 to K225,000 a year, below K12.5m turnover', confidence: 'older', sources: ['pwcOther', 'lloyds'] },
  { label: 'facts.fbt', value: '30%, paid quarterly', confidence: 'reported', sources: ['pwcOther'] },
  { label: 'facts.levy', value: '0.05% (mobile money: above K100,000)', effective: '2026-01-01', confidence: 'reported', sources: ['levies', 'levyNews'] },
  { label: 'facts.deadlines', value: 'PAYE & WHT 14th · VAT 25th · provisional 25th · presumptive 20th', confidence: 'reported', sources: ['pwcAdmin', 'grantThornton', 'pwcOther'] },
];
