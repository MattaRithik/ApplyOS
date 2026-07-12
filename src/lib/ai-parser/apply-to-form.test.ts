import { describe, expect, it } from "vitest";
import {
  applyParsedResultToForm,
  selectSafeFieldsToApply,
  SYNTHETIC_RECRUITER_CONTACT_KEY,
  SYNTHETIC_DEADLINE_KEY,
} from "@/lib/ai-parser/apply-to-form";
import type { AiParserResult, ProvenanceMap } from "@/lib/ai-parser/schema";
import type { ApplicationFormValues } from "@/components/applications/application-form";

function emptyForm(overrides: Partial<ApplicationFormValues> = {}): ApplicationFormValues {
  return {
    company_name: "",
    job_title: "",
    job_url: "",
    job_description: "",
    location: "",
    work_mode: null,
    employment_type: null,
    salary_min: null,
    salary_max: null,
    salary_currency: "USD",
    visa_sponsorship_notes: "",
    visa_sponsorship_status: "not_mentioned",
    date_applied: "",
    status: "saved",
    priority_score: 50,
    resume_id: null,
    cover_letter_used: "",
    referral_person: "",
    referral_email: "",
    referral_phone: "",
    notes: "",
    follow_up_date: "",
    source: "",
    keywords: [],
    required_skills: [],
    preferred_skills: [],
    hrContacts: [],
    ...overrides,
  };
}

function buildResult(overrides: Partial<AiParserResult> = {}, provenanceOverrides: ProvenanceMap = {}): AiParserResult {
  const base: AiParserResult = {
    identity: {
      companyName: "Tower Research Capital",
      jobTitle: "Quantitative Trader / Researcher - US",
      requisitionId: null,
      sourcePlatform: "LinkedIn",
      department: null,
      team: null,
      industry: null,
      companyDescription: null,
      recruiterName: null,
      recruiterEmail: null,
      hiringManagerName: null,
    },
    location: {
      rawLocation: "New York, NY",
      city: "New York",
      stateOrRegion: "NY",
      country: "USA",
      workplaceType: "hybrid",
      relocationAvailable: "not_mentioned",
      travelRequirement: null,
      allowedWorkLocations: null,
    },
    employment: {
      employmentType: "full_time",
      seniorityLevel: null,
      roleCategory: null,
      roleSubcategory: null,
      managementRole: null,
      internshipTerm: null,
      expectedStartDate: null,
    },
    compensation: {
      salaryMinimum: 120000,
      salaryMaximum: 200000,
      salaryCurrency: "USD",
      salaryPeriod: "year",
      bonusMentioned: true,
      equityMentioned: null,
      commissionMentioned: null,
      compensationIsEstimated: null,
      compensationText: null,
    },
    skills: {
      requiredSkills: ["Python"],
      preferredSkills: null,
      programmingLanguages: ["C++"],
      frameworks: null,
      libraries: null,
      databases: null,
      cloudPlatforms: null,
      dataTools: null,
      financeTools: null,
      machineLearningTools: null,
      developerTools: null,
      methodologies: null,
      domainKnowledge: null,
      softSkills: null,
      keywords: null,
    },
    experienceEducation: {
      minimumYearsExperience: null,
      maximumYearsExperience: null,
      experienceText: null,
      educationLevel: null,
      fieldsOfStudy: null,
      graduateDegreeRequired: null,
      certificationsRequired: null,
      certificationsPreferred: null,
    },
    roleContent: {
      conciseSummary: "A quant trading role.",
      responsibilities: null,
      requiredQualifications: null,
      preferredQualifications: null,
      benefits: ["Generous PTO", "Free meals"],
      interviewProcess: null,
      applicationDeadline: null,
      postingDate: null,
      schedule: null,
      shift: null,
    },
    immigration: {
      visaSponsorship: "not_mentioned",
      sponsorshipText: null,
      workAuthorizationRequirement: null,
      citizenshipRequirement: null,
      securityClearanceRequirement: null,
      exportControlRestriction: null,
      backgroundCheckMentioned: null,
    },
    quantRelevance: {
      quantResearchRelevance: 90,
      quantTradingRelevance: 85,
      quantDevelopmentRelevance: null,
      dataScienceRelevance: null,
      dataEngineeringRelevance: null,
      softwareEngineeringRelevance: null,
      equityResearchRelevance: null,
      riskManagementRelevance: null,
      portfolioManagementRelevance: null,
      financeRelevance: null,
    },
    metadata: {
      overallConfidence: 0.9,
      uncertainFields: null,
      warnings: null,
      explicitlyMissingCriticalFields: null,
      inferredFields: null,
      evidence: null,
    },
    provenance: {
      "identity.companyName": { status: "explicit" },
      "identity.jobTitle": { status: "explicit" },
      "identity.sourcePlatform": { status: "explicit" },
      "location.rawLocation": { status: "explicit" },
      "location.workplaceType": { status: "explicit" },
      "employment.employmentType": { status: "explicit" },
      "compensation.salaryMinimum": { status: "explicit" },
      "compensation.salaryMaximum": { status: "explicit" },
      "compensation.salaryCurrency": { status: "normalized" },
      "roleContent.benefits": { status: "explicit" },
      "skills.requiredSkills": { status: "explicit" },
      "skills.programmingLanguages": { status: "explicit" },
      ...provenanceOverrides,
    },
    parseMeta: {
      modelUsed: "gpt-5-mini",
      initialModel: "gpt-5-mini",
      finalModel: "gpt-5-mini",
      fallbackUsed: false,
      cached: false,
      parserSchemaVersion: "1.0.0",
      promptVersion: "1.0.0",
      latencyMs: 1000,
    },
  };
  return { ...base, ...overrides };
}

