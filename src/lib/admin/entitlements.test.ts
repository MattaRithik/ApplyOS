import { beforeEach, describe, expect, it, vi } from "vitest";

const rpcMock = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createServiceRoleClient: () => ({ rpc: rpcMock }),
}));

const { grantAIAccess, revokeAIAccess, suspendAIAccess, reactivateAIAccess, updateAILimits } = await import(
  "@/lib/admin/entitlements"
);

const PARAMS = { actorUserId: "owner-1", targetUserId: "user-1", requestId: "req-1" };

beforeEach(() => {
  vi.clearAllMocks();
  rpcMock.mockResolvedValue({ data: null, error: null });
});

function expectAtomicCall(action: string, patch: Record<string, unknown> = {}) {
  expect(rpcMock).toHaveBeenCalledWith("admin_mutate_ai_entitlement", {
    p_actor_user_id: "owner-1",
    p_target_user_id: "user-1",
    p_action: action,
    p_patch: patch,
    p_request_id: "req-1",
  });
}

describe("atomic AI entitlement mutations", () => {
  it("grants and revokes through the audited transaction RPC", async () => {
    await grantAIAccess(PARAMS);
    expectAtomicCall("grant");
    await revokeAIAccess(PARAMS);
    expectAtomicCall("revoke");
  });

  it("passes a suspension reason only into the server-side transaction", async () => {
    await suspendAIAccess({ ...PARAMS, reason: "abuse investigation" });
    expectAtomicCall("suspend", { reason: "abuse investigation" });
    await reactivateAIAccess(PARAMS);
    expectAtomicCall("reactivate");
  });

  it("preserves omitted limits while allowing explicit null", async () => {
    await updateAILimits({ ...PARAMS, dailyRequestLimit: 10, monthlyBudgetUsd: null });
    expectAtomicCall("update_limits", { dailyRequestLimit: 10, monthlyBudgetUsd: null });
  });

  it("fails closed when the transaction RPC fails", async () => {
    rpcMock.mockResolvedValueOnce({ data: null, error: { message: "db unavailable" } });
    await expect(grantAIAccess(PARAMS)).rejects.toThrow("Failed to update AI access.");
  });
});
