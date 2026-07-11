import { describe, expect, it, vi, beforeEach } from "vitest";

const getUserByIdMock =
  vi.fn<(uid: string) => Promise<{ data: { user: { id: string; email: string; email_confirmed_at: string } } | null; error: { message: string } | null }>>();
const resetPasswordForEmailMock = vi.fn<(email: string) => Promise<{ error: { message: string } | null }>>();
const updateUserByIdMock =
  vi.fn<(uid: string, attrs: { password?: string; ban_duration?: string }) => Promise<{ error: { message: string } | null }>>();

vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({
    auth: {
      admin: { getUserById: getUserByIdMock, updateUserById: updateUserByIdMock },
      resetPasswordForEmail: resetPasswordForEmailMock,
    },
  }),
}));

const recordAuditEventMock = vi.fn<(input: Record<string, unknown>) => Promise<void>>();
vi.mock("@/lib/admin/audit", () => ({
  recordAuditEvent: recordAuditEventMock,
}));

const { sendPasswordResetForUser, revokeSessionsForUser, disableUser, enableUser } = await import("@/lib/admin/security");

const PARAMS = { actorUserId: "owner-1", targetUserId: "user-1", requestId: "req-1" };

beforeEach(() => {
  vi.clearAllMocks();
  getUserByIdMock.mockResolvedValue({
    data: { user: { id: "user-1", email: "user@example.com", email_confirmed_at: "2026-01-01T00:00:00Z" } },
    error: null,
  });
  resetPasswordForEmailMock.mockResolvedValue({ error: null });
  updateUserByIdMock.mockResolvedValue({ error: null });
});

describe("sendPasswordResetForUser", () => {
  it("resolves the email server-side from the target user record, never from the caller", async () => {
    const result = await sendPasswordResetForUser(PARAMS);
    expect(result.ok).toBe(true);
    expect(resetPasswordForEmailMock).toHaveBeenCalledWith("user@example.com");
  });

  it("fails gracefully when the target user doesn't exist", async () => {
    getUserByIdMock.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    const result = await sendPasswordResetForUser(PARAMS);
    expect(result.ok).toBe(false);
  });

  it("does not send reset mail to an unverified address", async () => {
    getUserByIdMock.mockResolvedValueOnce({
      data: { user: { id: "user-1", email: "user@example.com", email_confirmed_at: "" } },
      error: null,
    });
    const result = await sendPasswordResetForUser(PARAMS);
    expect(result.ok).toBe(false);
    expect(resetPasswordForEmailMock).not.toHaveBeenCalled();
  });

  it("audits the action without ever including a token or email content", async () => {
    await sendPasswordResetForUser(PARAMS);
    expect(recordAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "password_reset_sent", targetUserId: "user-1" })
    );
    const call = recordAuditEventMock.mock.calls[0][0] as Record<string, unknown>;
    expect(JSON.stringify(call)).not.toMatch(/token/i);
    expect(JSON.stringify(call)).not.toContain("user@example.com");
  });

  it("sanitizes provider errors instead of leaking raw Supabase error details", async () => {
    resetPasswordForEmailMock.mockResolvedValueOnce({ error: { message: "some internal Supabase detail" } });
    const result = await sendPasswordResetForUser(PARAMS);
    expect(result.ok).toBe(false);
    expect(result.error).not.toMatch(/internal Supabase detail/);
  });
});

describe("revokeSessionsForUser", () => {
  it("rotates the password to a fresh random secret and audits sessions_revoked", async () => {
    const result = await revokeSessionsForUser(PARAMS);
    expect(result.ok).toBe(true);
    expect(updateUserByIdMock).toHaveBeenCalledWith("user-1", { password: expect.any(String) });
    const [, attrs] = updateUserByIdMock.mock.calls[0];
    expect((attrs as { password: string }).password.length).toBeGreaterThan(20);
    expect(recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ actionType: "sessions_revoked" }));
  });

  it("never logs the generated password anywhere in the audit event", async () => {
    await revokeSessionsForUser(PARAMS);
    const call = recordAuditEventMock.mock.calls[0][0];
    expect(JSON.stringify(call)).not.toContain((updateUserByIdMock.mock.calls[0][1] as { password: string }).password);
  });
});

describe("disableUser / enableUser", () => {
  it("bans the account with a long ban_duration and audits user_disabled", async () => {
    await disableUser(PARAMS);
    expect(updateUserByIdMock).toHaveBeenCalledWith("user-1", { ban_duration: "876000h" });
    expect(recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ actionType: "user_disabled" }));
  });

  it("clears the ban and audits user_enabled", async () => {
    await enableUser(PARAMS);
    expect(updateUserByIdMock).toHaveBeenCalledWith("user-1", { ban_duration: "none" });
    expect(recordAuditEventMock).toHaveBeenCalledWith(expect.objectContaining({ actionType: "user_enabled" }));
  });
});
