import { describe, expect, it } from "vitest";
import {
  applicationInputSchema,
  companyInputSchema,
  contactInputSchema,
  interviewInputSchema,
  outreachInputSchema,
  profileInputSchema,
  templateInputSchema,
} from "./forms";

describe("server action input boundaries", () => {
  it("accepts ordinary application drafts and partial status changes", () => {
    expect(
      applicationInputSchema.parse({
        company_name: " Example ",
        job_title: "Analyst",
        date_applied: "",
        resume_id: null,
      }),
    ).toEqual({
      company_name: "Example",
      job_title: "Analyst",
      date_applied: null,
      resume_id: null,
    });
    expect(applicationInputSchema.partial().parse({ status: "ai_interview" })).toEqual({
      status: "ai_interview",
    });
  });
  it.each([
    { user_id: "another-user" },
    { company_id: "another-company" },
    { priority_score: NaN },
    { salary_min: -1 },
    { status: "forged" },
    { date_applied: "2026-02-30" },
    { required_skills: Array(101).fill("skill") },
    { job_description: "x".repeat(100_001) },
  ])("rejects forged identity, invalid values, and oversized application data", (patch) => {
    expect(
      applicationInputSchema.safeParse({ company_name: "Example", job_title: "Analyst", ...patch })
        .success,
    ).toBe(false);
  });
  it("normalizes optional blank contact fields and rejects invalid relationships", () => {
    expect(
      contactInputSchema.parse({
        name: "Test",
        relationship_type: "recruiter",
        email: "",
        linkedin_url: "",
        last_contacted_date: "",
      }),
    ).toMatchObject({ email: null, linkedin_url: null, last_contacted_date: null });
    expect(contactInputSchema.safeParse({ name: "Test", relationship_type: "owner" }).success).toBe(
      false,
    );
  });
  it("rejects invalid runtime types and privileged fields across forms", () => {
    expect(
      companyInputSchema.safeParse({ name: "Test", sponsorship_friendly: "yes" }).success,
    ).toBe(false);
    expect(
      outreachInputSchema.safeParse({ outreach_type: "cold_email", date_sent: "yesterday" })
        .success,
    ).toBe(false);
    expect(
      templateInputSchema.safeParse({
        name: "Test",
        category: "custom",
        body: "text",
        is_system_default: true,
      }).success,
    ).toBe(false);
    expect(
      interviewInputSchema.safeParse({
        round_name: "Interview",
        round_type: "technical",
        follow_up_sent: "true",
      }).success,
    ).toBe(false);
    expect(
      profileInputSchema.safeParse({ full_name: [], settings: { role: "owner" } }).success,
    ).toBe(false);
  });
});
