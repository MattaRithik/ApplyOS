import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), from: vi.fn(), rpc: vi.fn(), activity: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), createServiceRoleClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/admin/roles", async (original) => ({ ...await original<object>(), requirePrimaryOwner: mocks.owner }));
vi.mock("@/lib/presence/visit-activity", () => ({ withVisitActivity: mocks.activity }));
import { AdminAuthError } from "@/lib/admin/roles";
import { GET } from "./route";
const request = (suffix = "") => new Request(`https://app.test/api/admin/presence/usage${suffix}`);
beforeEach(() => {
  vi.clearAllMocks(); mocks.owner.mockResolvedValue({ id: "owner" });
  mocks.activity.mockImplementation(async (_db, rows) => rows.map((row: object) => ({ ...row, activity: { added: 1, updated: 2, parsed: 3 } })));
});
describe("owner page usage", () => {
  it.each([401, 403] as const)("denies %s without reading usage", async (status) => {
    mocks.owner.mockRejectedValueOnce(new AdminAuthError("Denied", status));
    expect((await GET(request())).status).toBe(status);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.activity).not.toHaveBeenCalled();
  });
  it("rejects invalid cursors", async () => {
    expect((await GET(request("?before=bad"))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("excludes the owner before pagination and returns profile names and aggregate usage", async () => {
    const data = Array.from({ length: 101 }, (_, i) => ({ id: 200 - i, user_id: "dp", page: "applications" }));
    const query = { select: vi.fn(), neq: vi.fn(), gt: vi.fn(), order: vi.fn(), limit: vi.fn(), lt: vi.fn(), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) };
    for (const fn of [query.select, query.neq, query.gt, query.order, query.limit, query.lt]) fn.mockReturnValue(query);
    mocks.from.mockImplementation((table) => table === "profiles" ? { select: () => ({ in: async () => ({ data: [{ id: "dp", full_name: "DP" }], error: null }) }) } : query);
    mocks.rpc.mockResolvedValue({ data: [{ user_id: "dp", page: "applications", active_seconds: 60, visible_seconds: 90, visits: 2 }], error: null });
    const response = await GET(request("?before=201"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(query.neq).toHaveBeenCalledWith("user_id", "owner");
    expect(query.gt).toHaveBeenCalledWith("active_seconds", 0);
    expect(query.lt).toHaveBeenCalledWith("id", "201");
    expect(mocks.rpc).toHaveBeenCalledWith("page_usage_summary", { since_at: expect.any(String), excluded_user: "owner" });
    const result = await response.json();
    expect(result.visits).toHaveLength(100);
    expect(result.nextCursor).toBe("101");
    expect(result.summary[0]).toMatchObject({ profile_name: "DP", active_seconds: 60 });
    expect(result.visits[0]).toMatchObject({ profile_name: "DP", activity: { added: 1, updated: 2, parsed: 3 } });
    expect(mocks.activity.mock.calls[0][1]).toHaveLength(100);
  });
});