describe("selectSafeFieldsToApply", () => {
  it("auto-selects explicit, non-risky fields on an empty form", () => {
    const safe = selectSafeFieldsToApply(buildResult(), emptyForm());
    expect(safe.has("identity.companyName")).toBe(true);
    expect(safe.has("identity.jobTitle")).toBe(true);
  });

  it("requires strictly explicit provenance for risky fields — normalized is not enough", () => {
    // salaryCurrency is not itself in RISKY_FIELDS' salary set, but salaryMinimum/Maximum are —
    // confirm the risky ones only pass when explicit.
    const explicitRisky = buildResult({}, { "compensation.salaryMinimum": { status: "explicit" } });
    expect(selectSafeFieldsToApply(explicitRisky, emptyForm()).has("compensation.salaryMinimum")).toBe(true);
    const normalizedRisky = buildResult({}, { "compensation.salaryMinimum": { status: "normalized" } });
    expect(selectSafeFieldsToApply(normalizedRisky, emptyForm()).has("compensation.salaryMinimum")).toBe(false);
  });

  it("does not treat the form's default placeholder values as already-typed — visa sponsorship and salary currency", () => {
    // Regression test: a live parse against the Tower/LinkedIn fixture
    // correctly detected visaSponsorship as explicit "not_available", but
    // the form's untouched default for visa_sponsorship_status is the
    // literal string "not_mentioned" (not ""), which isFormValueEmpty used
    // to treat as "the user already set this" and silently skip it.
    const result = buildResult(
      { immigration: { ...buildResult().immigration, visaSponsorship: "not_available" } },
      { "immigration.visaSponsorship": { status: "explicit" } }
    );
    const safe = selectSafeFieldsToApply(result, emptyForm());
    expect(safe.has("immigration.visaSponsorship")).toBe(true);

    const currencyResult = buildResult({}, { "compensation.salaryCurrency": { status: "normalized" } });
    expect(selectSafeFieldsToApply(currencyResult, emptyForm()).has("compensation.salaryCurrency")).toBe(true);
  });

  it("still respects a real, non-default visa sponsorship value the user already chose", () => {
    const current = emptyForm({ visa_sponsorship_status: "h1b_available" });
    const result = buildResult(
      { immigration: { ...buildResult().immigration, visaSponsorship: "not_available" } },
      { "immigration.visaSponsorship": { status: "explicit" } }
    );
    expect(selectSafeFieldsToApply(result, current).has("immigration.visaSponsorship")).toBe(false);
  });

  it("skips inferred fields entirely", () => {
    const result = buildResult({}, { "identity.companyName": { status: "inferred" } });
    const safe = selectSafeFieldsToApply(result, emptyForm());
    expect(safe.has("identity.companyName")).toBe(false);
  });

  it("skips uncertain fields entirely", () => {
    const result = buildResult({}, { "location.workplaceType": { status: "uncertain" } });
    const safe = selectSafeFieldsToApply(result, emptyForm());
    expect(safe.has("location.workplaceType")).toBe(false);
  });

  it("is extra-conservative for visa sponsorship — requires explicit, not normalized", () => {
    const result = buildResult(
      { immigration: { ...buildResult().immigration, visaSponsorship: "available" } },
      { "immigration.visaSponsorship": { status: "normalized" } }
    );
    expect(selectSafeFieldsToApply(result, emptyForm()).has("immigration.visaSponsorship")).toBe(false);
  });

  it("does not overwrite a value the user already manually typed", () => {
    const current = emptyForm({ company_name: "Already Typed Inc" });
    const safe = selectSafeFieldsToApply(buildResult(), current);
    expect(safe.has("identity.companyName")).toBe(false);
    // Unrelated empty fields are still eligible.
    expect(safe.has("identity.jobTitle")).toBe(true);
  });

  it("only includes recruiter contact when the email itself is explicit", () => {
    const withEmail = buildResult(
      { identity: { ...buildResult().identity, recruiterEmail: "jane@example.com", recruiterName: "Jane" } },
      { "identity.recruiterEmail": { status: "explicit" } }
    );
    expect(selectSafeFieldsToApply(withEmail, emptyForm()).has(SYNTHETIC_RECRUITER_CONTACT_KEY)).toBe(true);

    const uncertainEmail = buildResult(
      { identity: { ...buildResult().identity, recruiterEmail: "jane@example.com", recruiterName: "Jane" } },
      { "identity.recruiterEmail": { status: "uncertain" } }
    );
    expect(selectSafeFieldsToApply(uncertainEmail, emptyForm()).has(SYNTHETIC_RECRUITER_CONTACT_KEY)).toBe(false);
  });

  it("does not include the deadline->follow-up synthetic key when a follow-up date is already set", () => {
    const result = buildResult(
      { roleContent: { ...buildResult().roleContent, applicationDeadline: "2026-08-15" } },
      { "roleContent.applicationDeadline": { status: "explicit" } }
    );
    const current = emptyForm({ follow_up_date: "2026-08-01" });
    expect(selectSafeFieldsToApply(result, current).has(SYNTHETIC_DEADLINE_KEY)).toBe(false);
  });
});

