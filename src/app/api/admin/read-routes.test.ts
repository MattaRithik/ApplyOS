import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
}));

class FakeAdminAuthError extends Error {
  status: 401 | 403;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.status = status;
  }
}

const requireOwnerMock = vi.fn();
vi.mock("@/lib/admin/roles", () => ({
  requireOwner: requireOwnerMock,
  AdminAuthError: FakeAdminAuthError,
}));

const getOverviewMock = vi.fn(async () => ({ totalUsers: 0, usersWithAiAccess: 0, suspendedAiAccess: 0, aiRequestsThisMonth: 0, aiCostThisMonthUsd: 0 }));
const listUsersMock = vi.fn(async () => ({ users: [], total: 0, page: 0, pageSize: 25 }));
vi.mock("@/lib/admin/users", () => ({
  getOverview: getOverviewMock,
  listUsers: listUsersMock,
}));

const listAuditLogMock = vi.fn(async () => ({ entries: [], total: 0, page: 0, pageSize: 25 }));
vi.mock("@/lib/admin/audit", () => ({
  listAuditLog: listAuditLogMock,
}));

const { GET: overviewGET } = await import("@/app/api/admin/overview/route");
const { GET: usersGET } = await import("@/app/api/admin/users/route");
const { GET: auditLogGET } = await import("@/app/api/admin/audit-log/route");

const OWNER = { id: "owner-1", email: "owner@example.com" };

beforeEach(() => {
  vi.clearAllMocks();
});

describe("owner-only GET admin routes", () => {
  it("overview: rejects a non-owner with 403 and reveals no data", async () => {
    requireOwnerMock.mockRejectedValueOnce(new FakeAdminAuthError("Owner access required.", 403));
    const res = await overviewGET();
    expect(res.status).toBe(403);
    expect(getOverviewMock).not.toHaveBeenCalled();
  });

  it("overview: succeeds for the owner", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await overviewGET();
    expect(res.status).toBe(200);
  });

  it("users list: rejects a non-owner with 403 without touching listUsers", async () => {
    requireOwnerMock.mockRejectedValueOnce(new FakeAdminAuthError("Owner access required.", 403));
    const res = await usersGET(new Request("http://localhost/api/admin/users?search=anyone"));
    expect(res.status).toBe(403);
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("users list: caps pageSize and rejects invalid pagination instead of trusting the client", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await usersGET(new Request("http://localhost/api/admin/users?pageSize=999999"));
    expect(res.status).toBe(400);
    expect(listUsersMock).not.toHaveBeenCalled();
  });

  it("users list: passes through validated search/page/pageSize for the owner", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await usersGET(new Request("http://localhost/api/admin/users?search=jane&page=2&pageSize=10"));
    expect(res.status).toBe(200);
    expect(listUsersMock).toHaveBeenCalledWith({ search: "jane", page: 2, pageSize: 10 });
  });

  it("audit log: rejects a non-owner with 403", async () => {
    requireOwnerMock.mockRejectedValueOnce(new FakeAdminAuthError("Owner access required.", 403));
    const res = await auditLogGET(new Request("http://localhost/api/admin/audit-log"));
    expect(res.status).toBe(403);
    expect(listAuditLogMock).not.toHaveBeenCalled();
  });

  it("audit log: succeeds for the owner with default pagination", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await auditLogGET(new Request("http://localhost/api/admin/audit-log"));
    expect(res.status).toBe(200);
    expect(listAuditLogMock).toHaveBeenCalledWith(0, 25);
  });
});
