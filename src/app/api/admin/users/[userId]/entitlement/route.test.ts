import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({}),
}));

vi.mock("@/lib/security/rate-limit", () => ({ consumeApiRateLimit: async () => true }));

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

const getUserDetailMock = vi.fn();
vi.mock("@/lib/admin/users", () => ({
  getUserDetail: getUserDetailMock,
}));

const checkRecentActionRateMock = vi.fn(async () => true);
vi.mock("@/lib/admin/audit", () => ({
  checkRecentActionRate: checkRecentActionRateMock,
}));

const grantAIAccessMock = vi.fn();
const revokeAIAccessMock = vi.fn();
const suspendAIAccessMock = vi.fn();
const reactivateAIAccessMock = vi.fn();
const updateAILimitsMock = vi.fn();
vi.mock("@/lib/admin/entitlements", () => ({
  grantAIAccess: grantAIAccessMock,
  revokeAIAccess: revokeAIAccessMock,
  suspendAIAccess: suspendAIAccessMock,
  reactivateAIAccess: reactivateAIAccessMock,
  updateAILimits: updateAILimitsMock,
}));

const { PATCH } = await import("@/app/api/admin/users/[userId]/entitlement/route");

const OWNER = { id: "owner-1", email: "owner@example.com" };
const TARGET_ID = "9b11d25c-506c-4234-bf79-e38eb3907d4d";

function makeRequest(body: unknown) {
  return new Request(`http://localhost/api/admin/users/${TARGET_ID}/entitlement`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callPatch(userId: string, body: unknown) {
  return PATCH(makeRequest(body), { params: Promise.resolve({ userId }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRecentActionRateMock.mockResolvedValue(true);
  getUserDetailMock.mockResolvedValue({ id: TARGET_ID, email: "user@example.com" });
});

describe("PATCH /api/admin/users/[userId]/entitlement", () => {
  it("rejects a non-UUID user id with 400 before ever checking ownership", async () => {
    const res = await callPatch("not-a-uuid", { action: "grant" });
    expect(res.status).toBe(400);
    expect(requireOwnerMock).not.toHaveBeenCalled();
  });

  it("returns 401 when there is no session", async () => {
    requireOwnerMock.mockRejectedValueOnce(new FakeAdminAuthError("Not authenticated.", 401));
    const res = await callPatch(TARGET_ID, { action: "grant" });
    expect(res.status).toBe(401);
    expect(grantAIAccessMock).not.toHaveBeenCalled();
  });

  it("returns 403 for an authenticated non-owner and performs no mutation (IDOR/privilege-escalation guard)", async () => {
    requireOwnerMock.mockRejectedValueOnce(new FakeAdminAuthError("Owner access required.", 403));
    const res = await callPatch(TARGET_ID, { action: "revoke", confirm: true });
    expect(res.status).toBe(403);
    expect(revokeAIAccessMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the target user doesn't exist", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    getUserDetailMock.mockResolvedValueOnce(null);
    const res = await callPatch(TARGET_ID, { action: "grant" });
    expect(res.status).toBe(404);
  });

  it("rejects unknown body properties (mass-assignment guard)", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPatch(TARGET_ID, { action: "grant", role: "owner" });
    expect(res.status).toBe(400);
    expect(grantAIAccessMock).not.toHaveBeenCalled();
  });

  it("rejects 'revoke' without an explicit confirm:true", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPatch(TARGET_ID, { action: "revoke" });
    expect(res.status).toBe(400);
    expect(revokeAIAccessMock).not.toHaveBeenCalled();
  });

  it("rejects 'suspend' without an explicit confirm:true", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPatch(TARGET_ID, { action: "suspend" });
    expect(res.status).toBe(400);
    expect(suspendAIAccessMock).not.toHaveBeenCalled();
  });

  it("grants access for a confirmed owner request and audits with the resolved target id", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPatch(TARGET_ID, { action: "grant" });
    expect(res.status).toBe(200);
    expect(grantAIAccessMock).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: OWNER.id, targetUserId: TARGET_ID }));
  });

  it("rate-limits repeated suspend attempts against the same target", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    checkRecentActionRateMock.mockResolvedValueOnce(false);
    const res = await callPatch(TARGET_ID, { action: "suspend", confirm: true });
    expect(res.status).toBe(429);
    expect(suspendAIAccessMock).not.toHaveBeenCalled();
  });

  it("rejects a negative daily request limit", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPatch(TARGET_ID, { action: "update_limits", dailyRequestLimit: -5 });
    expect(res.status).toBe(400);
    expect(updateAILimitsMock).not.toHaveBeenCalled();
  });

  it("allows update_limits to explicitly clear a limit with null", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPatch(TARGET_ID, { action: "update_limits", dailyRequestLimit: null });
    expect(res.status).toBe(200);
    expect(updateAILimitsMock).toHaveBeenCalledWith(expect.objectContaining({ dailyRequestLimit: null }));
  });
});
