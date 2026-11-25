// Tax deadlines for the kinds of taxpayer someone says they are. Dates are
// handled as local "YYYY-MM-DD" keys so time zones never shift a deadline.

export type TaxpayerType = 'employee' | 'employer' | 'vat' | 'smallBusiness' | 'company' | 'importer';

export const TAXPAYER_TYPES: readonly TaxpayerType[] = ['employee', 'employer', 'vat', 'smallBusiness', 'company', 'importer'];

export type DeadlineId = 'payslip' | 'paye' | 'wht' | 'fbt' | 'vat' | 'presumptive' | 'provisional' | 'annualReturn';

/** The period a deadline is for. Months are 1–12. */
export type PeriodRef =
  | { kind: 'month'; year: number; month: number }
  | { kind: 'quarter'; year: number; endMonth: number }
  | { kind: 'year'; year: number; endMonth: number };

export type Deadline = {
  /** Unique per deadline and due date; used to mark it done. */
  key: string;
  id: DeadlineId;
  due: string;
  period: PeriodRef;
  /** Negative when the date has passed. */
  daysLeft: number;
  /** Shown for information only (someone else files it); never reminded. */
  informational: boolean;
};

type Rule = {
  id: DeadlineId;
  audience: readonly TaxpayerType[];
  informational?: boolean;
};

// Order matters: it breaks ties between deadlines on the same day.
const RULES: readonly Rule[] = [
  { id: 'vat', audience: ['vat'] },
  { id: 'paye', audience: ['employer'] },
  { id: 'wht', audience: ['employer', 'company', 'vat'] },
  { id: 'fbt', audience: ['employer'] },
  { id: 'presumptive', audience: ['smallBusiness'] },
  { id: 'provisional', audience: ['company'] },
  { id: 'annualReturn', audience: ['company'] },
  { id: 'payslip', audience: ['employee'], informational: true },
];

// ---------------------------------------------------------------- Date keys

const pad = (n: number) => String(n).padStart(2, '0');

/** A local date as "YYYY-MM-DD". Month and day may overflow; Date normalises them. */
export function ymd(year: number, month: number, day: number): string {
  const d = new Date(year, month - 1, day);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateKey(d: Date): string {
  return ymd(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

export function parseKey(key: string): { year: number; month: number; day: number } {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month, day };
}

export function addDays(key: string, days: number): string {
  const { year, month, day } = parseKey(key);
  return ymd(year, month, day + days);
}

/** Whole days from one date key to another. */
export function daysBetween(fromKey: string, toKey: string): number {
  const a = parseKey(fromKey);
  const b = parseKey(toKey);
  return Math.round((Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / 86_400_000);
}

/** The last day of a month, e.g. 30 for June. */
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(key: string): number {
  const { year, month, day } = parseKey(key);
  return new Date(year, month - 1, day).getDay();
}

// ---------------------------------------------------------------- Deadlines

function monthAfter(year: number, month: number): { year: number; month: number } {
  return month === 12 ? { year: year + 1, month: 1 } : { year, month: month + 1 };
}

/** The months in which a quarter ends, for a year ending in `yearEndMonth`. */
export function quarterEndMonths(yearEndMonth: number): number[] {
  return [9, 6, 3, 0].map((back) => ((yearEndMonth - back - 1 + 12) % 12) + 1);
}

/** Every deadline (of any kind) arising from the period that ends in this month. */
function deadlinesForPeriodEnding(id: DeadlineId, year: number, month: number, yearEndMonth: number): { due: string; period: PeriodRef }[] {
  const next = monthAfter(year, month);
  const isCalendarQuarterEnd = month % 3 === 0;
  switch (id) {
    case 'payslip':
    case 'paye':
    case 'wht':
      // Remit by the 14th of the following month.
      return [{ due: ymd(next.year, next.month, 14), period: { kind: 'month', year, month } }];
    case 'vat':
      // VAT return and payment by the 25th of the following month.
      return [{ due: ymd(next.year, next.month, 25), period: { kind: 'month', year, month } }];
    case 'fbt':
      // FBT quarters end in September, December, March and June; due 14 days later.
      return isCalendarQuarterEnd ? [{ due: ymd(next.year, next.month, 14), period: { kind: 'quarter', year, endMonth: month } }] : [];
    case 'presumptive':
      // Quarterly, by the 20th of the month after the quarter ends.
      return isCalendarQuarterEnd ? [{ due: ymd(next.year, next.month, 20), period: { kind: 'quarter', year, endMonth: month } }] : [];
    case 'provisional':
      // Quarterly instalments of the year's estimated tax, by the 25th of the following month.
      return quarterEndMonths(yearEndMonth).includes(month)
        ? [{ due: ymd(next.year, next.month, 25), period: { kind: 'quarter', year, endMonth: month } }]
        : [];
    case 'annualReturn':
      // The return and any balance are due within 180 days after the year ends.
      return month === yearEndMonth
        ? [{ due: addDays(ymd(year, month, lastDayOfMonth(year, month)), 180), period: { kind: 'year', year, endMonth: month } }]
        : [];
  }
}

export type DeadlineOptions = {
  /** How far ahead to look. */
  horizonDays?: number;
  /** How far back to keep deadlines that have passed (so they can be marked done). */
  pastDays?: number;
  /** The month the financial year ends; June by default. */
  yearEndMonth?: number;
};

/** All deadlines for these taxpayer types between `pastDays` ago and `horizonDays` ahead. */
export function deadlinesFor(types: readonly TaxpayerType[], todayKey: string, opts: DeadlineOptions = {}): Deadline[] {
  const { horizonDays = 120, pastDays = 31, yearEndMonth = 6 } = opts;
  const rules = RULES.filter((r) => r.audience.some((a) => types.includes(a)));
  const today = parseKey(todayKey);
  const out: Deadline[] = [];
  // A period ending up to ~8 months back can have a due date in the window
  // (the annual return comes 180 days after the year ends).
  const firstMonths = -8;
  const lastMonths = Math.ceil(horizonDays / 28) + 1;
  for (let offset = firstMonths; offset <= lastMonths; offset++) {
    const d = new Date(today.year, today.month - 1 + offset, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    for (const rule of rules) {
      for (const { due, period } of deadlinesForPeriodEnding(rule.id, year, month, yearEndMonth)) {
        const daysLeft = daysBetween(todayKey, due);
        if (daysLeft < -pastDays || daysLeft > horizonDays) continue;
        out.push({ key: `${rule.id}:${due}`, id: rule.id, due, period, daysLeft, informational: !!rule.informational });
      }
    }
  }
  const order = (id: DeadlineId) => RULES.findIndex((r) => r.id === id);
  return out.sort((a, b) => (a.due === b.due ? order(a.id) - order(b.id) : a.due < b.due ? -1 : 1));
}

/** Deadlines still to act on: not done, and either upcoming or overdue. */
export function openDeadlines(all: Deadline[], done: Readonly<Record<string, boolean>>): Deadline[] {
  return all.filter((d) => !done[d.key] && (d.daysLeft >= 0 || !d.informational));
}
