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

const sendPasswordResetForUserMock = vi.fn(async () => ({ ok: true }));
const revokeSessionsForUserMock = vi.fn(async () => ({ ok: true }));
const disableUserMock = vi.fn(async () => ({ ok: true }));
const enableUserMock = vi.fn(async () => ({ ok: true }));
vi.mock("@/lib/admin/security", () => ({
  sendPasswordResetForUser: sendPasswordResetForUserMock,
  revokeSessionsForUser: revokeSessionsForUserMock,
  disableUser: disableUserMock,
  enableUser: enableUserMock,
}));

const { POST } = await import("@/app/api/admin/users/[userId]/security/route");

const OWNER = { id: "owner-1", email: "owner@example.com" };
const TARGET_ID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function makeRequest(body: unknown) {
  return new Request(`http://localhost/api/admin/users/${TARGET_ID}/security`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function callPost(body: unknown) {
  return POST(makeRequest(body), { params: Promise.resolve({ userId: TARGET_ID }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  checkRecentActionRateMock.mockResolvedValue(true);
  getUserDetailMock.mockResolvedValue({ id: TARGET_ID, email: "user@example.com" });
  sendPasswordResetForUserMock.mockResolvedValue({ ok: true });
  revokeSessionsForUserMock.mockResolvedValue({ ok: true });
  disableUserMock.mockResolvedValue({ ok: true });
  enableUserMock.mockResolvedValue({ ok: true });
});

describe("POST /api/admin/users/[userId]/security", () => {
  it("returns 403 for a non-owner and never sends a reset email", async () => {
    requireOwnerMock.mockRejectedValueOnce(new FakeAdminAuthError("Owner access required.", 403));
    const res = await callPost({ action: "send_password_reset", confirm: true });
    expect(res.status).toBe(403);
    expect(sendPasswordResetForUserMock).not.toHaveBeenCalled();
  });

  it("rejects send_password_reset without confirm:true", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPost({ action: "send_password_reset" });
    expect(res.status).toBe(400);
    expect(sendPasswordResetForUserMock).not.toHaveBeenCalled();
  });

  it("rejects an unknown action", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPost({ action: "delete_forever", confirm: true });
    expect(res.status).toBe(400);
  });

  it("never lets the browser substitute a different target email — the target's email is resolved server-side by getUserDetail/security lib, not from the request body", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPost({ action: "send_password_reset", confirm: true, email: "attacker@example.com" });
    // Extra "email" field is rejected by the strict schema — the body has no
    // legitimate way to influence which address receives the reset link.
    expect(res.status).toBe(400);
    expect(sendPasswordResetForUserMock).not.toHaveBeenCalled();
  });

  it("rate-limits repeated password-reset requests for the same target", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    checkRecentActionRateMock.mockResolvedValueOnce(false);
    const res = await callPost({ action: "send_password_reset", confirm: true });
    expect(res.status).toBe(429);
    expect(sendPasswordResetForUserMock).not.toHaveBeenCalled();
  });

  it("sends a password reset for a confirmed owner request", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPost({ action: "send_password_reset", confirm: true });
    expect(res.status).toBe(200);
    expect(sendPasswordResetForUserMock).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: OWNER.id, targetUserId: TARGET_ID }));
  });

  it("never returns a reset token to the browser", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPost({ action: "send_password_reset", confirm: true });
    const json = await res.json();
    expect(JSON.stringify(json)).not.toMatch(/token/i);
  });

  it("allows 'enable' without confirm (non-destructive)", async () => {
    requireOwnerMock.mockResolvedValueOnce(OWNER);
    const res = await callPost({ action: "enable" });
    expect(res.status).toBe(200);
    expect(enableUserMock).toHaveBeenCalled();
  });
});
