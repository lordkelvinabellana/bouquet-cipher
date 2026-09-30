import { describe, expect, it } from "vitest";
import { dayIn, daysBetween, isMonthsary, monthsaryOf, monthsBetween, ordinal, parseDay, yearsAndMonths } from "@/core/together";

const d = (s: string) => parseDay(s)!;

describe("months together", () => {
  it("counts whole months, turning over on the monthsary", () => {
    const since = d("2026-09-09");
    expect(monthsBetween(since, d("2026-09-09"))).toBe(0);
    expect(monthsBetween(since, d("2026-10-08"))).toBe(0);
    expect(monthsBetween(since, d("2026-10-09"))).toBe(1);
    expect(monthsBetween(since, d("2027-09-09"))).toBe(12);
    expect(monthsBetween(since, d("2026-09-01"))).toBe(-1);
  });

  it("falls on the month's last day when the month is shorter", () => {
    const since = d("2026-01-31");
    expect(isMonthsary(since, d("2026-02-28"))).toBe(true);
    expect(monthsBetween(since, d("2026-02-28"))).toBe(1);
    expect(isMonthsary(since, d("2026-04-30"))).toBe(true);
    expect(isMonthsary(since, d("2026-03-30"))).toBe(false);
    expect(isMonthsary(since, d("2026-03-31"))).toBe(true);
  });

  it("isn't a monthsary on the day you got together", () => {
    expect(isMonthsary(d("2026-09-09"), d("2026-09-09"))).toBe(false);
    expect(isMonthsary(d("2026-09-09"), d("2026-10-09"))).toBe(true);
  });

  it("makes October 9, 2026 the 50th monthsary of August 9, 2022", () => {
    const since = d("2022-08-09");
    expect(monthsBetween(since, d("2026-10-09"))).toBe(50);
    expect(isMonthsary(since, d("2026-10-09"))).toBe(true);
    expect(monthsBetween(since, d("2026-10-08"))).toBe(49);
    expect(yearsAndMonths(50)).toBe("4 years, 2 months");
    expect(yearsAndMonths(48)).toBe("4 years");
    expect(yearsAndMonths(12)).toBe("1 year");
    expect(yearsAndMonths(7)).toBe("7 months");
    expect(yearsAndMonths(13)).toBe("1 year, 1 month");
  });

  it("dates every monthsary, the short months included", () => {
    expect(monthsaryOf(d("2022-08-09"), 50)).toEqual(d("2026-10-09"));
    expect(monthsaryOf(d("2022-08-09"), 0)).toEqual(d("2022-08-09"));
    expect(monthsaryOf(d("2022-08-09"), 5)).toEqual(d("2023-01-09"));
    expect(monthsaryOf(d("2026-01-31"), 1)).toEqual(d("2026-02-28"));
  });

  it("counts days across months and years", () => {
    expect(daysBetween(d("2026-09-09"), d("2026-10-01"))).toBe(22);
    expect(daysBetween(d("2026-12-31"), d("2027-01-01"))).toBe(1);
  });

  it("reads days and ordinals", () => {
    expect(parseDay("2026-02-30")).toBeNull();
    expect(parseDay("nope")).toBeNull();
    expect(["1", "2", "3", "4", "11", "12", "13", "21", "22", "101"].map((n) => ordinal(+n))).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd", "101st",
    ]);
    // 2026-10-08 16:30 UTC is already the 9th in Manila
    expect(dayIn("Asia/Manila", new Date("2026-10-08T16:30:00Z"))).toEqual({ y: 2026, m: 10, d: 9 });
  });
});
