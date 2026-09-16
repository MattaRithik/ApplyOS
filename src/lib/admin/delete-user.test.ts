import { beforeEach, describe, expect, it, vi } from "vitest";

const getUserById = vi.fn();
const deleteUser = vi.fn();
const roleQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), maybeSingle: vi.fn() };
const resumeQuery = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), order: vi.fn().mockReturnThis(), range: vi.fn() };
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({ auth: { admin: { getUserById, deleteUser } },
    from: (table: string) => table === "app_user_roles" ? roleQuery : resumeQuery }),
}));
const recordAuditEvent = vi.fn();
vi.mock("@/lib/admin/audit", () => ({ recordAuditEvent }));
const deleteResumeObject = vi.fn();
vi.mock("@/lib/storage/b2", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/storage/b2")>(), deleteResumeObject,
}));
const { deleteDisabledUser } = await import("./delete-user");
const params = { actorUserId: "owner-1", targetUserId: "user-1", confirmation: "user@example.com", requestId: "req-1" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("APP_OWNER_EMAIL", "owner@example.com");
  getUserById.mockResolvedValue({ data: { user: { id: "user-1", email: "user@example.com", banned_until: "2999-01-01T00:00:00Z" } }, error: null });
  deleteUser.mockResolvedValue({ error: null });
  roleQuery.maybeSingle.mockResolvedValue({ data: null, error: null });
  resumeQuery.range.mockResolvedValue({ data: [{ id: "resume-1", storage_key: "users/user-1/resumes/file.pdf" }], error: null });
  deleteResumeObject.mockResolvedValue(undefined);
  recordAuditEvent.mockResolvedValue(undefined);
});

describe("disabled account deletion", () => {
  it("deletes linked files and auth account, retaining an audit trail without a dangling foreign key", async () => {
    expect(await deleteDisabledUser(params)).toEqual({ ok: true });
    expect(resumeQuery.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(deleteResumeObject).toHaveBeenCalledWith("users/user-1/resumes/file.pdf");
    expect(deleteUser).toHaveBeenCalledWith("user-1", false);
    expect(deleteResumeObject.mock.invocationCallOrder[0]).toBeLessThan(deleteUser.mock.invocationCallOrder[0]);
    expect(recordAuditEvent).toHaveBeenLastCalledWith({ actorUserId: "owner-1", requestId: "req-1", actionType: "user_deleted", metadata: { deletedUserId: "user-1" } });
  });

  it.each([undefined, "2020-01-01T00:00:00Z"])("rejects an active account (ban: %s)", async (banned_until) => {
    getUserById.mockResolvedValue({ data: { user: { id: "user-1", email: params.confirmation, banned_until } }, error: null });
    expect(await deleteDisabledUser(params)).toMatchObject({ ok: false, status: 409 });
    expect(deleteUser).not.toHaveBeenCalled();
    expect(deleteResumeObject).not.toHaveBeenCalled();
  });

  it("rejects a missing account", async () => {
    getUserById.mockResolvedValue({ data: { user: null }, error: { message: "not found" } });
    expect(await deleteDisabledUser(params)).toMatchObject({ ok: false, status: 404 });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("rejects self-deletion", async () => {
    expect(await deleteDisabledUser({ ...params, targetUserId: params.actorUserId })).toMatchObject({ ok: false, status: 400 });
    expect(getUserById).not.toHaveBeenCalled();
  });

  it.each(["role", "email"])("protects the owner by %s", async (source) => {
    if (source === "role") roleQuery.maybeSingle.mockResolvedValue({ data: { role: "owner", revoked_at: null }, error: null });
    else vi.stubEnv("APP_OWNER_EMAIL", " USER@example.com ");
    expect(await deleteDisabledUser(params)).toMatchObject({ ok: false, status: 400 });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("fails closed if the role cannot be checked", async () => {
    roleQuery.maybeSingle.mockResolvedValue({ data: null, error: { message: "unavailable" } });
    await expect(deleteDisabledUser(params)).rejects.toThrow("role");
    expect(deleteResumeObject).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("rejects a typed confirmation for a different account", async () => {
    expect(await deleteDisabledUser({ ...params, confirmation: "wrong@example.com" })).toMatchObject({ ok: false, status: 400 });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("supports accounts without email by requiring their user ID", async () => {
    getUserById.mockResolvedValue({ data: { user: { id: "user-1", banned_until: "2999-01-01T00:00:00Z" } }, error: null });
    expect(await deleteDisabledUser({ ...params, confirmation: "user-1" })).toEqual({ ok: true });
  });

  it("does not begin deletion if the audit request cannot be saved", async () => {
    recordAuditEvent.mockRejectedValueOnce(new Error("audit unavailable"));
    await expect(deleteDisabledUser(params)).rejects.toThrow("audit unavailable");
    expect(deleteResumeObject).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("retains file references and the account when cleanup fails", async () => {
    deleteResumeObject.mockRejectedValueOnce(new Error("storage unavailable"));
    expect(await deleteDisabledUser(params)).toMatchObject({ ok: false, status: 502 });
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("rejects a linked file belonging to another account", async () => {
    resumeQuery.range.mockResolvedValue({ data: [{ storage_key: "users/someone-else/resumes/file.pdf" }], error: null });
    expect(await deleteDisabledUser(params)).toMatchObject({ ok: false, status: 502 });
    expect(deleteResumeObject).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("cleans up every page of linked files", async () => {
    resumeQuery.range.mockResolvedValueOnce({ data: Array.from({ length: 100 }, (_, i) => ({ storage_key: `users/user-1/resumes/${i}.pdf` })), error: null });
    expect(await deleteDisabledUser(params)).toEqual({ ok: true });
    expect(deleteResumeObject).toHaveBeenCalledTimes(101);
    expect(resumeQuery.range).toHaveBeenNthCalledWith(2, 100, 199);
  });

  it("reports provider deletion failures without recording success", async () => {
    deleteUser.mockResolvedValueOnce({ error: { message: "internal detail" } });
    const result = await deleteDisabledUser(params);
    expect(result).toMatchObject({ ok: false, status: 502 });
    expect(JSON.stringify(result)).not.toContain("internal detail");
    expect(recordAuditEvent).toHaveBeenCalledTimes(1);
  });

  it("reports committed deletion as success even if the completion audit fails", async () => {
    recordAuditEvent.mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("audit unavailable"));
    expect(await deleteDisabledUser(params)).toMatchObject({ ok: true, warning: expect.any(String) });
  });
});
