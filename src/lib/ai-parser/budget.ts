import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

export interface BudgetCheckResult {
  ok: boolean;
  spentUsd: number;
  limitUsd: number | null;
}

/**
 * Sums estimated_total_cost_usd for the given user for the current
 * calendar month (UTC — chosen for simplicity and determinism across
 * server regions; this is an internal monitoring figure, not a
 * billing-accurate cutoff) and compares it against the caller-supplied
 * limit (resolved by the caller via
 * ai-parser/entitlement.ts#resolveEffectiveLimits — user-specific
 * entitlement, else the AI_PARSER_DEFAULT_MONTHLY_BUDGET_USD env
 * default, else no limit). Scoped strictly to `userId` so one user's
 * spend never blocks another's.
 */
export async function checkMonthlyBudget(
  userId: string,
  limitUsd: number | null,
): Promise<BudgetCheckResult> {
  const now = new Date();
  const monthStartUtc = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("ai_parser_cost_total", {
    p_user_id: userId,
    p_since: monthStartUtc,
  });

  const spentUsd = Number(data);
  if (error || data === null || !Number.isFinite(spentUsd) || spentUsd < 0) {
    // Fail closed on unexpected DB errors when a limit is configured.
    return { ok: limitUsd === null, spentUsd: 0, limitUsd };
  }

  const ok = limitUsd === null || spentUsd < limitUsd;
  return { ok, spentUsd, limitUsd };
}
