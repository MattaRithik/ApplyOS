import { describe, expect, it, vi } from "vitest";

const { from, select } = vi.hoisted(() => ({ from: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    // Intentionally no RPC: account support must work with the existing schema.
    auth: { admin: { getUserById: async () => ({ data: { user: {
      id: "user-1", email: "user@example.com", email_confirmed_at: "2026-01-01",
      created_at: "2026-01-01", last_sign_in_at: "2026-09-24",
    } }, error: null }) } },
    from,
  }),
}));
vi.mock("@/lib/admin/roles", () => ({ getUserRole: async () => "user" }));
vi.mock("@/lib/ai-parser/entitlement", () => ({ getEntitlement: async () => ({
  enabled: true, dailyRequestLimit: 100, monthlyBudgetUsd: 10,
}) }));

import { getUserDetail } from "./users";

describe("administrative account detail", () => {
  it("retains account-support information and billing totals without loading parsing history or using a new RPC", async () => {
    from.mockImplementation((table: string) => {
      if (!["profiles", "ai_parser_usage"].includes(table)) throw new Error(`Unexpected private table: ${table}`);
      const result = table === "profiles"
        ? { data: { full_name: "Example User" }, error: null }
        : { data: [{ estimated_total_cost_usd: 0.25 }], error: null };
      const query = {
        select: (columns: string) => { select(table, columns); return query; },
        eq: () => query,
        gte: () => Promise.resolve(result),
        maybeSingle: () => Promise.resolve(result),
        then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
      };
      return query;
    });

    const detail = await getUserDetail("user-1");
    expect(detail).toMatchObject({
      id: "user-1", email: "user@example.com", displayName: "Example User",
      emailVerified: true, lastSignInAt: "2026-09-24", banned: false,
      role: "user", aiAccess: { enabled: true, dailyRequestLimit: 100, monthlyBudgetUsd: 10 },
      usageThisMonth: { requests: 1, estimatedCostUsd: 0.25 },
      usageAllTime: { requests: 1, estimatedCostUsd: 0.25 },
    });
    expect(detail).not.toHaveProperty("recentActivity");
    expect(select.mock.calls.filter(([table]) => table === "ai_parser_usage"))
      .toEqual([["ai_parser_usage", "estimated_total_cost_usd"], ["ai_parser_usage", "estimated_total_cost_usd"]]);
  });
});
