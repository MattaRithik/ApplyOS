import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";

const fromMock = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({ from: fromMock }),
}));

// The owner-bootstrap side effect is roles.ts's own concern (tested in roles.test.ts) —
// stub it here so entitlement tests exercise only entitlement resolution.
vi.mock("@/lib/admin/roles", () => ({
  ensureOwnerBootstrap: vi.fn(async () => {}),
}));

const { requireAIParserAccess, hasAIParserAccess, getCurrentUserEntitlement, resolveEffectiveLimits, ParserAuthError } = await import(
  "@/lib/ai-parser/entitlement"
);

function fakeSupabase(user: Partial<User> | null): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({ data: { user: user as User | null }, error: null }),
    },
  } as unknown as SupabaseClient;
}

function makeUser(overrides: Record<string, unknown> = {}): Partial<User> {
  return { id: "user-1", email: "someone@example.com", email_confirmed_at: "2026-01-01T00:00:00Z", ...overrides } as Partial<User>;
}

function entitlementRow(overrides: Record<string, unknown> = {}) {
  return {
    enabled: true,
    daily_request_limit: null,
    monthly_budget_usd: null,
    suspended_at: null,
    suspension_reason: null,
    expires_at: null,
    granted_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mockEntitlementRow(row: Record<string, unknown> | null) {
  fromMock.mockImplementation(() => ({
    select: () => ({
      eq: () => ({
        maybeSingle: async () => ({ data: row }),
      }),
    }),
  }));
}

const originalDailyLimit = process.env.AI_PARSER_DEFAULT_DAILY_LIMIT;
const originalMonthlyBudget = process.env.AI_PARSER_DEFAULT_MONTHLY_BUDGET_USD;

beforeEach(() => {
  fromMock.mockReset();
  delete process.env.AI_PARSER_DEFAULT_DAILY_LIMIT;
  delete process.env.AI_PARSER_DEFAULT_MONTHLY_BUDGET_USD;
});

afterEach(() => {
  process.env.AI_PARSER_DEFAULT_DAILY_LIMIT = originalDailyLimit;
  process.env.AI_PARSER_DEFAULT_MONTHLY_BUDGET_USD = originalMonthlyBudget;
});

describe("resolveEffectiveLimits", () => {
  it("uses the entitlement's own limits when set", () => {
    const limits = resolveEffectiveLimits({
      enabled: true,
      dailyRequestLimit: 10,
      monthlyBudgetUsd: 2.5,
      suspendedAt: null,
      suspensionReason: null,
      expiresAt: null,
      grantedAt: null,
    });
    expect(limits).toEqual({ dailyRequestLimit: 10, monthlyBudgetUsd: 2.5 });
  });

  it("falls back to env defaults when the entitlement doesn't set a limit", () => {
    process.env.AI_PARSER_DEFAULT_DAILY_LIMIT = "42";
    process.env.AI_PARSER_DEFAULT_MONTHLY_BUDGET_USD = "7.5";
    const limits = resolveEffectiveLimits(null);
    expect(limits).toEqual({ dailyRequestLimit: 42, monthlyBudgetUsd: 7.5 });
  });

  it("falls back to a hardcoded default daily limit when nothing else is configured", () => {
    const limits = resolveEffectiveLimits(null);
    expect(limits.dailyRequestLimit).toBe(100);
    expect(limits.monthlyBudgetUsd).toBeNull();
  });
});

describe("requireAIParserAccess", () => {
  it("throws 401 when unauthenticated", async () => {
    await expect(requireAIParserAccess(fakeSupabase(null))).rejects.toMatchObject({ status: 401 });
    await expect(requireAIParserAccess(fakeSupabase(null))).rejects.toBeInstanceOf(ParserAuthError);
  });

  it("throws 403 when there is no entitlement row at all", async () => {
    mockEntitlementRow(null);
    await expect(requireAIParserAccess(fakeSupabase(makeUser()))).rejects.toMatchObject({ status: 403 });
  });

  it("throws 403 when the entitlement is disabled", async () => {
    mockEntitlementRow(entitlementRow({ enabled: false }));
    await expect(requireAIParserAccess(fakeSupabase(makeUser()))).rejects.toMatchObject({ status: 403 });
  });

  it("throws 403 when the entitlement is suspended", async () => {
    mockEntitlementRow(entitlementRow({ suspended_at: "2026-01-01T00:00:00Z" }));
    await expect(requireAIParserAccess(fakeSupabase(makeUser()))).rejects.toMatchObject({ status: 403 });
  });

  it("throws 403 when the entitlement has expired", async () => {
    mockEntitlementRow(entitlementRow({ expires_at: "2020-01-01T00:00:00Z" }));
    await expect(requireAIParserAccess(fakeSupabase(makeUser()))).rejects.toMatchObject({ status: 403 });
  });

  it("resolves with per-user limits for an active, unexpired, unsuspended entitlement", async () => {
    mockEntitlementRow(entitlementRow({ daily_request_limit: 5, monthly_budget_usd: 1, expires_at: "2099-01-01T00:00:00Z" }));
    const ctx = await requireAIParserAccess(fakeSupabase(makeUser()));
    expect(ctx.limits).toEqual({ dailyRequestLimit: 5, monthlyBudgetUsd: 1 });
  });
});

describe("hasAIParserAccess", () => {
  it("returns false instead of throwing when access is unavailable", async () => {
    mockEntitlementRow(null);
    await expect(hasAIParserAccess(fakeSupabase(makeUser()))).resolves.toBe(false);
  });

  it("returns true for an active entitlement", async () => {
    mockEntitlementRow(entitlementRow());
    await expect(hasAIParserAccess(fakeSupabase(makeUser()))).resolves.toBe(true);
  });
});

describe("getCurrentUserEntitlement", () => {
  it("returns null when unauthenticated (never leaks another user's entitlement)", async () => {
    await expect(getCurrentUserEntitlement(fakeSupabase(null))).resolves.toBeNull();
  });

  it("returns the caller's own entitlement", async () => {
    mockEntitlementRow(entitlementRow({ daily_request_limit: 3 }));
    const result = await getCurrentUserEntitlement(fakeSupabase(makeUser()));
    expect(result?.entitlement?.dailyRequestLimit).toBe(3);
  });
});
