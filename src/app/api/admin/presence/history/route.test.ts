import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), from: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), createServiceRoleClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/admin/roles", async (original) => ({ ...await original<object>(), requirePrimaryOwner: mocks.owner }));
import { AdminAuthError } from "@/lib/admin/roles";
import { GET } from "./route";
const request = (suffix = "") => new Request(`https://app.test/api/admin/presence/history${suffix}`);
beforeEach(() => { vi.clearAllMocks(); mocks.owner.mockResolvedValue({ id: "owner" }); });
describe("activity history", () => {
  it.each([401, 403])("requires owner access (%s)", async (status) => {
    mocks.owner.mockRejectedValueOnce(new AdminAuthError("Denied", status as 401 | 403));
    expect((await GET(request())).status).toBe(status);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects invalid cursors", async () => {
    expect((await GET(request("?before=-1"))).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("paginates older events using a stable cursor without a date cutoff", async () => {
    const data = Array.from({ length: 101 }, (_, index) => ({ id: 200 - index, user_id: "dp" }));
    const query = { select: vi.fn(), neq: vi.fn(), order: vi.fn(), limit: vi.fn(), lt: vi.fn(), then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data, error: null }).then(resolve) };
    for (const method of [query.neq, query.select, query.order, query.limit, query.lt]) method.mockReturnValue(query);
    mocks.from.mockImplementation((table) => table === "profiles"
      ? { select: () => ({ in: async () => ({ data: [{ id: "dp", full_name: "DP" }], error: null }) }) }
      : query);
    const response = await GET(request("?before=201"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(query.neq).toHaveBeenCalledWith("user_id", "owner");
    expect(query.select.mock.calls[0][0]).not.toContain("email");
    expect(query.lt).toHaveBeenCalledWith("id", "201");
    const result = await response.json();
    expect(result.events).toHaveLength(100);
    expect(result.events[0].profile_name).toBe("DP");
    expect(result.nextCursor).toBe("101");
  });
});
