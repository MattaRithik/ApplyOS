import { describe, expect, it } from "vitest";
import { validRawResponse } from "@/test/fixtures/ai-parser";
import { rawAiJobParseSchema } from "@/lib/ai-parser/schema";
import { validateExtraction } from "@/lib/ai-parser/quality";

function raw() {
  return rawAiJobParseSchema.parse(validRawResponse());
}

function parse(text: string, setup?: (r: ReturnType<typeof raw>) => void) {
  const input = raw();
  setup?.(input);
  return validateExtraction(input, text);
}

describe("new parse compensation validation", () => {
  it.each([
    ["Pay: $30 - $60.00 USD", 30, 60, "unknown"],
    ["Pay: USD $34.50–$36.75 per hour", 34.5, 36.75, "hour"],
    ["Salary: USD $120K/yr - $150K/yr", 120000, 150000, "year"],
    ["Salary: USD $120-150k annually", 120000, 150000, "year"],
    ["Salary: USD$116,000.00 - USD$155,000.00 annually.", 116000, 155000, "year"],
    ["Salary: EUR €5000 - €6500 per month", 5000, 6500, "month"],
    ["Salary: GBP £50,000-£70,000 per year.", 50000, 70000, "year"],
  ])("preserves the scale and unit of %s", (text, minimum, maximum, period) => {
    const { result, provenance } = parse(text);
    expect(result.compensation.salaryMinimum).toBe(minimum);
    expect(result.compensation.salaryMaximum).toBe(maximum);
    expect(result.compensation.salaryPeriod).toBe(period);
    expect(provenance["compensation.salaryMinimum"].status).toBe("explicit");
  });

  it("does not select the first region or apply Canadian currency to a US range", () => {
    const { result, provenance } = parse("Full-time Analyst Program\nNew York salary: USD $85,000-$123,000 annually\nToronto salary: CAD $76,000-$80,000 annually", (r) => {
      r.location.city = null; r.location.rawLocation = null;
    });
    expect(result.compensation.salaryMinimum).toBeNull();
    expect(result.compensation.salaryMaximum).toBeNull();
    expect(result.compensation.salaryCurrency).toBeNull();
    expect(provenance["compensation.salaryMinimum"].status).toBe("uncertain");
    expect(result.metadata.warnings?.join()).toContain("Multiple pay ranges");
  });

  it("uses the range for an explicitly selected job location", () => {
    const { result } = parse("Location: New York\nUS salary in New York: USD $85,000-$123,000 annually\nToronto salary: CAD $76,000-$80,000 annually", (r) => {
      r.location.city = "New York"; r.location.country = "US";
    });
    expect(result.compensation.salaryMinimum).toBe(85000);
    expect(result.compensation.salaryMaximum).toBe(123000);
    expect(result.compensation.salaryCurrency).toBe("USD");
  });

  it("does not confuse a median or bonus with maximum base salary", () => {
    const { result } = parse("Job Range Target: Minimum: $60,532.00 USD Median: $86,350.00 USD", (r) => {
      r.compensation.salaryMinimum = 60532; r.compensation.salaryMaximum = null;
    });
    expect(result.compensation.salaryMinimum).toBe(60532);
    expect(result.compensation.salaryMaximum).toBeNull();
  });

  it("selects the role's regional range even when the pasted text is one line", () => {
    const { result } = parse("Risk Analyst. Location: Toronto, Canada. Salary for Toronto: CAD $76,000-$80,000 annually. Salary for New York: USD $85,000-$123,000 annually.", (r) => {
      r.location.city = "Toronto"; r.location.country = "Canada";
      r.compensation.salaryMinimum = null; r.compensation.salaryMaximum = null;
      r.compensation.compensationText = "Toronto and New York ranges; scalar salary fields left null.";
      r.metadata.warnings = ["Multiple salary ranges; scalar salary fields left null."];
    });
    expect(result.compensation).toMatchObject({ salaryMinimum: 76000, salaryMaximum: 80000, salaryCurrency: "CAD", salaryPeriod: "year" });
    expect(result.compensation.compensationText).not.toContain("left null");
    expect(result.metadata.warnings?.join()).not.toContain("left null");
  });

  it("does not treat the first pay range's label as the job's selected location", () => {
    const { result } = parse("Risk Analyst. Toronto salary: CAD $76,000-$80,000 annually. New York salary: USD $85,000-$123,000 annually.", (r) => {
      r.location.city = "Toronto"; r.location.rawLocation = "Toronto";
    });
    expect(result.compensation.salaryMinimum).toBeNull();
  });

  it("fills a fixed hourly rate even when the model abstains because of an annualized range", () => {
    const { result } = parse("Location: McLean, United States. Interns are paid a fixed non-negotiable $40/hr rate. This position has an annualized salary range of $64,480 - $83,200 USD.", (r) => {
      r.location.city = "McLean"; r.location.country = "United States";
      r.compensation.salaryMinimum = null; r.compensation.salaryMaximum = null;
    });
    expect(result.compensation).toMatchObject({ salaryMinimum: 40, salaryMaximum: 40, salaryCurrency: "USD", salaryPeriod: "hour" });
  });

  it.each([
    ["Salary starts from USD $50,000 per year.", 50000, null],
    ["Salary up to USD $70,000 per year.", null, 70000],
  ])("preserves one-sided pay limits: %s", (text, minimum, maximum) => {
    const { result } = parse(text);
    expect(result.compensation.salaryMinimum).toBe(minimum);
    expect(result.compensation.salaryMaximum).toBe(maximum);
  });

  it("keeps the explicit hourly internship rate over an annualized range", () => {
    const { result } = parse("Intern salary: $40/hr. This position has an annualized salary range of $64,480 - $83,200 USD.");
    expect(result.compensation.salaryMinimum).toBe(40);
    expect(result.compensation.salaryMaximum).toBe(40);
    expect(result.compensation.salaryPeriod).toBe("hour");
  });

  it("does not fill amounts that do not appear in the posting", () => {
    const { result } = parse("We offer competitive compensation and great benefits.");
    expect(result.compensation.salaryMinimum).toBeNull();
    expect(result.compensation.salaryMaximum).toBeNull();
  });

  it("does not mutate the provider response", () => {
    const input = raw(); const before = structuredClone(input);
    validateExtraction(input, "Salary: $30-$60 per hour.");
    expect(input).toEqual(before);
  });
});

