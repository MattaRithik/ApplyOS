import { describe, expect, it, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@/lib/ai-parser/client", () => ({
  getOpenAIClient: () => ({
    responses: { create: createMock },
  }),
}));

import { validRawResponse } from "@/test/fixtures/ai-parser";
import { rawAiJobParseSchema } from "@/lib/ai-parser/schema";
import { selectSafeFieldsToApply } from "@/lib/ai-parser/apply-to-form";
import type { ApplicationFormValues } from "@/components/applications/application-form";

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
  it("corrects provider mistakes before selecting fields for a new application", async () => {
    const raw = rawAiJobParseSchema.parse(validRawResponse());
    raw.compensation.salaryMinimum = 30000;
    raw.compensation.salaryMaximum = 60000;
    raw.location.workplaceType = "hybrid";
    raw.identity.recruiterEmail = "talentacquisition@example.com";
    raw.immigration.visaSponsorship = "not_available";
    raw.experienceEducation.minimumYearsExperience = 2;
    createMock.mockResolvedValueOnce(responseFor(raw));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");
    const { result } = await parseJobDescription({
      jobDescription: "Location: New York, United States. Pay: USD $30-$60.00 per hour. This role requires 5 days/week in office. Benefits: Hybrid working, dependent on role. Ideally 2+ years of experience. Limited immigration sponsorship may be available. For disability accommodations contact talentacquisition@example.com.",
      jobUrl: "https://jobs.lever.co/acme/123",
    });
    expect(result.compensation).toMatchObject({ salaryMinimum: 30, salaryMaximum: 60, salaryCurrency: "USD", salaryPeriod: "hour" });
    expect(result.location.workplaceType).toBe("onsite");
    expect(result.identity.recruiterEmail).toBeNull();
    expect(result.immigration.visaSponsorship).toBe("available");
    expect(result.immigration.sponsorshipText).toBe("Limited immigration sponsorship may be available.");
    expect(result.experienceEducation.minimumYearsExperience).toBeNull();
    expect(result.identity.sourcePlatform).toBe("Lever");
    const safe = selectSafeFieldsToApply(result, { source: "", salary_min: null, salary_max: null, work_mode: null, visa_sponsorship_status: "not_mentioned" } as ApplicationFormValues);
    for (const field of ["identity.sourcePlatform", "compensation.salaryMinimum", "compensation.salaryMaximum", "location.workplaceType", "immigration.visaSponsorship"]) expect(safe.has(field)).toBe(true);
    expect(safe.has("__recruiterContact")).toBe(false);
    expect(result.parseMeta.promptVersion).toBe("2.2.0");
  });

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

describe("target-role priority in the complete parse", () => {
  it("scores saved targets in the same request and records the preferences and AI provenance", async () => {
    createMock.mockResolvedValueOnce(responseFor(validRawResponse({ priorityMatch: { score: 94, matchedTargetRole: "Credit Risk", explanation: "The role focuses on credit exposure and underwriting." } })));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");
    const { result } = await parseJobDescription({ jobDescription: LONG_DESCRIPTION, targetRoles: ["Credit Risk", "Market Risk"] });
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(createMock.mock.calls[0][0].input)).toContain("Credit Risk");
    expect(result.priorityMatch).toMatchObject({ score: 94, targetRoles: ["Credit Risk", "Market Risk"] });
    expect(result.provenance["priorityMatch.score"].status).toBe("inferred");
    expect(result.identity.companyName).toBe("Acme Corp");
    expect(result.compensation).toBeDefined();
  });

  it.each([{ targetRoles: [] }, { targetRoles: ["Credit Risk"] }])("rejects invented matches when preferences are $targetRoles", async ({ targetRoles }) => {
    createMock.mockResolvedValueOnce(responseFor(validRawResponse({ priorityMatch: { score: 100, matchedTargetRole: "Unrequested Role", explanation: "Unsupported" } })));
    const { parseJobDescription } = await import("@/lib/ai-parser/service");
    const { result } = await parseJobDescription({ jobDescription: LONG_DESCRIPTION, targetRoles });
    expect(result.priorityMatch).toBeNull();
  });
});
