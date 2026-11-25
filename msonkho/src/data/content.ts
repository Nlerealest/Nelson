// Plain-language guides, written from the research in RESEARCH.md. Titles and
// summaries are in English and Chichewa; the full text is in English for now.

import type { IconName } from '../components/ui.tsx';
import type { Tone } from '../theme.ts';
import type { SourceId } from './rates.ts';

export type Section = { heading?: string; body?: string; bullets?: string[] };

export type Article = {
  id: string;
  icon: IconName;
  tone: Tone;
  title: { en: string; ny: string };
  summary: { en: string; ny: string };
  sections: Section[];
  /** A calculator or screen to open from the article. */
  related?: string;
  sources: SourceId[];
};

export const ARTICLES: Article[] = [
  {
    id: 'changes-2026',
    icon: 'sparkles',
    tone: 'primary',
    title: { en: 'What changed in 2026', ny: 'Zomwe zasintha mu 2026' },
    summary: {
      en: 'VAT, PAYE, the VAT threshold, EIS receipts, winnings and transfer levies.',
      ny: 'VAT, PAYE, malire a VAT, malisiti a EIS, zopambana ndi levy pa kutumiza ndalama.',
    },
    sections: [
      {
        heading: 'From 31 December 2025',
        bullets: [
          'VAT went up from 16.5% to 17.5%.',
          'New PAYE bands: the first K170,000 a month is tax-free (up from K150,000), the 25% band was removed, income up to K1,570,000 is taxed at 30%, up to K10,000,000 at 35%, and above that at 40%.',
          'All betting, gaming and lottery winnings are taxed at 15%, with no tax-free amount.',
          'Companies with turnover above K5 billion pay a minimum alternative tax of 0.5% of turnover.',
        ],
      },
      {
        heading: 'From January 2026',
        bullets: [
          'A levy of 0.05% applies to bank transfers, and to mobile money transfers above K100,000. The sender pays it.',
          'MRA stepped up collection of tax on residential rental income in the cities.',
        ],
      },
      {
        heading: 'From April and May 2026',
        bullets: [
          'The VAT registration threshold doubled to K50 million a year (15 April 2026).',
          'Foreign companies selling digital services to Malawians must register for VAT, whatever their sales.',
          'Electric vehicles are free of import duty and excise duty (2026/27 budget).',
          'From 1 May 2026, VAT-registered businesses must issue receipts through MRA’s Electronic Invoicing System (EIS). Receipts from old fiscal devices no longer support input VAT claims.',
        ],
      },
    ],
    related: '/tools/vat',
    sources: ['mraNotice', 'vat175', 'budget2026', 'digitalVat', 'levies', 'eis', 'ev'],
  },
  {
    id: 'paye',
    icon: 'briefcase',
    tone: 'info',
    title: { en: 'PAYE: tax on your salary', ny: 'PAYE: msonkho pa malipiro anu' },
    summary: {
      en: 'How the bands work, with an example, and what to check on your payslip.',
      ny: 'Momwe magawo amagwirira ntchito, chitsanzo, ndi zoyenera kuona pa payslip yanu.',
    },
    sections: [
      {
        body: 'Pay As You Earn (PAYE) is income tax taken from your salary by your employer, who pays it to MRA by the 14th of the following month. Each part of your pay is taxed at the rate for its band, so a pay rise never leaves you with less.',
      },
      {
        heading: 'Monthly bands from 31 December 2025',
        bullets: ['First K170,000: 0%', 'K170,001 to K1,570,000: 30%', 'K1,570,001 to K10,000,000: 35%', 'Above K10,000,000: 40%'],
      },
      {
        heading: 'Example',
        body: 'On K500,000 a month, the first K170,000 is tax-free and the remaining K330,000 is taxed at 30%: PAYE is K99,000 and take-home pay K401,000 (before any pension).',
      },
      {
        heading: 'On your payslip',
        bullets: [
          'Check that PAYE matches the calculator for your gross pay.',
          'Pension contributions (at least 5% from you and 10% from your employer under the National Pension Scheme) are shown separately.',
          'Benefits such as a company car or housing are taxed on your employer through fringe benefits tax, not through your PAYE.',
        ],
      },
    ],
    related: '/tools/paye',
    sources: ['mraNotice', 'pwcOther'],
  },
  {
    id: 'vat',
    icon: 'pricetag',
    tone: 'orange',
    title: { en: 'VAT for buyers and sellers', ny: 'VAT kwa ogula ndi ogulitsa' },
    summary: {
      en: 'The 17.5% rate, who must register, returns and input VAT.',
      ny: 'Mlingo wa 17.5%, oyenera kulembetsa, ma return ndi input VAT.',
    },
    sections: [
      {
        body: 'Value Added Tax (VAT) is charged at 17.5% on most goods and services. Businesses collect it from customers and pay it to MRA, after deducting the VAT they paid on their own business purchases (input VAT).',
      },
      {
        heading: 'Who must register',
        bullets: [
          'Any business whose sales reach K50 million in 12 months (from 15 April 2026; it was K25 million).',
          'Smaller businesses may register voluntarily.',
          'Foreign digital service providers selling to Malawi, whatever their sales.',
        ],
      },
      {
        heading: 'Returns and payment',
        bullets: [
          'File the VAT return and pay by the 25th of the month after each month.',
          'Late payment can bring a penalty and interest.',
          'Only EIS invoices support input VAT claims since 1 May 2026.',
        ],
      },
      {
        heading: 'Working it out',
        body: 'To add VAT, multiply the price before VAT by 0.175. To find the VAT inside a price that includes it, multiply by 17.5 and divide by 117.5. K117,500 includes K17,500 VAT.',
      },
    ],
    related: '/tools/vat',
    sources: ['mraNotice', 'vat175', 'budget2026', 'grantThornton'],
  },
  {
    id: 'eis',
    icon: 'qr-code',
    tone: 'purple',
    title: { en: 'EIS receipts and how to check them', ny: 'Malisiti a EIS ndi momwe mungawatsimikizire' },
    summary: {
      en: 'Why every VAT receipt now has a QR code, and what to look for.',
      ny: 'Chifukwa chake lisiti iliyonse ya VAT ili ndi QR code, ndi zoyenera kuyang’ana.',
    },
    sections: [
      {
        body: 'MRA’s Electronic Invoicing System (EIS) replaced the old Electronic Fiscal Devices. Each sale is sent to MRA, which validates it and returns a unique number and a QR code that is printed on the receipt. It became compulsory for VAT-registered businesses on 1 May 2026.',
      },
      {
        heading: 'Checking a receipt',
        bullets: [
          'Scan the QR code with Msonkho Pocket. A genuine code opens a page on mra.mw (for example eservices.mra.mw).',
          'Compare the seller, date and amount on MRA’s page with the paper receipt.',
          'Be wary of a receipt with no QR code from a VAT-registered seller, or a code that opens any other website.',
          'Receipts issued offline carry a code too; they are sent to MRA once the device reconnects.',
        ],
      },
      {
        heading: 'For businesses',
        body: 'MRA offers free tools for small businesses to issue EIS receipts. Input VAT can only be claimed on EIS invoices.',
      },
    ],
    related: '/scan',
    sources: ['eis', 'eisUrl'],
  },
  {
    id: 'wht',
    icon: 'cut',
    tone: 'info',
    title: { en: 'Withholding tax', ny: 'Withholding tax' },
    summary: {
      en: 'When to withhold tax from a payment, the rates, and paying it over.',
      ny: 'Nthawi yodula msonkho pa malipiro, mitengo yake, ndi kuupereka ku MRA.',
    },
    sections: [
      {
        body: 'When a business pays for certain things (services, rent, commission, supplies and more), it keeps back part of the payment as tax and pays it to MRA for the supplier. The supplier can usually set it against their own income tax.',
      },
      {
        heading: 'Common rates',
        bullets: [
          'Services, fees, commission, rent, royalties, interest, public entertainment: 20%',
          'Carriage and haulage: 10%',
          'Building and construction contractors: 4%',
          'Supplies to traders and institutions; tobacco and farm produce: 3%',
          'Dividends: 10% (final)',
          'Winnings: 15% (final, no tax-free amount)',
          'Payments to non-residents: 15% (final)',
        ],
      },
      {
        heading: 'Paying it over',
        body: 'Pay the tax withheld to MRA by the 14th of the following month and give the supplier a withholding tax certificate. A supplier with a valid exemption certificate should not have tax withheld.',
      },
    ],
    related: '/tools/wht',
    sources: ['mraWht', 'pwcWht', 'mraNotice'],
  },
  {
    id: 'presumptive',
    icon: 'storefront',
    tone: 'primary',
    title: { en: 'Presumptive tax for small businesses', ny: 'Presumptive tax ya mabizinesi ang’onoang’ono' },
    summary: {
      en: 'A simple fixed tax for businesses with sales under K12.5 million.',
      ny: 'Msonkho wosavuta wa mabizinesi okhala ndi malonda osakwana K12.5 miliyoni.',
    },
    sections: [
      {
        body: 'Instead of working out profit, a small business with sales below K12.5 million a year can pay a fixed amount based on its sales. It is paid in four parts, by the 20th of the month after each quarter.',
      },
      {
        heading: 'Bands (latest published table)',
        bullets: ['Up to K4 million: no tax', 'K4 million to K7 million: K110,000 a year', 'K7 million to K10 million: K170,000 a year', 'K10 million to K12.5 million: K225,000 a year'],
      },
      {
        heading: 'Good to know',
        bullets: [
          'Rental income, professional and management fees, and companies are not covered.',
          'Keep a record of sales: the Sales record in this app adds them up for you.',
          'Once sales pass K12.5 million, normal income tax applies; at K50 million, VAT registration is compulsory.',
        ],
      },
    ],
    related: '/tools/presumptive',
    sources: ['pwcOther', 'lloyds'],
  },
  {
    id: 'tpin',
    icon: 'id-card',
    tone: 'purple',
    title: { en: 'Your TPIN', ny: 'TPIN yanu' },
    summary: {
      en: 'The taxpayer number you need for a job, a business or imports.',
      ny: 'Nambala ya okhometsa msonkho yofunika pa ntchito, bizinesi kapena katundu.',
    },
    sections: [
      {
        body: 'A Taxpayer Identification Number (TPIN) identifies you in all dealings with MRA. Employees, businesses and importers need one. Businesses register for a TPIN after registering with the Registrar General.',
      },
      {
        heading: 'Using it safely',
        bullets: [
          'Use your TPIN on returns, payments and letters to MRA.',
          'Your TPIN is not a password. Your Msonkho Online password is private: MRA will never ask for it by SMS, WhatsApp or phone.',
          'Ask MRA (call 672 or visit an office) if you are not sure whether you are registered.',
        ],
      },
    ],
    related: '/help',
    sources: ['strategy'],
  },
  {
    id: 'paying',
    icon: 'card',
    tone: 'primary',
    title: { en: 'Paying tax with a PRN', ny: 'Kulipira msonkho ndi PRN' },
    summary: {
      en: 'Banks, Airtel Money and TNM Mpamba, step by step.',
      ny: 'Mabanki, Airtel Money ndi TNM Mpamba, gawo ndi gawo.',
    },
    sections: [
      {
        body: 'Every payment to MRA uses a Payment Registration Number (PRN), created in Msonkho Online or at an MRA office. The PRN tells MRA which tax and period you are paying.',
      },
      {
        heading: 'Channels',
        bullets: [
          'Airtel Money: dial *211#, choose payments, pick MRA, enter the PRN and amount.',
          'TNM Mpamba: dial *444#, choose payments, then government payments and MRA tax, enter the PRN.',
          'Banks: at the counter or by internet banking, with the PRN as the reference.',
        ],
      },
      { heading: 'Stay safe', body: 'Never pay tax into a personal mobile money number. Keep the confirmation SMS or slip as proof.' },
    ],
    related: '/pay',
    sources: ['mpamba', 'airtel'],
  },
  {
    id: 'kalondola',
    icon: 'shield-checkmark',
    tone: 'orange',
    title: { en: 'Kalondola tax stamps', ny: 'Zidindo za msonkho za Kalondola' },
    summary: {
      en: 'The digital stamps on drinks, cigarettes and other excise goods.',
      ny: 'Zidindo za digito pa zakumwa, ndudu ndi katundu wina wa excise.',
    },
    sections: [
      {
        body: 'Since May 2024, MRA’s Kalondola system puts secure digital tax stamps on excise goods such as cigarettes, alcoholic drinks, soft drinks, bottled water and some personal care products. The stamps show that excise duty has been paid and help keep smuggled and fake goods off the shelves.',
      },
      {
        heading: 'What you can do',
        bullets: [
          'Look for the stamp on the bottle, can or pack before you buy.',
          'Check a stamp with the verification app that MRA recommends for Kalondola stamps.',
          'Report products sold without a stamp: call 672.',
        ],
      },
    ],
    related: '/help',
    sources: ['kalondola'],
  },
  {
    id: 'imports',
    icon: 'boat',
    tone: 'info',
    title: { en: 'Importing goods and vehicles', ny: 'Kubweretsa katundu ndi magalimoto' },
    summary: {
      en: 'How duty, excise and import VAT add up.',
      ny: 'Momwe duty, excise ndi VAT ya katundu zimawonjezerana.',
    },
    sections: [
      {
        body: 'Taxes on imports are worked out on the CIF value: the cost of the goods plus insurance and freight to Malawi. Customs duty is charged on that value, excise duty (on goods such as vehicles) on the value plus duty, and import VAT of 17.5% on the value plus duty plus excise.',
      },
      {
        heading: 'Vehicles',
        bullets: [
          'Duty and excise depend on the vehicle type, engine size and age.',
          'Electric vehicles are exempt from duty and excise under the 2026/27 budget.',
          'Clearing agent, port and registration costs come on top of the taxes.',
          'The official MRA Mobile App has a duty calculator and lets you track customs clearance.',
        ],
      },
    ],
    related: '/tools/imports',
    sources: ['ev', 'mraApp'],
  },
  {
    id: 'scams',
    icon: 'warning',
    tone: 'danger',
    title: { en: 'Staying safe from tax scams', ny: 'Kudziteteza ku chinyengo cha msonkho' },
    summary: {
      en: 'Fake refunds, fake receipts and links that pretend to be MRA.',
      ny: 'Ma refund abodza, malisiti abodza ndi ma link onamizira kuti ndi a MRA.',
    },
    sections: [
      {
        bullets: [
          'MRA will never ask for your password or PIN by SMS, WhatsApp or phone.',
          'MRA websites end in .mra.mw. Addresses like mra.mw.something.com or mra-refunds.co are fakes.',
          'Pay only with a PRN, through a bank or your mobile money menu, never to a personal number.',
          'A refund you did not apply for is almost always a scam.',
          'Check links and receipts with Scan before you trust them, and report scams to 672.',
        ],
      },
    ],
    related: '/scan',
    sources: ['eisUrl'],
  },
  {
    id: 'digital-mra',
    icon: 'phone-portrait',
    tone: 'primary',
    title: { en: 'MRA’s digital services', ny: 'Ntchito za digito za MRA' },
    summary: {
      en: 'Msonkho Online, EIS, Kalondola, the MRA Mobile App and MRA’s 2026–2031 plan.',
      ny: 'Msonkho Online, EIS, Kalondola, MRA Mobile App ndi dongosolo la MRA la 2026–2031.',
    },
    sections: [
      {
        body: 'In August 2026 MRA launched its Corporate Strategic Plan for 2026–2031, themed on digital transformation for revenue growth and efficient service. It rests on three pillars: sustainable revenue mobilisation, digital transformation, and people and institutional culture.',
      },
      {
        heading: 'Services you can use today',
        bullets: [
          'Msonkho Online: register, file returns, get a PRN and view your account.',
          'Electronic Invoicing System (EIS): real-time validated receipts with QR codes.',
          'Kalondola: digital tax stamps on excise goods.',
          'MRA Mobile App: PAYE and duty calculators, customs clearance tracking and document verification.',
          'Call centre: 672, toll-free.',
        ],
      },
    ],
    related: '/about',
    sources: ['strategy', 'mraApp', 'eis', 'kalondola'],
  },
];

export function findArticle(id: string): Article | undefined {
  return ARTICLES.find((a) => a.id === id);
}

export const OFFICES: { label: 'help.south' | 'help.central' | 'help.north'; place: string; query: string }[] = [
  { label: 'help.south', place: 'Msonkho House, Independence Drive, Blantyre', query: 'Malawi Revenue Authority Msonkho House Blantyre' },
  { label: 'help.central', place: 'Msonkho House, Lilongwe', query: 'Malawi Revenue Authority Msonkho House Lilongwe' },
  { label: 'help.north', place: 'Mpico House, Mzuzu', query: 'Malawi Revenue Authority Mzuzu' },
];

export const MRA = {
  callCentre: '672',
  email: 'callcentre@mra.mw',
  website: 'https://www.mra.mw',
};

/** A real-format MRA verification link and a typical scam SMS, for the demo buttons. */
export const DEMO_LINKS = {
  genuine: 'https://eservices.mra.mw/doc/v/?vc=90241313200014&c=fdd8d5ccc06a49d6a1efbf7e3896f0b4',
  fake: 'MRA NOTICE: You have an unclaimed tax refund of K85,000. Verify your TPIN and PIN today at https://mra.mw.refund-verify.com/claim',
};
