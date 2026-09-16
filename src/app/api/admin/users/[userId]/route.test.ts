import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({}) }));
const requireOwner = vi.fn();
class AdminAuthError extends Error { constructor(message: string, public status: number) { super(message); } }
vi.mock("@/lib/admin/roles", () => ({ requireOwner, AdminAuthError }));
vi.mock("@/lib/admin/users", () => ({ getUserDetail: vi.fn() }));
const deleteDisabledUser = vi.fn();
vi.mock("@/lib/admin/delete-user", () => ({ deleteDisabledUser }));
const consumeApiRateLimit = vi.fn();
vi.mock("@/lib/security/rate-limit", () => ({ consumeApiRateLimit }));
const { DELETE } = await import("./route");
const target = "3fa85f64-5717-4562-b3fc-2c963f66afa6";
const body = { confirm: true, acknowledgeDataLoss: true, confirmation: "user@example.com" };
function request(payload: unknown = body, headers: Record<string, string> = {}, userId = target) {
  return DELETE(new Request(`http://localhost/api/admin/users/${userId}`, {
    method: "DELETE", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(payload),
  }), { params: Promise.resolve({ userId }) });
}
beforeEach(() => {
  vi.clearAllMocks();
  requireOwner.mockResolvedValue({ id: "owner-1" });
  consumeApiRateLimit.mockResolvedValue(true);
  deleteDisabledUser.mockResolvedValue({ ok: true });
});
describe("DELETE /api/admin/users/[userId]", () => {
  it.each([401, 403])("rejects unauthorized callers (%s)", async (status) => {
    requireOwner.mockRejectedValueOnce(new AdminAuthError("Denied", status));
    expect((await request()).status).toBe(status);
    expect(deleteDisabledUser).not.toHaveBeenCalled();
  });
  it("rejects cross-site requests before authorization", async () => {
    expect((await request(body, { origin: "https://other.example" })).status).toBe(403);
    expect(requireOwner).not.toHaveBeenCalled();
    expect(deleteDisabledUser).not.toHaveBeenCalled();
  });
  it.each([
    { ...body, confirm: false }, { ...body, acknowledgeDataLoss: false },
    { confirm: true }, { ...body, confirmation: " " }, { ...body, targetUserId: "someone-else" },
  ])("requires complete, strict confirmations: %j", async (payload) => {
    expect((await request(payload)).status).toBe(400);
    expect(deleteDisabledUser).not.toHaveBeenCalled();
  });
  it("rejects invalid IDs", async () => {
    expect((await request(body, {}, "invalid")).status).toBe(400);
    expect(deleteDisabledUser).not.toHaveBeenCalled();
  });
  it("enforces rate limits", async () => {
    consumeApiRateLimit.mockResolvedValueOnce(false);
    expect((await request()).status).toBe(429);
    expect(deleteDisabledUser).not.toHaveBeenCalled();
  });
  it("uses the authorized actor and URL target", async () => {
    expect((await request()).status).toBe(200);
    expect(deleteDisabledUser).toHaveBeenCalledWith({ actorUserId: "owner-1", targetUserId: target, confirmation: body.confirmation, requestId: expect.any(String) });
  });
  it("returns active-account conflicts", async () => {
    deleteDisabledUser.mockResolvedValueOnce({ ok: false, status: 409, error: "Disable this account before deleting it." });
    expect((await request()).status).toBe(409);
  });
  it("does not expose internal errors", async () => {
    deleteDisabledUser.mockRejectedValueOnce(new Error("secret internal detail"));
    const res = await request();
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("secret internal detail");
  });
});
