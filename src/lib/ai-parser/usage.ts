import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { finalizeUsageRow, type FinalizeUsagePatch } from "@/lib/ai-parser/rate-limit";

export const recordUsage = finalizeUsageRow;
export type { FinalizeUsagePatch };

export type UsageRange = "today" | "7d" | "month" | "30d" | "all";

interface UsageRow {
  id: string;
  created_at: string;
  model: string | null;
  status: string;
  cache_hit: boolean;
  fallback_used: boolean;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_total_cost_usd: number | null;
  latency_ms: number | null;
}

export interface ModelBreakdown {
  model: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  percentOfTotalCost: number;
  avgLatencyMs: number;
  successRate: number;
}

export interface UsageSummary {
  range: UsageRange;
  totals: {
    requests: number;
    successful: number;
    failed: number;
    cacheHits: number;
    fallbackUses: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    totalCostUsd: number;
    avgCostPerSuccessfulParseUsd: number;
    avgLatencyMs: number;
  };
  spend: {
    todayUsd: number;
    monthUsd: number;
    allTimeUsd: number;
  };
  perModel: ModelBreakdown[];
  recentActivity: {
    id: string;
    createdAt: string;
    model: string | null;
    status: string;
    cacheHit: boolean;
    fallbackUsed: boolean;
    totalTokens: number | null;
    costUsd: number | null;
    latencyMs: number | null;
  }[];
}

function rangeStartUtc(range: UsageRange, now: Date): string | null {
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  switch (range) {
    case "today":
      return startOfDay.toISOString();
    case "7d":
      return new Date(startOfDay.getTime() - 6 * 24 * 60 * 60 * 1000).toISOString();
    case "30d":
      return new Date(startOfDay.getTime() - 29 * 24 * 60 * 60 * 1000).toISOString();
    case "month":
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
    case "all":
    default:
      return null;
  }
}

/**
 * Server-side aggregation for the Settings AI Usage tab. Scoped to
 * `userId` explicitly even though it runs on the service-role client —
 * route-level auth already gates this to the single authorized account,
 * but we still filter by user_id defensively rather than reading all rows.
 */
export async function getUsageSummary(userId: string, range: UsageRange): Promise<UsageSummary> {
  const supabase = createServiceRoleClient();
  const now = new Date();
  const since = rangeStartUtc(range, now);

  let query = supabase
    .from("ai_parser_usage")
    .select("id, created_at, model, status, cache_hit, fallback_used, input_tokens, output_tokens, total_tokens, estimated_total_cost_usd, latency_ms")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (since) query = query.gte("created_at", since);

  const { data } = await query.limit(2000);
  const rows: UsageRow[] = (data as UsageRow[] | null) ?? [];

  const todayStart = rangeStartUtc("today", now)!;
  const monthStart = rangeStartUtc("month", now)!;

  const [{ data: todayRows }, { data: monthRows }, { data: allRows }] = await Promise.all([
    supabase.from("ai_parser_usage").select("estimated_total_cost_usd").eq("user_id", userId).gte("created_at", todayStart),
    supabase.from("ai_parser_usage").select("estimated_total_cost_usd").eq("user_id", userId).gte("created_at", monthStart),
    supabase.from("ai_parser_usage").select("estimated_total_cost_usd").eq("user_id", userId),
  ]);

  const sumCost = (r: { estimated_total_cost_usd: number | null }[] | null) =>
    (r ?? []).reduce((s, row) => s + Number(row.estimated_total_cost_usd ?? 0), 0);

  const successful = rows.filter((r) => r.status === "success");
  const failed = rows.filter((r) => r.status === "failed");
  const cacheHits = rows.filter((r) => r.cache_hit);
  const fallbackUses = rows.filter((r) => r.fallback_used);
  const totalCostUsd = rows.reduce((s, r) => s + Number(r.estimated_total_cost_usd ?? 0), 0);
  const inputTokens = rows.reduce((s, r) => s + Number(r.input_tokens ?? 0), 0);
  const outputTokens = rows.reduce((s, r) => s + Number(r.output_tokens ?? 0), 0);
  const totalTokens = rows.reduce((s, r) => s + Number(r.total_tokens ?? 0), 0);
  const latencies = rows.map((r) => r.latency_ms).filter((v): v is number => typeof v === "number");
  const avgLatencyMs = latencies.length ? latencies.reduce((s, v) => s + v, 0) / latencies.length : 0;
  const avgCostPerSuccessfulParseUsd = successful.length
    ? successful.reduce((s, r) => s + Number(r.estimated_total_cost_usd ?? 0), 0) / successful.length
    : 0;

  const modelKeys = [...new Set(rows.map((r) => r.model).filter((m): m is string => !!m))];
  const perModel: ModelBreakdown[] = modelKeys.map((model) => {
    const modelRows = rows.filter((r) => r.model === model);
    const modelCost = modelRows.reduce((s, r) => s + Number(r.estimated_total_cost_usd ?? 0), 0);
    const modelLatencies = modelRows.map((r) => r.latency_ms).filter((v): v is number => typeof v === "number");
    const modelSuccessful = modelRows.filter((r) => r.status === "success").length;
    return {
      model,
      calls: modelRows.length,
      inputTokens: modelRows.reduce((s, r) => s + Number(r.input_tokens ?? 0), 0),
      outputTokens: modelRows.reduce((s, r) => s + Number(r.output_tokens ?? 0), 0),
      totalTokens: modelRows.reduce((s, r) => s + Number(r.total_tokens ?? 0), 0),
      costUsd: modelCost,
      percentOfTotalCost: totalCostUsd > 0 ? (modelCost / totalCostUsd) * 100 : 0,
      avgLatencyMs: modelLatencies.length ? modelLatencies.reduce((s, v) => s + v, 0) / modelLatencies.length : 0,
      successRate: modelRows.length ? (modelSuccessful / modelRows.length) * 100 : 0,
    };
  });

  return {
    range,
    totals: {
      requests: rows.length,
      successful: successful.length,
      failed: failed.length,
      cacheHits: cacheHits.length,
      fallbackUses: fallbackUses.length,
      inputTokens,
      outputTokens,
      totalTokens,
      totalCostUsd,
      avgCostPerSuccessfulParseUsd,
      avgLatencyMs,
    },
    spend: {
      todayUsd: sumCost(todayRows),
      monthUsd: sumCost(monthRows),
      allTimeUsd: sumCost(allRows),
    },
    perModel,
    recentActivity: rows.slice(0, 50).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      model: r.model,
      status: r.status,
      cacheHit: r.cache_hit,
      fallbackUsed: r.fallback_used,
      totalTokens: r.total_tokens,
      costUsd: r.estimated_total_cost_usd,
      latencyMs: r.latency_ms,
    })),
  };
}
