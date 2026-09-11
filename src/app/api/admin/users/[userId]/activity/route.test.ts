import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
class FakeAdminAuthError extends Error {
  constructor(message: string, public status: 401 | 403) { super(message); }
}
const requireOwnerMock = vi.fn();
const getUserActivityMock = vi.fn();
const recordAuditEventMock = vi.fn();
vi.mock("@/lib/admin/roles", () => ({ requireOwner: requireOwnerMock, AdminAuthError: FakeAdminAuthError }));
vi.mock("@/lib/admin/user-activity", () => ({ getUserActivity: getUserActivityMock }));
vi.mock("@/lib/admin/audit", () => ({ recordAuditEvent: recordAuditEventMock }));
const { GET } = await import("./route");
const userId = "11111111-1111-4111-8111-111111111111";
const request = (query = "", id = userId) => GET(new Request(`http://localhost/api/admin/users/${id}/activity${query}`), { params: Promise.resolve({ userId: id }) });

beforeEach(() => {
  vi.resetAllMocks();
  requireOwnerMock.mockResolvedValue({ id: "owner-1" });
  getUserActivityMock.mockResolvedValue({ entries: [{ id: "record-1" }], total: 1, page: 0, pageSize: 10 });
  recordAuditEventMock.mockResolvedValue(undefined);
});

describe("owner-only user activity", () => {
  it.each([401, 403] as const)("denies unauthorized access (%i) before any privileged read", async (status) => {
    requireOwnerMock.mockRejectedValue(new FakeAdminAuthError("Denied", status));
    expect((await request()).status).toBe(status);
    expect(getUserActivityMock).not.toHaveBeenCalled();
    expect(recordAuditEventMock).not.toHaveBeenCalled();
  });

  it("fails closed on unexpected authorization errors", async () => {
    requireOwnerMock.mockRejectedValue(new Error("database unavailable"));
    expect((await request()).status).toBe(503);
    expect(getUserActivityMock).not.toHaveBeenCalled();
  });

  it.each(["?page=-1", "?pageSize=51", "?page=1.5", "?kind=secrets", "?user_id=someone-else"])("rejects invalid query %s", async (query) => {
    expect((await request(query)).status).toBe(400);
    expect(getUserActivityMock).not.toHaveBeenCalled();
  });

  it("rejects invalid user ids", async () => {
    expect((await request("", "bad-id")).status).toBe(400);
    expect(getUserActivityMock).not.toHaveBeenCalled();
  });

  it.each(["applications", "parsing"])("returns paginated %s and audits access without content", async (kind) => {
    const response = await request(`?kind=${kind}&page=2&pageSize=5`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(getUserActivityMock).toHaveBeenCalledWith(userId, kind, 2, 5);
    expect(recordAuditEventMock).toHaveBeenCalledWith({
      actorUserId: "owner-1", targetUserId: userId, actionType: `user_${kind}_viewed`,
      metadata: { page: 2, pageSize: 5, records: 1 }, requestId: expect.any(String),
    });
  });

  it("returns 404 only for a missing user", async () => {
    getUserActivityMock.mockResolvedValue(null);
    expect((await request()).status).toBe(404);
    expect(recordAuditEventMock).not.toHaveBeenCalled();
  });

  it.each(["data", "audit"])("does not expose records when %s storage fails", async (failure) => {
    (failure === "data" ? getUserActivityMock : recordAuditEventMock).mockRejectedValue(new Error("internal detail"));
    const response = await request();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("record-1");
  });
});