describe("role-specific work arrangement", () => {
  it.each([
    ["Work Arrangement: This position is currently an in-office role. You will work 5 days a week in the office.", "onsite"],
    ["This role will require 5 days/week in office. Benefits: Hybrid and flexible working arrangements, dependent on role.", "onsite"],
    ["We bring the power of hybrid cloud and AI to our clients.", "unknown"],
    ["Benefits: On-site gym and wellness centers. In-person interviews.", "unknown"],
    ["Depending on role and business needs, colleagues will work onsite, hybrid or virtually.", "unknown"],
    ["On-site\nThis is a hybrid position with in-office attendance three days per week.", "hybrid"],
    ["This role is fully remote. This role is on-site.", "unknown"],
    ["Our hybrid work model requires 4 days in the office per week and 1 day at home.", "hybrid"],
    ["This role is remote.", "remote"],
    ["You will work remotely from the United States.", "remote"],
    ["Work location: Remote", "remote"],
  ])("uses context: %s", (text, expected) => {
    expect(parse(text).result.location.workplaceType).toBe(expected);
  });
});

describe("recruiter purpose validation", () => {
  it.each(["talentacquisition@example.com", "recruiting@example.com", "USWAPTDO@example.com"])("rejects accommodation contact %s even if the AI fills it", (email) => {
    const { result } = parse(`For reasonable accommodations during the application process, contact ${email}.`, (r) => {
      r.identity.recruiterEmail = email; r.identity.recruiterName = "Accommodation Team";
    });
    expect(result.identity.recruiterEmail).toBeNull();
    expect(result.identity.recruiterName).toBeNull();
  });
  it("keeps a real recruiting contact despite a separate accommodation paragraph", () => {
    const { result } = parse("Recruiter for this role: Jane Doe, jane@example.com.\n\nFor disability accommodations contact support@example.com.", (r) => { r.identity.recruiterEmail = "jane@example.com"; });
    expect(result.identity.recruiterEmail).toBe("jane@example.com");
  });
  it("does not use a recruiter mention elsewhere to validate a support address", () => {
    const { result } = parse("Your recruiter will reach out.\n\nFor reasonable adjustments please contact jane@example.com.", (r) => { r.identity.recruiterEmail = "jane@example.com"; });
    expect(result.identity.recruiterEmail).toBeNull();
  });
});

