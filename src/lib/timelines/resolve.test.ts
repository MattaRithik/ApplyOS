import { describe, expect, it } from "vitest";
import { resolveTimeline, isSystemTimelineAvailable } from "@/lib/timelines/resolve";
import { getDaysRemaining } from "@/lib/utils/timeline-date";
import type { InternationalStudentProfile, UserTimeline } from "@/lib/types/database";

function makeTimeline(overrides: Partial<UserTimeline>): UserTimeline {
  return {
    id: "t1",
    user_id: "u1",
    title: "Test timeline",
    description: null,
    icon: null,
    timeline_type: "custom",
    category: "other",
    target_date: null,
    rolling_rule: null,
    source: "user",
    is_system_generated: false,
    is_pinned: false,
    dashboard_slot: null,
    sort_order: 0,
    completed_at: null,
    archived_at: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeProfile(overrides: Partial<InternationalStudentProfile>): InternationalStudentProfile {
  return {
    id: "p1",
    user_id: "u1",
    visa_status: "f1",
    program_level: "masters",
    program_name: null,
    school_name: null,
    i20_program_end_date: null,
    expected_graduation_date: null,
    stem_designated_status: null,
    current_authorization_stage: null,
    sevis_id: null,
    opt_start_date: null,
    opt_end_date: null,
    ead_expiration_date: null,
    stem_opt_expiration_date: null,
    reminder_days_before: [],
    enabled: true,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("resolveTimeline — custom / fixed_date", () => {
  it("uses the stored target_date directly", () => {
    const timeline = makeTimeline({ timeline_type: "custom", target_date: "2026-08-01", title: "Career fair" });
    const resolved = resolveTimeline(timeline, null);
    expect(resolved.targetDate?.getFullYear()).toBe(2026);
    expect(resolved.targetDate?.getMonth()).toBe(7);
    expect(resolved.targetDate?.getDate()).toBe(1);
    expect(resolved.sourceLabel).toBe("Custom");
    expect(resolved.isMissingData).toBe(false);
  });

  it("flags missing data when target_date is null", () => {
    const timeline = makeTimeline({ timeline_type: "fixed_date", target_date: null });
    const resolved = resolveTimeline(timeline, null);
    expect(resolved.targetDate).toBeNull();
    expect(resolved.isMissingData).toBe(true);
  });
});

describe("resolveTimeline — graduation countdown", () => {
  it("resolves to the expected graduation date when present", () => {
    const timeline = makeTimeline({ timeline_type: "i20_program_end" });
    const profile = makeProfile({ expected_graduation_date: "2027-05-15" });
    const resolved = resolveTimeline(timeline, profile, new Date(2026, 0, 1));
    expect(resolved.isMissingData).toBe(false);
    expect(resolved.title).toBe("Expected Graduation");
    expect(resolved.sourceLabel).toBe("From your profile");
    expect(getDaysRemaining(resolved.targetDate!, new Date(2026, 0, 1))).toBeGreaterThan(0);
  });

  it("resolves a graduation date that is today", () => {
    const today = new Date(2026, 5, 1);
    const timeline = makeTimeline({ timeline_type: "i20_program_end" });
    const profile = makeProfile({ expected_graduation_date: "2026-06-01" });
    const resolved = resolveTimeline(timeline, profile, today);
    expect(getDaysRemaining(resolved.targetDate!, today)).toBe(0);
  });

  it("resolves a graduation date already in the past", () => {
    const today = new Date(2026, 5, 15);
    const timeline = makeTimeline({ timeline_type: "i20_program_end" });
    const profile = makeProfile({ expected_graduation_date: "2026-06-01" });
    const resolved = resolveTimeline(timeline, profile, today);
    expect(getDaysRemaining(resolved.targetDate!, today)).toBe(-14);
  });

  it("flags missing data when there is no international profile at all", () => {
    const timeline = makeTimeline({ timeline_type: "i20_program_end" });
    const resolved = resolveTimeline(timeline, null);
    expect(resolved.targetDate).toBeNull();
    expect(resolved.isMissingData).toBe(true);
  });

  it("flags missing data when the profile exists but has no graduation date", () => {
    const timeline = makeTimeline({ timeline_type: "i20_program_end" });
    const profile = makeProfile({ expected_graduation_date: null });
    const resolved = resolveTimeline(timeline, profile);
    expect(resolved.isMissingData).toBe(true);
  });

  it("handles a graduation date on Feb 29 of a leap year correctly", () => {
    const timeline = makeTimeline({ timeline_type: "i20_program_end" });
    const profile = makeProfile({ expected_graduation_date: "2028-02-29" });
    const resolved = resolveTimeline(timeline, profile, new Date(2028, 0, 1));
    expect(resolved.targetDate?.getMonth()).toBe(1);
    expect(resolved.targetDate?.getDate()).toBe(29);
  });
});

describe("resolveTimeline — opt_earliest_filing (90-day rule)", () => {
  it("is exactly 90 calendar days before the I-20 program end date", () => {
    const timeline = makeTimeline({ timeline_type: "opt_earliest_filing" });
    const profile = makeProfile({ i20_program_end_date: "2026-05-15" });
    const resolved = resolveTimeline(timeline, profile);
    // May 15 minus 90 days = Feb 14, 2026
    expect(resolved.targetDate?.getMonth()).toBe(1);
    expect(resolved.targetDate?.getDate()).toBe(14);
    expect(resolved.supportingText).toContain("90 days");
    expect(resolved.supportingText).not.toMatch(/guaranteed/i);
  });

  it("crosses a leap-year February correctly", () => {
    const timeline = makeTimeline({ timeline_type: "opt_earliest_filing" });
    // 2028 is a leap year; 90 days before May 1 spans the Feb 29.
    const programEnd = new Date(2028, 4, 1);
    const profile = makeProfile({ i20_program_end_date: "2028-05-01" });
    const resolved = resolveTimeline(timeline, profile);
    expect(getDaysRemaining(programEnd, resolved.targetDate!)).toBe(90);
  });

  it("flags missing data without an I-20 date", () => {
    const timeline = makeTimeline({ timeline_type: "opt_earliest_filing" });
    const resolved = resolveTimeline(timeline, makeProfile({}));
    expect(resolved.isMissingData).toBe(true);
    expect(resolved.targetDate).toBeNull();
  });
});

describe("resolveTimeline — opt_general_latest_filing (60-day rule)", () => {
  it("is exactly 60 calendar days after the I-20 program end date", () => {
    const timeline = makeTimeline({ timeline_type: "opt_general_latest_filing" });
    const profile = makeProfile({ i20_program_end_date: "2026-05-15" });
    const resolved = resolveTimeline(timeline, profile);
    // May 15 + 60 days = Jul 14, 2026
    expect(resolved.targetDate?.getMonth()).toBe(6);
    expect(resolved.targetDate?.getDate()).toBe(14);
    expect(resolved.supportingText).toContain("60 days");
    expect(resolved.warningText).toMatch(/DSO/);
    expect(resolved.warningText).not.toMatch(/your legal deadline/i);
  });
});

describe("resolveTimeline — rolling windows", () => {
  it("resolves end_of_month dynamically from 'today', not a stored date", () => {
    const timeline = makeTimeline({ timeline_type: "end_of_month", rolling_rule: "end_of_month" });
    const resolvedJan = resolveTimeline(timeline, null, new Date(2026, 0, 5));
    const resolvedFeb = resolveTimeline(timeline, null, new Date(2026, 1, 5));
    expect(resolvedJan.targetDate?.getMonth()).toBe(0);
    expect(resolvedFeb.targetDate?.getMonth()).toBe(1);
  });
});

describe("isSystemTimelineAvailable", () => {
  it("does not expose legacy immigration calculations", () => {
    expect(isSystemTimelineAvailable("opt_earliest_filing", null)).toBe(false);
    expect(isSystemTimelineAvailable("opt_start", makeProfile({ opt_start_date: "2026-06-01" }))).toBe(false);
  });

  it("exposes graduation once its source date is present", () => {
    expect(isSystemTimelineAvailable("i20_program_end", makeProfile({ expected_graduation_date: null }))).toBe(false);
    expect(
      isSystemTimelineAvailable("i20_program_end", makeProfile({ expected_graduation_date: "2026-06-01" }))
    ).toBe(true);
  });

  it("rolling windows are always available regardless of profile", () => {
    expect(isSystemTimelineAvailable("end_of_quarter", null)).toBe(true);
  });
});
