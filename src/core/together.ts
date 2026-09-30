/**
 * Counting months together. Dates are plain "YYYY-MM-DD" days (in the garden's time zone),
 * so nothing here depends on the server's clock or zone.
 *
 * A monthsary falls on the same day of the month as the day you got together, or on the
 * month's last day when that month is shorter (together on the 31st: the 30th of April).
 */

export interface Day {
  y: number;
  m: number; // 1-12
  d: number;
}

export function parseDay(s: string): Day | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const day = { y: +m[1], m: +m[2], d: +m[3] };
  return day.m >= 1 && day.m <= 12 && day.d >= 1 && day.d <= daysIn(day.y, day.m) ? day : null;
}

export const daysIn = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The day of `month` that counts as the monthsary. */
const monthsaryDay = (since: Day, y: number, m: number) => Math.min(since.d, daysIn(y, m));

/** Whole months from `since` to `day` (0 before the first monthsary; negative before `since`). */
export function monthsBetween(since: Day, day: Day): number {
  let months = (day.y - since.y) * 12 + (day.m - since.m);
  if (day.d < monthsaryDay(since, day.y, day.m)) months -= 1;
  return months;
}

/** Days from `since` to `day`. */
export const daysBetween = (since: Day, day: Day) => Math.round((Date.UTC(day.y, day.m - 1, day.d) - Date.UTC(since.y, since.m - 1, since.d)) / 86_400_000);

export const isMonthsary = (since: Day, day: Day) => monthsBetween(since, day) > 0 && day.d === monthsaryDay(since, day.y, day.m);

/** "1st", "2nd", "3rd", "11th", "22nd" */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ?? "th"}`;
}

/** Today (or any moment) as a day in a time zone. */
export function dayIn(timeZone: string, at: Date): Day {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(at).split("-").map(Number);
  return { y, m, d };
}

/** "4 years, 2 months", "1 year", "7 months" */
export function yearsAndMonths(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const part = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;
  if (!y) return part(m, "month");
  return m ? `${part(y, "year")}, ${part(m, "month")}` : part(y, "year");
}

/** The day of the `n`th monthsary (n = 0 is the day itself). */
export function monthsaryOf(since: Day, n: number): Day {
  const total = since.m - 1 + n;
  const y = since.y + Math.floor(total / 12);
  const m = (total % 12 + 12) % 12 + 1;
  return { y, m, d: Math.min(since.d, daysIn(y, m)) };
}
