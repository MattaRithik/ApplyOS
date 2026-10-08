import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ owner: vi.fn(), from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), createServiceRoleClient: () => ({ from: mocks.from, rpc: mocks.rpc }) }));
vi.mock("@/lib/admin/roles", async (original) => ({ ...await original<object>(), requirePrimaryOwner: mocks.owner }));
import { AdminAuthError } from "@/lib/admin/roles";
import { GET } from "./route";
const request = (suffix = "") => new Request(`https://app.test/api/admin/presence/history${suffix}`);
const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
beforeEach(() => { vi.clearAllMocks(); mocks.owner.mockResolvedValue({ id: "owner" }); });
describe("meaningful activity history", () => {
  it.each([401, 403])("requires owner access (%s) before reading activity", async (status) => {
    mocks.owner.mockRejectedValueOnce(new AdminAuthError("Denied", status as 401 | 403));
    expect((await GET(request())).status).toBe(status);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it.each(["-1", encode({ at: "invalid", id: "action:1" }), encode({ at: "2026-10-08T16:36:00Z", id: "private-content" })])("rejects invalid cursors", async (before) => {
    expect((await GET(request(`?before=${before}`))).status).toBe(400);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("paginates the combined chronological feed without exposing content or owner activity", async () => {
    const at = "2026-10-08T16:36:00Z";
    const data = Array.from({ length: 101 }, (_, index) => ({ id: `action:${200 - index}`, user_id: "dp", recorded_at: at, status: "Application updated", page: "applications" }));
    mocks.rpc.mockResolvedValue({ data, error: null });
    mocks.from.mockReturnValue({ select: () => ({ in: async () => ({ data: [{ id: "dp", full_name: "DP" }], error: null }) }) });
    const response = await GET(request(`?before=${encode({ at, id: "action:201" })}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.rpc).toHaveBeenCalledWith("meaningful_activity", { excluded_user: "owner", before_at: at, before_key: "action:201", page_size: 101 });
    const result = await response.json();
    expect(result.events).toHaveLength(100);
    expect(result.events[0]).toMatchObject({ profile_name: "DP", status: "Application updated" });
    expect(JSON.parse(Buffer.from(result.nextCursor, "base64url").toString())).toEqual({ at, id: "action:101" });
  });
  it("reports database failures without claiming there was no activity", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "Private detail" } });
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("Private detail");
  });
});