describe("sponsorship without unnecessary exclusions", () => {
  it.each([
    ["Limited immigration sponsorship may be available.", "available"],
    ["Visa sponsorship is considered on a case-by-case basis.", "available"],
    ["Visa sponsorship is not guaranteed.", "unclear"],
    ["We cannot guarantee visa sponsorship.", "unclear"],
    ["Limited visa sponsorship may be available but is not guaranteed.", "available"],
    ["Applicants who do not require visa sponsorship are encouraged to apply.", "unclear"],
    ["We can sponsor employment visas for this role.", "available"],
    ["We do not provide visa sponsorship now or in the future.", "not_available"],
    ["We are unable to sponsor employment visas.", "not_available"],
    ["Candidates must work without requiring visa sponsorship now or in the future.", "not_available"],
    ["Candidates must be authorized to work in the United States.", "not_mentioned"],
    ["OPT and CPT candidates are welcome.", "not_mentioned"],
    ["Access is restricted to citizens and certain nonimmigrants.", "not_mentioned"],
    ["We are an equal opportunity employer regardless of citizenship status.", "not_mentioned"],
    ["No visa sponsorship is available for interns. Employment visa sponsorship may be available for full-time conversion.", "unclear"],
  ])("preserves policy scope: %s", (text, expected) => {
    const { result } = parse(text, (r) => { r.immigration.visaSponsorship = "not_available"; });
    expect(result.immigration.visaSponsorship).toBe(expected);
    if (expected === "available") expect(result.immigration.sponsorshipText).toBe(text);
  });
});

describe("preferred and alternative qualifications", () => {
  it.each([
    "Ideally 2+ years of credit experience.",
    "2+ years of experience preferred.",
    "Bachelor's degree and 3 years OR high school and 7 years of experience.",
    "6 months of experience or equivalent training, military service, or education.",
  ])("does not impose a hard numeric requirement: %s", (text) => {
    const { result } = parse(text, (r) => {
      r.experienceEducation.minimumYearsExperience = 2;
      r.experienceEducation.maximumYearsExperience = 7;
      r.experienceEducation.experienceText = text;
      r.metadata.evidence = [{ field: "experienceEducation.minimumYearsExperience", note: text }];
    });
    expect(result.experienceEducation.minimumYearsExperience).toBeNull();
    expect(result.experienceEducation.maximumYearsExperience).toBeNull();
    expect(result.experienceEducation.experienceText).toBe(text);
  });
  it("keeps an explicitly required minimum with exact evidence", () => {
    const text = "At least 3 years of risk management experience required.";
    const { result } = parse(text, (r) => {
      r.experienceEducation.minimumYearsExperience = 3; r.experienceEducation.experienceText = text;
      r.metadata.evidence = [{ field: "experienceEducation.minimumYearsExperience", note: text }];
    });
    expect(result.experienceEducation.minimumYearsExperience).toBe(3);
  });
});

describe("preserving useful fields without over-filtering", () => {
  it("does not confuse 401(k) benefits with base pay", () => {
    const { result } = parse("Salary: $100,000-$150,000 annually. 401(k) matching and 20 vacation days.");
    expect(result.compensation.salaryMinimum).toBe(100000);
    expect(result.compensation.salaryMaximum).toBe(150000);
  });
  it("keeps a numeric salary range without dollar symbols", () => {
    const { result } = parse("Salary range:\n64300-85700 per year");
    expect(result.compensation.salaryMinimum).toBe(64300);
    expect(result.compensation.salaryMaximum).toBe(85700);
  });
  it("does not use US boilerplate to change a Canadian role's dollar currency", () => {
    const { result } = parse("Location: Toronto, Canada\nSalary: $85,000-$100,000 annually.\nOur company has offices in the United States.", (r) => { r.location.city = "Toronto"; r.location.country = "Canada"; });
    expect(result.compensation.salaryCurrency).toBe("CAD");
  });
  it.each(["We offer visa sponsorship.", "We sponsor H-1B visas for this role.", "We may consider immigration sponsorship."])("retains an affirmative sponsorship statement: %s", (text) => {
    expect(parse(text).result.immigration.visaSponsorship).toBe("available");
  });
  it("finds preferred language outside an AI's shortened experience quotation", () => {
    const { result } = parse("Ideally 2+ years of credit experience.", (r) => {
      r.experienceEducation.minimumYearsExperience = 2;
      r.experienceEducation.experienceText = "2+ years of credit experience";
      r.metadata.evidence = [{ field: "experienceEducation.minimumYearsExperience", note: "2+ years of credit experience" }];
    });
    expect(result.experienceEducation.minimumYearsExperience).toBeNull();
  });
});
