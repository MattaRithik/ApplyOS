import { describe, expect, it } from "vitest";
import {
  parseDateOnly,
  getDaysRemaining,
  getCountdownLabel,
  getProgressPercent,
  resolveRollingTargetDate,
} from "@/lib/utils/timeline-date";

describe("parseDateOnly", () => {
  it("parses a bare date string as local midnight, not UTC midnight", () => {
    const parsed = parseDateOnly("2026-12-15");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(11); // 0-indexed
    expect(parsed.getDate()).toBe(15);
  });

  it("round-trips a date at a DST transition boundary (US spring-forward)", () => {
    // 2026-03-08 is the US DST transition date.
    const parsed = parseDateOnly("2026-03-08");
    expect(parsed.getDate()).toBe(8);
  });
});

describe("getDaysRemaining", () => {
  it("returns a positive count for a future date", () => {
    const today = new Date(2026, 0, 1);
    const target = new Date(2026, 0, 31);
    expect(getDaysRemaining(target, today)).toBe(30);
  });

  it("returns 0 for today", () => {
    const today = new Date(2026, 5, 15);
    const target = new Date(2026, 5, 15);
    expect(getDaysRemaining(target, today)).toBe(0);
  });

  it("returns a negative count for a past date", () => {
    const today = new Date(2026, 5, 15);
    const target = new Date(2026, 5, 7);
    expect(getDaysRemaining(target, today)).toBe(-8);
  });

  it("is not affected by time-of-day — only calendar dates matter", () => {
    const today = new Date(2026, 5, 15, 23, 59, 0);
    const target = new Date(2026, 5, 16, 0, 1, 0);
    expect(getDaysRemaining(target, today)).toBe(1);
  });

  it("counts correctly across a leap-year February", () => {
    // 2028 is a leap year — Feb has 29 days.
    const today = new Date(2028, 1, 1); // Feb 1, 2028
    const target = new Date(2028, 2, 1); // Mar 1, 2028
    expect(getDaysRemaining(target, today)).toBe(29);
  });

  it("counts correctly across a non-leap-year February", () => {
    const today = new Date(2027, 1, 1); // Feb 1, 2027
    const target = new Date(2027, 2, 1); // Mar 1, 2027
    expect(getDaysRemaining(target, today)).toBe(28);
  });

  it("handles a DST spring-forward boundary without an off-by-one day", () => {
    // US clocks jump forward on 2026-03-08 — a naive ms-based diff would
    // undercount this span by an hour, which can round to the wrong day.
    const today = parseDateOnly("2026-03-01");
    const target = parseDateOnly("2026-03-15");
    expect(getDaysRemaining(target, today)).toBe(14);
  });
});

describe("getCountdownLabel", () => {
  it("labels today as 'Today'", () => {
    const d = new Date(2026, 5, 15);
    expect(getCountdownLabel(d, d)).toMatchObject({ primary: "Today", isToday: true, isOverdue: false });
  });

  it("labels tomorrow as 'Tomorrow'", () => {
    const today = new Date(2026, 5, 15);
    const target = new Date(2026, 5, 16);
    expect(getCountdownLabel(target, today).primary).toBe("Tomorrow");
  });

  it("labels a near future date with a plain day count", () => {
    const today = new Date(2026, 0, 1);
    const target = new Date(2026, 0, 15); // 14 days out
    const label = getCountdownLabel(target, today);
    expect(label.primary).toBe("14 days remaining");
    expect(label.extended).toBeNull();
  });

  it("labels an overdue date, matching the '8 days overdue' example", () => {
    const today = new Date(2026, 0, 9);
    const target = new Date(2026, 0, 1); // 8 days ago
    const label = getCountdownLabel(target, today);
    expect(label.primary).toBe("8 days overdue");
    expect(label.isOverdue).toBe(true);
  });

  it("labels a single day overdue in the singular", () => {
    const today = new Date(2026, 0, 2);
    const target = new Date(2026, 0, 1);
    expect(getCountdownLabel(target, today).primary).toBe("1 day overdue");
  });

  it("adds a months+days extended label for far-out dates", () => {
    const today = new Date(2026, 0, 1);
    const target = new Date(2026, 3, 5); // Jan 1 -> Apr 5 = 3 months, 4 days
    const label = getCountdownLabel(target, today);
    expect(label.primary).toBe("94 days remaining");
    expect(label.extended).toBe("3 months, 4 days remaining");
  });
});

describe("getProgressPercent", () => {
  it("is 0 at the start of the window", () => {
    const start = new Date(2026, 0, 1);
    const target = new Date(2026, 0, 31);
    expect(getProgressPercent(start, target, start)).toBe(0);
  });

  it("is 100 once the target date has arrived", () => {
    const start = new Date(2026, 0, 1);
    const target = new Date(2026, 0, 31);
    expect(getProgressPercent(start, target, target)).toBe(100);
  });

  it("is roughly halfway through a symmetric window", () => {
    const start = new Date(2026, 0, 1);
    const target = new Date(2026, 0, 21); // 20-day window
    const today = new Date(2026, 0, 11); // 10 days in
    expect(getProgressPercent(start, target, today)).toBe(50);
  });

  it("clamps to 100 for a target date already in the past", () => {
    const start = new Date(2026, 0, 1);
    const target = new Date(2026, 0, 10);
    const today = new Date(2026, 0, 20);
    expect(getProgressPercent(start, target, today)).toBe(100);
  });
});

describe("resolveRollingTargetDate", () => {
  it("resolves end_of_month to the last calendar day of the current month", () => {
    const today = new Date(2026, 1, 10); // Feb 10, 2026 (non-leap)
    const result = resolveRollingTargetDate("end_of_month", today);
    expect(result.getMonth()).toBe(1);
    expect(result.getDate()).toBe(28);
  });

  it("resolves end_of_month correctly in a leap-year February", () => {
    const today = new Date(2028, 1, 10);
    const result = resolveRollingTargetDate("end_of_month", today);
    expect(result.getDate()).toBe(29);
  });

  it("resolves end_of_quarter to the last day of the current quarter", () => {
    const today = new Date(2026, 3, 15); // Apr 15 -> Q2 ends Jun 30
    const result = resolveRollingTargetDate("end_of_quarter", today);
    expect(result.getMonth()).toBe(5);
    expect(result.getDate()).toBe(30);
  });

  it("resolves end_of_year to Dec 31 of the current year", () => {
    const today = new Date(2026, 6, 1);
    const result = resolveRollingTargetDate("end_of_year", today);
    expect(result.getMonth()).toBe(11);
    expect(result.getDate()).toBe(31);
  });
});
