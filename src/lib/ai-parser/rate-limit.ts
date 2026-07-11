import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type RateLimitBlockReason = "minute_limit" | "daily_limit" | "concurrency_limit";

export type AcquireSlotResult =
  | { ok: true; usageRowId: string }
  | { ok: false; reason: RateLimitBlockReason };

export interface RateLimitConfig {
  minuteLimit: number;
  dailyLimit: number;
  concurrencyLimit: number;
}

/**
 * `dailyLimit` is the caller-resolved effective limit (user-specific
 * entitlement, else AI_PARSER_DEFAULT_DAILY_LIMIT, else a hardcoded
 * fallback — see ai-parser/entitlement.ts#resolveEffectiveLimits).
 * Minute/concurrency limits stay global env settings; they're not part
 * of the per-user entitlement model.
 */
export function getRateLimitConfig(dailyLimit: number): RateLimitConfig {
  const boundedPositiveInt = (raw: string | undefined, fallback: number, max: number) => {
    const value = Number(raw);
    return Number.isInteger(value) && value > 0 ? Math.min(value, max) : fallback;
  };
  return {
    minuteLimit: boundedPositiveInt(process.env.AI_PARSER_MINUTE_LIMIT, 5, 100),
    dailyLimit: Number.isInteger(dailyLimit) && dailyLimit > 0 ? Math.min(dailyLimit, 10_000) : 100,
    concurrencyLimit: boundedPositiveInt(process.env.AI_PARSER_CONCURRENCY_LIMIT, 2, 10),
  };
}

/**
 * Atomically checks per-minute/daily/concurrency limits and inserts a
 * `pending` usage row in one transaction via a Postgres RPC, using the
 * service-role client (never exposed to browser clients).
 */
export async function acquireParseSlot(userId: string, config: RateLimitConfig): Promise<AcquireSlotResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .rpc("ai_parser_try_acquire_slot", {
      p_user_id: userId,
      p_minute_limit: config.minuteLimit,
      p_daily_limit: config.dailyLimit,
      p_concurrency_limit: config.concurrencyLimit,
    })
    .single();

  if (error || !data) {
    // Fail closed: if the RPC itself errors, treat it as blocked rather
    // than silently allowing unlimited requests through.
    return { ok: false, reason: "daily_limit" };
  }

  const row = data as { ok: boolean; reason: string | null; usage_id: string | null };
  if (!row.ok || !row.usage_id) {
    return { ok: false, reason: (row.reason as RateLimitBlockReason) ?? "daily_limit" };
  }
  return { ok: true, usageRowId: row.usage_id };
}

export interface FinalizeUsagePatch {
  status: "success" | "failed" | "cache_hit";
  requestId?: string;
  provider?: string;
  model?: string | null;
  fallbackUsed?: boolean;
  initialModel?: string | null;
  finalModel?: string | null;
  cacheHit?: boolean;
  inputCharacters?: number;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cachedInputTokens?: number;
  reasoningTokens?: number;
  providerRequestCount?: number;
  estimatedInputCostUsd?: number;
  estimatedCachedInputCostUsd?: number;
  estimatedOutputCostUsd?: number;
  estimatedTotalCostUsd?: number;
  latencyMs?: number;
  errorCategory?: string;
  parserSchemaVersion?: string;
  promptVersion?: string;
  descriptionHash?: string;
}

const PATCH_KEY_MAP: Record<keyof FinalizeUsagePatch, string> = {
  status: "status",
  requestId: "request_id",
  provider: "provider",
  model: "model",
  fallbackUsed: "fallback_used",
  initialModel: "initial_model",
  finalModel: "final_model",
  cacheHit: "cache_hit",
  inputCharacters: "input_characters",
  inputTokens: "input_tokens",
  outputTokens: "output_tokens",
  totalTokens: "total_tokens",
  cachedInputTokens: "cached_input_tokens",
  reasoningTokens: "reasoning_tokens",
  providerRequestCount: "provider_request_count",
  estimatedInputCostUsd: "estimated_input_cost_usd",
  estimatedCachedInputCostUsd: "estimated_cached_input_cost_usd",
  estimatedOutputCostUsd: "estimated_output_cost_usd",
  estimatedTotalCostUsd: "estimated_total_cost_usd",
  latencyMs: "latency_ms",
  errorCategory: "error_category",
  parserSchemaVersion: "parser_schema_version",
  promptVersion: "prompt_version",
  descriptionHash: "description_hash",
};

export async function finalizeUsageRow(usageRowId: string, patch: FinalizeUsagePatch): Promise<void> {
  const supabase = createServiceRoleClient();
  const dbPatch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    const column = PATCH_KEY_MAP[key as keyof FinalizeUsagePatch];
    if (column) dbPatch[column] = value;
  }
  const { error } = await supabase.from("ai_parser_usage").update(dbPatch).eq("id", usageRowId);
  if (error) throw new Error("Failed to finalize parser usage.");
}
