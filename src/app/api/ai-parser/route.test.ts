import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
}));

class FakeParserAuthError extends Error {
  status: 401 | 403;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.status = status;
  }
}

const requireAIParserAccessMock = vi.fn();
vi.mock("@/lib/ai-parser/entitlement", () => ({
  requireAIParserAccess: requireAIParserAccessMock,
  ParserAuthError: FakeParserAuthError,
}));

const getCachedResultMock = vi.fn();
const writeCacheResultMock = vi.fn();
vi.mock("@/lib/ai-parser/cache", () => ({
  normalizeDescription: (s: string) => s,
  hashDescription: () => "hash",
  getCachedResult: getCachedResultMock,
  writeCacheResult: writeCacheResultMock,
}));

const checkMonthlyBudgetMock = vi.fn<(userId: string, limitUsd: number | null) => Promise<{ ok: boolean; spentUsd: number; limitUsd: number | null }>>();
checkMonthlyBudgetMock.mockResolvedValue({ ok: true, spentUsd: 0, limitUsd: null });
vi.mock("@/lib/ai-parser/budget", () => ({
  checkMonthlyBudget: checkMonthlyBudgetMock,
}));

const acquireParseSlotMock = vi.fn(async () => ({ ok: true, usageRowId: "row-1" }));
const finalizeUsageRowMock = vi.fn(async () => {});
vi.mock("@/lib/ai-parser/rate-limit", () => ({
  acquireParseSlot: acquireParseSlotMock,
  finalizeUsageRow: finalizeUsageRowMock,
  getRateLimitConfig: (dailyLimit: number) => ({ minuteLimit: 5, dailyLimit, concurrencyLimit: 2 }),
}));

vi.mock("@/lib/ai-parser/pricing", () => ({
  calculateCost: () => ({ inputCostUsd: 0, cachedInputCostUsd: 0, outputCostUsd: 0, totalCostUsd: 0 }),
}));

const parseJobDescriptionMock = vi.fn();
class FakeParserProviderError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}
class FakeParserUnusableResultError extends Error {}
vi.mock("@/lib/ai-parser/service", () => ({
  parseJobDescription: parseJobDescriptionMock,
  ParserProviderError: FakeParserProviderError,
  ParserUnusableResultError: FakeParserUnusableResultError,
}));

const { POST } = await import("@/app/api/ai-parser/route");

const JOB_DESCRIPTION = "A".repeat(150);

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/ai-parser", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkMonthlyBudgetMock.mockResolvedValue({ ok: true, spentUsd: 0, limitUsd: null });
  acquireParseSlotMock.mockResolvedValue({ ok: true, usageRowId: "row-1" });
  getCachedResultMock.mockResolvedValue(null);
});

describe("POST /api/ai-parser — entitlement gating", () => {
  it("returns 403 and never calls the provider when access is unavailable", async () => {
    requireAIParserAccessMock.mockRejectedValueOnce(new FakeParserAuthError("AI parsing is not enabled for this account.", 403));
    const res = await POST(makeRequest({ jobDescription: JOB_DESCRIPTION }));
    expect(res.status).toBe(403);
    expect(parseJobDescriptionMock).not.toHaveBeenCalled();
    expect(acquireParseSlotMock).not.toHaveBeenCalled();
  });

  it("returns 401 and never calls the provider when unauthenticated", async () => {
    requireAIParserAccessMock.mockRejectedValueOnce(new FakeParserAuthError("Not authenticated.", 401));
    const res = await POST(makeRequest({ jobDescription: JOB_DESCRIPTION }));
    expect(res.status).toBe(401);
    expect(parseJobDescriptionMock).not.toHaveBeenCalled();
  });

  it("makes zero provider requests on a cache hit", async () => {
    requireAIParserAccessMock.mockResolvedValueOnce({
      user: { id: "user-1", email: "user@example.com" },
      entitlement: { enabled: true },
      limits: { dailyRequestLimit: 100, monthlyBudgetUsd: null },
    });
    getCachedResultMock.mockResolvedValueOnce({
      result: { provenance: {}, parseMeta: { fallbackUsed: false } },
      model: "gpt-5-mini",
    });

    const res = await POST(makeRequest({ jobDescription: JOB_DESCRIPTION }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cacheHit).toBe(true);
    expect(parseJobDescriptionMock).not.toHaveBeenCalled();
  });

  it("uses the entitlement's resolved per-user limits for the budget check and rate limiter", async () => {
    requireAIParserAccessMock.mockResolvedValueOnce({
      user: { id: "user-1", email: "user@example.com" },
      entitlement: { enabled: true },
      limits: { dailyRequestLimit: 7, monthlyBudgetUsd: 3 },
    });
    parseJobDescriptionMock.mockResolvedValueOnce({
      result: {
        provenance: {},
        parseMeta: { finalModel: "gpt-5-mini", initialModel: "gpt-5-mini", fallbackUsed: false, latencyMs: 10 },
      },
      usage: { modelCalls: [{ model: "gpt-5-mini" }], totalInputTokens: 1, totalOutputTokens: 1, totalCachedInputTokens: 0, totalTokens: 2 },
    });

    await POST(makeRequest({ jobDescription: JOB_DESCRIPTION }));

    expect(checkMonthlyBudgetMock).toHaveBeenCalledWith("user-1", 3);
    expect(acquireParseSlotMock).toHaveBeenCalledWith("user-1", expect.objectContaining({ dailyLimit: 7 }));
  });

  it("returns 429 without calling the provider when the monthly budget is exhausted", async () => {
    requireAIParserAccessMock.mockResolvedValueOnce({
      user: { id: "user-1", email: "user@example.com" },
      entitlement: { enabled: true },
      limits: { dailyRequestLimit: 100, monthlyBudgetUsd: 1 },
    });
    checkMonthlyBudgetMock.mockResolvedValueOnce({ ok: false, spentUsd: 5, limitUsd: 1 });

    const res = await POST(makeRequest({ jobDescription: JOB_DESCRIPTION }));
    expect(res.status).toBe(429);
    expect(parseJobDescriptionMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON and unknown properties before any provider call", async () => {
    requireAIParserAccessMock.mockResolvedValue({
      user: { id: "user-1" },
      entitlement: { enabled: true },
      limits: { dailyRequestLimit: 100, monthlyBudgetUsd: null },
    });
    const malformed = new Request("http://localhost/api/ai-parser", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad",
    });
    expect((await POST(malformed)).status).toBe(400);
    expect((await POST(makeRequest({ jobDescription: JOB_DESCRIPTION, model: "gpt-5" }))).status).toBe(400);
    expect(parseJobDescriptionMock).not.toHaveBeenCalled();
  });

  it("rejects cross-site requests and non-HTTP job URLs", async () => {
    const crossSite = new Request("http://localhost/api/ai-parser", {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://attacker.example", "Sec-Fetch-Site": "cross-site" },
      body: JSON.stringify({ jobDescription: JOB_DESCRIPTION }),
    });
    expect((await POST(crossSite)).status).toBe(403);

    requireAIParserAccessMock.mockResolvedValue({
      user: { id: "user-1" },
      entitlement: { enabled: true },
      limits: { dailyRequestLimit: 100, monthlyBudgetUsd: null },
    });
    expect((await POST(makeRequest({ jobDescription: JOB_DESCRIPTION, jobUrl: "file:///etc/passwd" }))).status).toBe(400);
    expect(parseJobDescriptionMock).not.toHaveBeenCalled();
  });
});
