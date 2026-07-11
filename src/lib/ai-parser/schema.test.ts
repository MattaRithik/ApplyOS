import { describe, expect, it } from "vitest";
import { z } from "zod";
import { rawAiJobParseSchema, parseRequestSchema } from "@/lib/ai-parser/schema";

/**
 * Recursively walks a JSON Schema node and collects keywords OpenAI's
 * strict structured-outputs mode rejects. `propertyNames` is the one that
 * bit us in practice (z.record() compiles to it) — a live parse against
 * gpt-5-nano failed with "propertyNames is not permitted" even though every
 * other unit test in this file passed, because none of them actually ran
 * the schema through OpenAI's stricter subset of JSON Schema.
 */
function findDisallowedKeywords(node: unknown, path = "$", found: string[] = []): string[] {
  if (!node || typeof node !== "object") return found;
  const obj = node as Record<string, unknown>;
  for (const keyword of ["propertyNames", "patternProperties", "unevaluatedProperties"]) {
    if (keyword in obj) found.push(`${path}.${keyword}`);
  }
  for (const [key, value] of Object.entries(obj)) {
    if (value && typeof value === "object") {
      findDisallowedKeywords(value, `${path}.${key}`, found);
    }
  }
  return found;
}

function validRawResponse() {
  return {
    identity: {
      companyName: "Acme Corp",
      jobTitle: "Software Engineer",
      requisitionId: null,
      sourcePlatform: null,
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
      salaryMaximum: 150000,
      salaryCurrency: "USD",
      salaryPeriod: "year",
      bonusMentioned: null,
      equityMentioned: null,
      commissionMentioned: null,
      compensationIsEstimated: null,
      compensationText: null,
    },
    skills: {
      requiredSkills: ["TypeScript", "SQL"],
      preferredSkills: null,
      programmingLanguages: null,
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
      minimumYearsExperience: 2,
      maximumYearsExperience: 5,
      experienceText: "2-5 years",
      educationLevel: "Bachelor's",
      fieldsOfStudy: null,
      graduateDegreeRequired: null,
      certificationsRequired: null,
      certificationsPreferred: null,
    },
    roleContent: {
      conciseSummary: "A great engineering role.",
      responsibilities: null,
      requiredQualifications: null,
      preferredQualifications: null,
      benefits: null,
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
      quantResearchRelevance: null,
      quantTradingRelevance: null,
      quantDevelopmentRelevance: null,
      dataScienceRelevance: null,
      dataEngineeringRelevance: null,
      softwareEngineeringRelevance: 80,
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
  };
}

describe("rawAiJobParseSchema", () => {
  it("accepts a fully valid nested response", () => {
    const result = rawAiJobParseSchema.safeParse(validRawResponse());
    expect(result.success).toBe(true);
  });

  it("rejects an invalid enum value", () => {
    const bad = validRawResponse();
    (bad.location as Record<string, unknown>).workplaceType = "space station";
    const result = rawAiJobParseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a response missing a required key (strict mode)", () => {
    const bad = validRawResponse() as Record<string, unknown>;
    delete (bad.identity as Record<string, unknown>).jobTitle;
    const result = rawAiJobParseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects an unexpected extra key on a strict group object", () => {
    const bad = validRawResponse() as Record<string, unknown>;
    (bad.identity as Record<string, unknown>).extraHackedField = "nope";
    const result = rawAiJobParseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects a relevance score outside the 0-100 bound", () => {
    const bad = validRawResponse();
    (bad.quantRelevance as Record<string, unknown>).financeRelevance = 150;
    const result = rawAiJobParseSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("compiles to a JSON Schema with no keywords OpenAI's strict structured-outputs mode rejects", () => {
    // Regression test: z.record() previously used for metadata.evidence
    // compiled to a `propertyNames` constraint, which a live call to
    // gpt-5-nano rejected with a 400. Every field in this schema must
    // compile to plain `properties` + `additionalProperties: false`.
    const jsonSchema = z.toJSONSchema(rawAiJobParseSchema);
    expect(findDisallowedKeywords(jsonSchema)).toEqual([]);
  });
});

describe("parseRequestSchema", () => {
  it("accepts a minimal valid request", () => {
    const result = parseRequestSchema.safeParse({ jobDescription: "A description with enough length to matter here." });
    expect(result.success).toBe(true);
  });

  it("accepts optional HTTP(S) jobUrl and forceRefresh", () => {
    const result = parseRequestSchema.safeParse({
      jobDescription: "desc",
      jobUrl: "https://example.com/job/123",
      forceRefresh: true,
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown extra keys like model/cost/userId (strict mode)", () => {
    const result = parseRequestSchema.safeParse({ jobDescription: "desc", model: "gpt-5-mini" });
    expect(result.success).toBe(false);
  });

  it("rejects a client-supplied cost or authorization override", () => {
    expect(parseRequestSchema.safeParse({ jobDescription: "desc", cost: 0 }).success).toBe(false);
    expect(parseRequestSchema.safeParse({ jobDescription: "desc", authorization: "admin" }).success).toBe(false);
  });

  it("rejects a malformed jobUrl", () => {
    const result = parseRequestSchema.safeParse({ jobDescription: "desc", jobUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });

  it("rejects non-HTTP URL schemes", () => {
    expect(parseRequestSchema.safeParse({ jobDescription: "desc", jobUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(parseRequestSchema.safeParse({ jobDescription: "desc", jobUrl: "file:///etc/passwd" }).success).toBe(false);
  });
});
