import {
  differenceInCalendarDays,
  startOfDay,
  intervalToDuration,
  endOfMonth,
  endOfQuarter,
  endOfYear,
  parseISO,
  format,
} from "date-fns";
import type { RollingRule } from "@/lib/types/database";

/**
 * Parses a Postgres `date` column value ("YYYY-MM-DD", no time/zone) as a
 * *local* calendar date. `new Date("2026-12-15")` is NOT safe for this —
 * the JS spec parses bare date strings as UTC midnight, which silently
 * shifts to the previous day in any negative UTC-offset timezone (all of
 * the Americas). `parseISO` treats it as local midnight instead, which is
 * what "the I-20 program ends on Dec 15" actually means for the user.
 */
export function parseDateOnly(dateString: string): Date {
  return parseISO(dateString);
}

/**
 * Calendar-day difference between a target date and "today" — never raw
 * millisecond division. `differenceInCalendarDays` compares calendar dates
 * after normalizing to local midnight, so it's correct across leap years,
 * DST transitions, and month/year boundaries (a DST-shifted day is still
 * "1 day" apart, not 0.958 or 1.042).
 */
export function getDaysRemaining(targetDate: Date, today: Date = new Date()): number {
  return differenceInCalendarDays(startOfDay(targetDate), startOfDay(today));
}

export interface CountdownLabel {
  /** Short primary label: "Today", "Tomorrow", "127 days remaining", "8 days overdue". */
  primary: string;
  /** Longer form where useful for far-out dates: "2 months, 4 days remaining". Null when not useful (near dates, or overdue). */
  extended: string | null;
  isOverdue: boolean;
  isToday: boolean;
}

/** Below this many days out, a bare day count is already easy to scan — a months/days breakdown adds noise instead of clarity. */
const EXTENDED_LABEL_MIN_DAYS = 60;

export function getCountdownLabel(targetDate: Date, today: Date = new Date()): CountdownLabel {
  const days = getDaysRemaining(targetDate, today);

  if (days === 0) {
    return { primary: "Today", extended: null, isOverdue: false, isToday: true };
  }
  if (days === 1) {
    return { primary: "Tomorrow", extended: null, isOverdue: false, isToday: false };
  }
  if (days < 0) {
    const overdueDays = Math.abs(days);
    return {
      primary: `${overdueDays} day${overdueDays === 1 ? "" : "s"} overdue`,
      extended: null,
      isOverdue: true,
      isToday: false,
    };
  }

  const primary = `${days} days remaining`;
  let extended: string | null = null;
  if (days >= EXTENDED_LABEL_MIN_DAYS) {
    const duration = intervalToDuration({ start: startOfDay(today), end: startOfDay(targetDate) });
    const months = (duration.years ?? 0) * 12 + (duration.months ?? 0);
    const remainingDays = duration.days ?? 0;
    if (months > 0) {
      extended = `${months} month${months === 1 ? "" : "s"}${
        remainingDays > 0 ? `, ${remainingDays} day${remainingDays === 1 ? "" : "s"}` : ""
      } remaining`;
    }
  }

  return { primary, extended, isOverdue: false, isToday: false };
}

/**
 * Percent of the window between `startDate` and `targetDate` that has
 * elapsed as of `today`, clamped to [0, 100]. Used for the card's subtle
 * progress indicator — not a legal or academic-progress measurement, just
 * a visual sense of "how far along is this window."
 */
export function getProgressPercent(startDate: Date, targetDate: Date, today: Date = new Date()): number {
  const totalDays = differenceInCalendarDays(startOfDay(targetDate), startOfDay(startDate));
  if (totalDays <= 0) return 100;
  const elapsedDays = differenceInCalendarDays(startOfDay(today), startOfDay(startDate));
  const percent = (elapsedDays / totalDays) * 100;
  return Math.min(100, Math.max(0, Math.round(percent)));
}

export function resolveRollingTargetDate(rule: RollingRule, today: Date = new Date()): Date {
  switch (rule) {
    case "end_of_month":
      return endOfMonth(today);
    case "end_of_quarter":
      return endOfQuarter(today);
    case "end_of_year":
      return endOfYear(today);
  }
}

export function formatTargetDate(targetDate: Date): string {
  return format(targetDate, "MMM d, yyyy");
}
