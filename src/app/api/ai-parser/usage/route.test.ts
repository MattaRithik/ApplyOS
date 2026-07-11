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

const getUsageSummaryMock = vi.fn();
vi.mock("@/lib/ai-parser/usage", () => ({
  getUsageSummary: getUsageSummaryMock,
}));

const { GET } = await import("@/app/api/ai-parser/usage/route");

beforeEach(() => {
  vi.clearAllMocks();
  getUsageSummaryMock.mockResolvedValue({ range: "month", totals: {}, spend: {}, perModel: [], recentActivity: [] });
});

describe("GET /api/ai-parser/usage", () => {
  it("returns 401 when unauthenticated", async () => {
    requireAIParserAccessMock.mockRejectedValueOnce(new FakeParserAuthError("Not authenticated.", 401));
    const res = await GET(new Request("http://localhost/api/ai-parser/usage"));
    expect(res.status).toBe(401);
  });

  it("returns 403 for an account with no active entitlement", async () => {
    requireAIParserAccessMock.mockRejectedValueOnce(new FakeParserAuthError("AI parsing is not enabled for this account.", 403));
    const res = await GET(new Request("http://localhost/api/ai-parser/usage"));
    expect(res.status).toBe(403);
  });

  it("always scopes usage to the authenticated user's own id, ignoring any client-supplied id in the query string", async () => {
    requireAIParserAccessMock.mockResolvedValueOnce({
      user: { id: "user-1", email: "user@example.com" },
      entitlement: { expiresAt: null },
      limits: { dailyRequestLimit: 100, monthlyBudgetUsd: null },
    });

    // An attacker might try to override the scope via a query param — the
    // route has no such parameter at all, and getUsageSummary is always
    // called with the session's own user id, never anything from the URL.
    await GET(new Request("http://localhost/api/ai-parser/usage?range=month&userId=some-other-user"));

    expect(getUsageSummaryMock).toHaveBeenCalledWith("user-1", "month");
  });

  it("includes the caller's own effective entitlement limits, never another user's", async () => {
    requireAIParserAccessMock.mockResolvedValueOnce({
      user: { id: "user-1", email: "user@example.com" },
      entitlement: { expiresAt: "2099-01-01T00:00:00Z" },
      limits: { dailyRequestLimit: 42, monthlyBudgetUsd: 9 },
    });

    const res = await GET(new Request("http://localhost/api/ai-parser/usage"));
    const json = await res.json();
    expect(json.entitlement).toEqual({ dailyRequestLimit: 42, monthlyBudgetUsd: 9, expiresAt: "2099-01-01T00:00:00Z" });
  });
});
