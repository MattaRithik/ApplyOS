import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ auth: vi.fn(), owner: vi.fn(), limit: vi.fn(), from: vi.fn(), upsert: vi.fn(), prune: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}), createServiceRoleClient: () => ({ from: mocks.from }) }));
vi.mock("@/lib/admin/roles", async (original) => ({ ...await original<object>(), requireAuthenticatedUser: mocks.auth, requirePrimaryOwner: mocks.owner }));
vi.mock("@/lib/security/rate-limit", () => ({ consumeApiRateLimit: mocks.limit }));
vi.mock("@/lib/presence/server", async (original) => ({ ...await original<object>(), prunePresence: mocks.prune }));
import { AdminAuthError } from "@/lib/admin/roles";
import { recordHeartbeat as POST } from "@/lib/presence/heartbeat";
import { GET } from "../admin/presence/route";
const body = { sessionId: "00000000-0000-4000-8000-000000000001", page: "dashboard", visible: true, closed: false, idleSeconds: 0 };
const request = (value = body, origin = "https://app.test") => new Request("https://app.test/api/presence", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(value) });
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({ id: "actual-user", email: "actual@example.com" });
  mocks.owner.mockResolvedValue({ id: "owner" });
  mocks.limit.mockResolvedValue(true);
  mocks.upsert.mockResolvedValue({ error: null });
  mocks.prune.mockResolvedValue(undefined);
  mocks.from.mockReturnValue({ upsert: mocks.upsert });
});
describe("authenticated heartbeat", () => {
  it("rejects anonymous callers without touching the database", async () => {
    mocks.auth.mockRejectedValue(new AdminAuthError("Not authenticated.", 401));
    expect((await POST(request())).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it("rejects cross-origin requests", async () => {
    expect((await POST(request(body, "https://evil.test"))).status).toBe(403);
    expect(mocks.auth).not.toHaveBeenCalled();
  });
  it("cannot write another user's activity", async () => {
    expect((await POST(request({ ...body, user_id: "victim" } as typeof body))).status).toBe(400);
    expect(mocks.upsert).not.toHaveBeenCalled();
    const response = await POST(request());
    expect(response.status).toBe(204);
    expect(mocks.upsert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "actual-user", email: "actual@example.com" }), { onConflict: "user_id,session_id" });
  });
  it("rate limits before writes and fails closed on database errors", async () => {
    mocks.limit.mockResolvedValueOnce(false);
    expect((await POST(request())).status).toBe(429);
    expect(mocks.upsert).not.toHaveBeenCalled();
    mocks.upsert.mockResolvedValueOnce({ error: { message: "private database detail" } });
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database detail");
  });
});
describe("owner-only feed", () => {
  it.each([401, 403] as const)("denies %s before any database access", async (status) => {
    mocks.owner.mockRejectedValueOnce(new AdminAuthError("Denied.", status));
    const response = await GET();
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.prune).not.toHaveBeenCalled();
  });
  it("returns a bounded uncached feed for the configured owner", async () => {
    const query = { select: vi.fn(), gte: vi.fn(), order: vi.fn(), limit: vi.fn() };
    query.select.mockReturnValue(query); query.gte.mockReturnValue(query); query.order.mockReturnValue(query);
    query.limit.mockResolvedValue({ data: [body], error: null });
    mocks.from.mockReturnValue(query);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(query.limit).toHaveBeenCalledWith(200);
    expect((await response.json()).sessions).toEqual([body]);
  });
});
