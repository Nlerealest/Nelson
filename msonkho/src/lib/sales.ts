// A small business's sales record: totals for this month, this quarter and the
// last 12 months, which drive the presumptive tax estimate and the VAT
// registration check.

import { addDays, parseKey } from './calendar.ts';

export type Sale = { id: string; date: string; amount: number; note?: string };

export type SalesSummary = {
  thisMonth: number;
  thisQuarter: number;
  last12Months: number;
  count: number;
  /** Totals for each of the last 6 months, oldest first: [YYYY-MM, total]. */
  byMonth: [string, number][];
};

const monthOf = (key: string) => key.slice(0, 7);

export function summariseSales(sales: readonly Sale[], todayKey: string): SalesSummary {
  const today = parseKey(todayKey);
  const quarterStartMonth = Math.floor((today.month - 1) / 3) * 3 + 1;
  const quarterStart = `${today.year}-${String(quarterStartMonth).padStart(2, '0')}-01`;
  const yearAgo = addDays(todayKey, -365);
  const thisMonthKey = monthOf(todayKey);

  const months: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.year, today.month - 1 - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  const byMonth = new Map<string, number>(months.map((m) => [m, 0]));

  let thisMonth = 0;
  let thisQuarter = 0;
  let last12Months = 0;
  for (const s of sales) {
    if (s.date > todayKey) continue;
    if (monthOf(s.date) === thisMonthKey) thisMonth += s.amount;
    if (s.date >= quarterStart) thisQuarter += s.amount;
    if (s.date > yearAgo) last12Months += s.amount;
    const m = monthOf(s.date);
    if (byMonth.has(m)) byMonth.set(m, (byMonth.get(m) ?? 0) + s.amount);
  }
  return { thisMonth, thisQuarter, last12Months, count: sales.length, byMonth: [...byMonth.entries()] };
}

/** Sample sales for the demo: a market stall turning over about K9.6m a year. */
export function sampleSales(todayKey: string): Sale[] {
  const out: Sale[] = [];
  const amounts = [612_000, 845_500, 790_000, 702_000, 955_000, 688_400, 910_000, 760_000, 830_250, 905_000, 640_000, 798_000];
  for (let i = 0; i < 12; i++) {
    const date = addDays(todayKey, -i * 30 - 2);
    out.push({ id: `sample-${i}`, date, amount: amounts[i], note: i === 0 ? 'Week’s takings' : undefined });
  }
  return out;
}
