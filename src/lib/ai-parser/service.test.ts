import { describe, expect, it, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@/lib/ai-parser/client", () => ({
  getOpenAIClient: () => ({
    responses: { create: createMock },
  }),
}));

function validRawResponse(overrides: Record<string, unknown> = {}) {
  const base = {
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
      city: null,
      stateOrRegion: null,
      country: null,
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
      requiredSkills: ["TypeScript"],
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
      conciseSummary: "A role.",
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
  };
  return { ...base, ...overrides };
}

function responseFor(raw: unknown, usage = { input_tokens: 100, output_tokens: 50, total_tokens: 150, input_tokens_details: { cached_tokens: 0 } }) {
  return { output_text: JSON.stringify(raw), usage };
}

const LONG_DESCRIPTION = "A sufficiently long job description text here.";

beforeEach(() => {
  createMock.mockReset();
  vi.resetModules();
  vi.unstubAllEnvs();
});

describe("parseJobDescription — single primary model, no confidence-based fallback", () => {
  it("makes exactly one OpenAI request for a normal successful parse", async () => {
    createMock.mockResolvedValueOnce(responseFor(validRawResponse()));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");

    const outcome = await parseJobDescription({ jobDescription: LONG_DESCRIPTION });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(outcome.result.identity.companyName).toBe("Acme Corp");
    expect(outcome.result.parseMeta.fallbackUsed).toBe(false);
  });

  it("calls gpt-5-mini by default (AI_PARSER_MODEL unset)", async () => {
    createMock.mockResolvedValueOnce(responseFor(validRawResponse()));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");

    await parseJobDescription({ jobDescription: LONG_DESCRIPTION });

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-mini" }));
  });

  it("passes reasoning.effort: low on every call", async () => {
    createMock.mockResolvedValueOnce(responseFor(validRawResponse()));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");

    await parseJobDescription({ jobDescription: LONG_DESCRIPTION });

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ reasoning: { effort: "low" } }));
  });

  it("does NOT retry or call a second model when overallConfidence is low — confidence is UI metadata only", async () => {
    const lowConfidence = validRawResponse({ metadata: { ...validRawResponse().metadata, overallConfidence: 0.1 } });
    createMock.mockResolvedValueOnce(responseFor(lowConfidence));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");

    const outcome = await parseJobDescription({ jobDescription: LONG_DESCRIPTION });

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(outcome.result.parseMeta.fallbackUsed).toBe(false);
    expect(outcome.result.metadata.overallConfidence).toBe(0.1);
  });

  it("initialModel and finalModel are always the same primary model — no distinct fallback model", async () => {
    createMock.mockResolvedValueOnce(responseFor(validRawResponse()));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");

    const outcome = await parseJobDescription({ jobDescription: LONG_DESCRIPTION });

    expect(outcome.result.parseMeta.initialModel).toBe("gpt-5-mini");
    expect(outcome.result.parseMeta.finalModel).toBe("gpt-5-mini");
    expect(outcome.result.parseMeta.initialModel).toBe(outcome.result.parseMeta.finalModel);
  });

  it("retries at most once (same model) when the first response fails Zod schema validation", async () => {
    createMock.mockResolvedValueOnce(responseFor({ garbage: true }));
    createMock.mockResolvedValueOnce(responseFor(validRawResponse()));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");

    const outcome = await parseJobDescription({ jobDescription: LONG_DESCRIPTION });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(createMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: "gpt-5-mini" }));
    expect(createMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: "gpt-5-mini" }));
    expect(outcome.result.parseMeta.fallbackUsed).toBe(true);
    expect(outcome.result.parseMeta.finalModel).toBe("gpt-5-mini");
  });

  it("retries at most once when the first response is non-JSON / unusable", async () => {
    createMock.mockResolvedValueOnce({ output_text: "not json at all", usage: undefined });
    createMock.mockResolvedValueOnce(responseFor(validRawResponse()));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");

    const outcome = await parseJobDescription({ jobDescription: LONG_DESCRIPTION });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(outcome.result.identity.companyName).toBe("Acme Corp");
  });

  it("retries at most once on a retryable provider error (5xx), then succeeds", async () => {
    createMock.mockRejectedValueOnce(Object.assign(new Error("service unavailable"), { status: 503 }));
    createMock.mockResolvedValueOnce(responseFor(validRawResponse()));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");

    const outcome = await parseJobDescription({ jobDescription: LONG_DESCRIPTION });

    expect(createMock).toHaveBeenCalledTimes(2);
    expect(outcome.result.parseMeta.fallbackUsed).toBe(true);
  });

  it("never retries a non-retryable provider error (4xx) — fails immediately with zero extra calls", async () => {
    createMock.mockRejectedValueOnce(Object.assign(new Error("bad request"), { status: 400 }));
    const { parseJobDescription, ParserProviderError } = await import("@/lib/ai-parser/service");

    await expect(parseJobDescription({ jobDescription: LONG_DESCRIPTION })).rejects.toBeInstanceOf(ParserProviderError);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces a clear unusable-result signal when the retry also fails, without a third call", async () => {
    createMock.mockResolvedValueOnce(responseFor({ garbage: true }));
    createMock.mockResolvedValueOnce(responseFor({ stillGarbage: true }));
    const { parseJobDescription, ParserUnusableResultError } = await import("@/lib/ai-parser/service");

    await expect(parseJobDescription({ jobDescription: LONG_DESCRIPTION })).rejects.toBeInstanceOf(ParserUnusableResultError);
    expect(createMock).toHaveBeenCalledTimes(2);
  });

  it("honors AI_PARSER_MAX_RETRIES=0 — never retries even a retryable failure", async () => {
    vi.stubEnv("AI_PARSER_MAX_RETRIES", "0");
    createMock.mockRejectedValueOnce(Object.assign(new Error("service unavailable"), { status: 503 }));
    const { parseJobDescription, ParserUnusableResultError } = await import("@/lib/ai-parser/service");

    await expect(parseJobDescription({ jobDescription: LONG_DESCRIPTION })).rejects.toBeInstanceOf(ParserUnusableResultError);
    expect(createMock).toHaveBeenCalledTimes(1);
  });

  it("honors AI_PARSER_MODEL override", async () => {
    vi.stubEnv("AI_PARSER_MODEL", "gpt-5-mini-2025-08-07");
    createMock.mockResolvedValueOnce(responseFor(validRawResponse()));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");

    await parseJobDescription({ jobDescription: LONG_DESCRIPTION });

    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ model: "gpt-5-mini-2025-08-07" }));
  });

  it("token/cost accounting includes every actual provider attempt, not just the final one", async () => {
    createMock.mockResolvedValueOnce(responseFor({ garbage: true }, { input_tokens: 40, output_tokens: 10, total_tokens: 50, input_tokens_details: { cached_tokens: 0 } }));
    createMock.mockResolvedValueOnce(responseFor(validRawResponse(), { input_tokens: 100, output_tokens: 60, total_tokens: 160, input_tokens_details: { cached_tokens: 5 } }));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");

    const outcome = await parseJobDescription({ jobDescription: LONG_DESCRIPTION });

    expect(outcome.usage.modelCalls).toHaveLength(2);
    expect(outcome.usage.totalInputTokens).toBe(140);
    expect(outcome.usage.totalOutputTokens).toBe(70);
    expect(outcome.usage.totalTokens).toBe(210);
    expect(outcome.usage.totalCachedInputTokens).toBe(5);
  });
});
