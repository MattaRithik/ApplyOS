import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface EntitlementActionParams {
  actorUserId: string;
  targetUserId: string;
  requestId?: string;
}

async function mutateEntitlement(
  params: EntitlementActionParams,
  action: "grant" | "revoke" | "suspend" | "reactivate" | "update_limits",
  patch: Record<string, unknown> = {}
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.rpc("admin_mutate_ai_entitlement", {
    p_actor_user_id: params.actorUserId,
    p_target_user_id: params.targetUserId,
    p_action: action,
    p_patch: patch,
    p_request_id: params.requestId ?? null,
  });
  if (error) throw new Error("Failed to update AI access.");
}

export async function grantAIAccess(params: EntitlementActionParams): Promise<void> {
  await mutateEntitlement(params, "grant");
}

export async function revokeAIAccess(params: EntitlementActionParams): Promise<void> {
  await mutateEntitlement(params, "revoke");
}

export interface SuspendParams extends EntitlementActionParams {
  reason?: string;
}

export async function suspendAIAccess(params: SuspendParams): Promise<void> {
  await mutateEntitlement(params, "suspend", params.reason ? { reason: params.reason } : {});
}

export async function reactivateAIAccess(params: EntitlementActionParams): Promise<void> {
  await mutateEntitlement(params, "reactivate");
}

export interface UpdateLimitsParams extends EntitlementActionParams {
  dailyRequestLimit?: number | null;
  monthlyBudgetUsd?: number | null;
  expiresAt?: string | null;
}

/** Fields left undefined (vs. explicit null) are omitted from the patch entirely, so a partial call only touches the limits it names. */
export async function updateAILimits(params: UpdateLimitsParams): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (params.dailyRequestLimit !== undefined) patch.daily_request_limit = params.dailyRequestLimit;
  if (params.monthlyBudgetUsd !== undefined) patch.monthly_budget_usd = params.monthlyBudgetUsd;
  if (params.expiresAt !== undefined) patch.expires_at = params.expiresAt;

  await mutateEntitlement(params, "update_limits", {
    ...(params.dailyRequestLimit !== undefined ? { dailyRequestLimit: params.dailyRequestLimit } : {}),
    ...(params.monthlyBudgetUsd !== undefined ? { monthlyBudgetUsd: params.monthlyBudgetUsd } : {}),
    ...(params.expiresAt !== undefined ? { expiresAt: params.expiresAt } : {}),
  });
}
