// The tax calculations. Pure functions with no React or device code, so they
// are easy to test and could be served from MRA's systems unchanged.

import {
  LEVY_RATE,
  MOBILE_LEVY_FREE_UP_TO,
  PAYE_BANDS_MONTHLY,
  PENSION_EMPLOYER,
  PRESUMPTIVE_BANDS,
  PRESUMPTIVE_CEILING,
  VAT_OLD_RATE,
  VAT_RATE,
  VAT_THRESHOLD,
  WHT_RATES,
} from '../data/rates.ts';
import type { Band, WhtId, WhtRate } from '../data/rates.ts';
import { roundMoney } from './format.ts';

// ---------------------------------------------------------------- PAYE

export type Period = 'month' | 'year';

export type BandLine = {
  from: number;
  to: number;
  rate: number;
  /** The part of the pay that falls in this band. */
  taxable: number;
  tax: number;
};

export type PayeResult = {
  period: Period;
  gross: number;
  paye: number;
  /** Employee pension contribution (not deductible for PAYE). */
  pension: number;
  net: number;
  /** PAYE as a share of gross pay. */
  effectiveRate: number;
  /** The rate on the next kwacha earned. */
  marginalRate: number;
  /** What the employer adds to the pension fund when a pension applies. */
  employerPension: number;
  lines: BandLine[];
};

function scaledBands(period: Period): Band[] {
  const factor = period === 'year' ? 12 : 1;
  return PAYE_BANDS_MONTHLY.map((b) => ({ upTo: b.upTo * factor, rate: b.rate }));
}

/** PAYE on pay for a month or a year, band by band. */
export function calcPaye(gross: number, period: Period = 'month', pensionRate = 0): PayeResult {
  const pay = Math.max(0, gross);
  const bands = scaledBands(period);
  const lines: BandLine[] = [];
  let from = 0;
  let paye = 0;
  let marginalRate = bands[0].rate;
  for (const band of bands) {
    const taxable = Math.max(0, Math.min(pay, band.upTo) - from);
    const tax = taxable * band.rate;
    lines.push({ from, to: band.upTo, rate: band.rate, taxable, tax: roundMoney(tax) });
    if (pay > from) marginalRate = band.rate;
    paye += tax;
    from = band.upTo;
  }
  paye = roundMoney(paye);
  const pension = roundMoney(pay * pensionRate);
  return {
    period,
    gross: pay,
    paye,
    pension,
    net: roundMoney(pay - paye - pension),
    effectiveRate: pay > 0 ? paye / pay : 0,
    marginalRate,
    employerPension: pensionRate > 0 ? roundMoney(pay * PENSION_EMPLOYER) : 0,
    lines,
  };
}

/**
 * The gross pay that leaves `net` after PAYE (and the employee pension, if
 * any). Useful when a salary is agreed as take-home pay.
 */
export function grossFromNet(net: number, period: Period = 'month', pensionRate = 0): PayeResult {
  const target = Math.max(0, net);
  // Take-home pay rises with gross pay (the top rate plus pension stays below
  // 100%), so a binary search finds the gross pay exactly.
  let lo = target;
  let hi = target / (1 - 0.4 - pensionRate) + 1;
  for (let i = 0; i < 100; i++) {
    const mid = (lo + hi) / 2;
    if (calcPaye(mid, period, pensionRate).net < target) lo = mid;
    else hi = mid;
  }
  // Round to the nearest tambala, then nudge up if rounding fell short.
  let gross = roundMoney(hi);
  while (calcPaye(gross, period, pensionRate).net < target) gross = roundMoney(gross + 0.01);
  return calcPaye(gross, period, pensionRate);
}

// ---------------------------------------------------------------- VAT

export type VatResult = { net: number; vat: number; gross: number; rate: number };

/** A price before VAT → the VAT to add and the price to charge. */
export function addVat(net: number, rate = VAT_RATE): VatResult {
  const vat = roundMoney(net * rate);
  return { net, vat, gross: roundMoney(net + vat), rate };
}

/** A price that already includes VAT → the VAT inside it. */
export function extractVat(gross: number, rate = VAT_RATE): VatResult {
  const vat = roundMoney((gross * rate) / (1 + rate));
  return { net: roundMoney(gross - vat), vat, gross, rate };
}

export type ReceiptCheck =
  | { status: 'ok'; expected: number; difference: number }
  | { status: 'oldRate'; expected: number; difference: number }
  | { status: 'noVat'; expected: number; difference: number }
  | { status: 'mismatch'; expected: number; difference: number };

/**
 * Checks the VAT printed on a receipt against its total. Spots receipts still
 * charging the old 16.5% rate, which ended on 31 December 2025.
 */