describe("applyParsedResultToForm — never overwrites manually typed values", () => {
  it("does not clobber an existing form value even if that key is (incorrectly) in acceptedKeys", () => {
    const current = emptyForm({ company_name: "Manually Typed Co" });
    const next = applyParsedResultToForm(current, buildResult(), new Set(["identity.companyName"]));
    expect(next.company_name).toBe("Manually Typed Co");
  });

  it("applies a field onto an empty form", () => {
    const next = applyParsedResultToForm(emptyForm(), buildResult(), new Set(["identity.companyName"]));
    expect(next.company_name).toBe("Tower Research Capital");
  });

  it("maps sourcePlatform onto the dedicated source form field", () => {
    const next = applyParsedResultToForm(emptyForm(), buildResult(), new Set(["identity.sourcePlatform"]));
    expect(next.source).toBe("LinkedIn");
  });
});

describe("applyParsedResultToForm — notes formatting", () => {
  it("groups notes into clear, spaced sections with headings", () => {
    const next = applyParsedResultToForm(emptyForm(), buildResult(), new Set(["roleContent.benefits", "compensation.salaryPeriod"]));
    expect(next.notes).toContain("BENEFITS");
    expect(next.notes).toContain("COMPENSATION");
    expect(next.notes).toMatch(/\n\n/); // blank-line spacing between sections
  });

  it("renders array values as bullet points", () => {
    const next = applyParsedResultToForm(emptyForm(), buildResult(), new Set(["roleContent.benefits"]));
    expect(next.notes).toContain("• Generous PTO");
    expect(next.notes).toContain("• Free meals");
  });

  it("never includes portal clutter — only structured extracted field labels/values", () => {
    const next = applyParsedResultToForm(emptyForm(), buildResult(), new Set(["roleContent.benefits"]));
    expect(next.notes).not.toMatch(/logo|show more options|clicked apply/i);
  });
});
