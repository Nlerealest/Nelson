import { en } from './en.ts';
import type { TKey } from './en.ts';
import { ny } from './ny.ts';
import { parseKey, weekday } from '../lib/calendar.ts';
import type { PeriodRef } from '../lib/calendar.ts';

export type { TKey };
export type Lang = 'en' | 'ny';
export type Vars = Record<string, string | number>;
export type T = (key: TKey, vars?: Vars) => string;

export function translate(lang: Lang, key: TKey, vars?: Vars): string {
  const text = (lang === 'ny' ? ny[key] : undefined) ?? en[key] ?? key;
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) => (name in vars ? String(vars[name]) : whole));
}

/** For keys built at run time, such as `wht.${id}`. */
export function key(k: string): TKey {
  return k as TKey;
}

export function makeT(lang: Lang): T {
  return (k, vars) => translate(lang, k, vars);
}

// ---------------------------------------------------------------- Dates

/** "25 Nov" */
export function shortDate(t: T, dateKey: string): string {
  const { month, day } = parseKey(dateKey);
  return `${day} ${t(key(`mon.${month}`))}`;
}

/** "25 Nov 2026" */
export function mediumDate(t: T, dateKey: string): string {
  const { year } = parseKey(dateKey);
  return `${shortDate(t, dateKey)} ${year}`;
}

/** "Wednesday, 25 November 2026" */
export function longDate(t: T, dateKey: string): string {
  const { year, month, day } = parseKey(dateKey);
  return `${t(key(`day.${weekday(dateKey)}`))}, ${day} ${t(key(`month.${month}`))} ${year}`;
}

/** "October 2026" for a month; "31 Dec 2026" for the end of a quarter or year. */
export function periodLabel(t: T, period: PeriodRef): string {
  if (period.kind === 'month') return `${t(key(`month.${period.month}`))} ${period.year}`;
  const last = new Date(period.year, period.endMonth, 0).getDate();
  return `${last} ${t(key(`mon.${period.endMonth}`))} ${period.year}`;
}

/** "Today", "Tomorrow", "In 19 days", "2 days late" */
export function countdown(t: T, daysLeft: number): string {
  if (daysLeft === 0) return t('common.today');
  if (daysLeft === 1) return t('common.tomorrow');
  if (daysLeft > 1) return t('common.inDays', { n: daysLeft });
  if (daysLeft === -1) return t('common.dayLate');
  return t('common.daysLate', { n: -daysLeft });
}