export function checkReceiptVat(total: number, vatShown: number): ReceiptCheck {
  const expected = extractVat(total).vat;
  const difference = roundMoney(vatShown - expected);
  // Allow for rounding on each line of a long receipt.
  const tolerance = Math.max(1, total * 0.0005);
  if (vatShown === 0) return { status: 'noVat', expected, difference };
  if (Math.abs(difference) <= tolerance) return { status: 'ok', expected, difference };
  const old = extractVat(total, VAT_OLD_RATE).vat;
  if (Math.abs(vatShown - old) <= tolerance) return { status: 'oldRate', expected, difference };
  return { status: 'mismatch', expected, difference };
}

export type VatRegistration = {
  turnover: number;
  threshold: number;
  mustRegister: boolean;
  /** turnover ÷ threshold, for a progress bar */
  share: number;
  remaining: number;
};

/** Is VAT registration compulsory at this turnover over 12 months? */
export function vatRegistration(turnover12m: number): VatRegistration {
  const turnover = Math.max(0, turnover12m);
  return {
    turnover,
    threshold: VAT_THRESHOLD,
    mustRegister: turnover >= VAT_THRESHOLD,
    share: turnover / VAT_THRESHOLD,
    remaining: Math.max(0, VAT_THRESHOLD - turnover),
  };
}

// ---------------------------------------------------------------- Withholding tax

export function whtRate(id: WhtId): WhtRate {
  const found = WHT_RATES.find((r) => r.id === id);
  if (!found) throw new Error(`Unknown withholding tax type: ${id}`);
  return found;
}

export type WhtResult = {
  type: WhtRate;
  amount: number;
  /** Whether tax applies to this payment at all (some small payments are exempt). */
  applies: boolean;
  wht: number;
  /** What the payee actually receives. */
  netToPayee: number;
};

/** The tax to withhold from a payment, and what the payee receives. */
export function calcWht(id: WhtId, amount: number): WhtResult {
  const type = whtRate(id);
  const pay = Math.max(0, amount);
  const applies = type.exemptUpTo === undefined || pay > type.exemptUpTo;
  const wht = applies ? roundMoney(pay * type.rate) : 0;
  return { type, amount: pay, applies, wht, netToPayee: roundMoney(pay - wht) };
}

// ---------------------------------------------------------------- Presumptive tax

export type PresumptiveResult =
  | { eligible: true; turnover: number; bandIndex: number; annualTax: number; quarterly: number }
  | { eligible: false; turnover: number; mustRegisterVat: boolean };

/** Presumptive tax for a small business, from its annual turnover. */
export function calcPresumptive(annualTurnover: number): PresumptiveResult {
  const turnover = Math.max(0, annualTurnover);
  if (turnover >= PRESUMPTIVE_CEILING) {
    return { eligible: false, turnover, mustRegisterVat: turnover >= VAT_THRESHOLD };
  }
  const bandIndex = PRESUMPTIVE_BANDS.findIndex((b) => turnover <= b.upTo);
  const annualTax = PRESUMPTIVE_BANDS[bandIndex].annualTax;
  return { eligible: true, turnover, bandIndex, annualTax, quarterly: roundMoney(annualTax / 4) };
}

// ---------------------------------------------------------------- Imports

export type ImportInput = { cif: number; dutyRate: number; exciseRate: number; vatRate?: number };

export type ImportResult = {
  cif: number;
  duty: number;
  excise: number;
  vat: number;
  /** All taxes paid at the border. */
  taxes: number;
  /** CIF value plus all taxes. */
  landed: number;
  vatRate: number;
};

/**
 * Taxes on an import: customs duty on the CIF value, excise on CIF plus duty,
 * and VAT on CIF plus duty plus excise. An estimate: MRA Customs assesses the
 * final amount from the tariff and the verified value.
 */
export function calcImport({ cif, dutyRate, exciseRate, vatRate = VAT_RATE }: ImportInput): ImportResult {
  const value = Math.max(0, cif);
  const duty = roundMoney(value * dutyRate);
  const excise = roundMoney((value + duty) * exciseRate);
  const vat = roundMoney((value + duty + excise) * vatRate);
  const taxes = roundMoney(duty + excise + vat);
  return { cif: value, duty, excise, vat, taxes, landed: roundMoney(value + taxes), vatRate };
}

// ---------------------------------------------------------------- Transfer levies

export type Channel = 'bank' | 'mobile';

/** The levy on a bank or mobile money transfer, paid by the sender. */
export function transferLevy(amount: number, channel: Channel): { levy: number; exempt: boolean } {
  const value = Math.max(0, amount);
  if (channel === 'mobile' && value <= MOBILE_LEVY_FREE_UP_TO) return { levy: 0, exempt: true };
  return { levy: roundMoney(value * LEVY_RATE), exempt: false };
}
