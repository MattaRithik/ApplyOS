"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { UsageRange, UsageSummary } from "@/lib/ai-parser/usage";

interface UsageSummaryResponse extends UsageSummary {
  entitlement: {
    dailyRequestLimit: number;
    monthlyBudgetUsd: number | null;
    expiresAt: string | null;
  };
}

const RANGES: { value: UsageRange; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "7d", label: "7 days" },
  { value: "month", label: "This month" },
  { value: "30d", label: "30 days" },
  { value: "all", label: "All time" },
];

/** Adaptive precision: sub-cent values get more decimals so they don't render as "$0.00". */
function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  const abs = Math.abs(value);
  if (abs < 0.01) return `$${value.toFixed(6)}`;
  if (abs < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <GlassPanel className="space-y-1 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </GlassPanel>
  );
}

export function AiUsageTab() {
  const [range, setRange] = React.useState<UsageRange>("month");
  const [summary, setSummary] = React.useState<UsageSummaryResponse | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchSummary = React.useCallback(async (r: UsageRange) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/ai-parser/usage?range=${r}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load usage");
      setSummary(json as UsageSummaryResponse);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load usage");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Intentional: re-fetch usage data whenever the selected range changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch triggered by a prop/state change, not a render loop
    fetchSummary(range);
  }, [range, fetchSummary]);

  const monthlyBudgetUsd = summary?.entitlement.monthlyBudgetUsd ?? null;
  const budgetPercent =
    monthlyBudgetUsd && monthlyBudgetUsd > 0 && summary
      ? Math.min(100, (summary.spend.monthUsd / monthlyBudgetUsd) * 100)
      : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                range === r.value
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border/50 text-muted-foreground hover:bg-accent/40"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => fetchSummary(range)} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {!summary ? (
        <p className="text-sm text-muted-foreground">{loading ? "Loading usage…" : "No usage data yet."}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Spend today" value={formatUsd(summary.spend.todayUsd)} />
            <StatCard label="Spend this month" value={formatUsd(summary.spend.monthUsd)} />
            <StatCard label="Spend all-time" value={formatUsd(summary.spend.allTimeUsd)} />
            <StatCard label={`Spend (${RANGES.find((r) => r.value === range)?.label})`} value={formatUsd(summary.totals.totalCostUsd)} />
          </div>

          {monthlyBudgetUsd !== null && (
            <GlassPanel className="space-y-2 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold">Monthly budget</span>
                <span className="tabular-nums text-muted-foreground">
                  {formatUsd(summary.spend.monthUsd)} / {formatUsd(monthlyBudgetUsd)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    (budgetPercent ?? 0) >= 100 ? "bg-destructive" : (budgetPercent ?? 0) >= 75 ? "bg-[var(--amber-accent)]" : "bg-[var(--emerald-accent)]"
                  )}
                  style={{ width: `${budgetPercent ?? 0}%` }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Internal monitoring display only — not a provider-enforced spending cap.
              </p>
            </GlassPanel>
          )}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatCard label="Daily request limit" value={summary.entitlement.dailyRequestLimit} />
            <StatCard
              label="Access expires"
              value={summary.entitlement.expiresAt ? new Date(summary.entitlement.expiresAt).toLocaleDateString() : "Never"}
            />
            <StatCard label="Requests" value={summary.totals.requests} />
            <StatCard label="Successful" value={summary.totals.successful} />
            <StatCard label="Failed" value={summary.totals.failed} />
            <StatCard label="Cache hits" value={summary.totals.cacheHits} />
            <StatCard label="Retry uses" value={summary.totals.fallbackUses} />
            <StatCard label="Total tokens" value={summary.totals.totalTokens.toLocaleString()} />
            <StatCard label="Avg cost / parse" value={formatUsd(summary.totals.avgCostPerSuccessfulParseUsd)} />
            <StatCard label="Avg latency" value={formatMs(summary.totals.avgLatencyMs)} />
          </div>

          {summary.perModel.length > 0 && (
            <GlassPanel className="space-y-2 p-3">
              <p className="text-xs font-semibold">Per-model breakdown</p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="text-[10px] uppercase text-muted-foreground">
                      <th className="py-1 pr-2">Model</th>
                      <th className="py-1 pr-2">Calls</th>
                      <th className="py-1 pr-2">Tokens</th>
                      <th className="py-1 pr-2">Cost</th>
                      <th className="py-1 pr-2">% of total</th>
                      <th className="py-1 pr-2">Avg latency</th>
                      <th className="py-1 pr-2">Success rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {summary.perModel.map((m) => (
                      <tr key={m.model} className="border-t border-border/40">
                        <td className="py-1.5 pr-2 font-medium">{m.model}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{m.calls}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{m.totalTokens.toLocaleString()}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{formatUsd(m.costUsd)}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{m.percentOfTotalCost.toFixed(1)}%</td>
                        <td className="py-1.5 pr-2 tabular-nums">{formatMs(m.avgLatencyMs)}</td>
                        <td className="py-1.5 pr-2 tabular-nums">{m.successRate.toFixed(0)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          )}

          <GlassPanel className="space-y-2 p-3">
            <p className="text-xs font-semibold">Recent activity</p>
            <div className="max-h-72 overflow-y-auto overflow-x-auto scrollbar-thin">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="text-[10px] uppercase text-muted-foreground">
                    <th className="py-1 pr-2">Time</th>
                    <th className="py-1 pr-2">Model</th>
                    <th className="py-1 pr-2">Status</th>
                    <th className="py-1 pr-2">Cache</th>
                    <th className="py-1 pr-2">Retry</th>
                    <th className="py-1 pr-2">Tokens</th>
                    <th className="py-1 pr-2">Cost</th>
                    <th className="py-1 pr-2">Latency</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.recentActivity.map((row) => (
                    <tr key={row.id} className="border-t border-border/40">
                      <td className="py-1.5 pr-2 whitespace-nowrap tabular-nums">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="py-1.5 pr-2">{row.model ?? "—"}</td>
                      <td className="py-1.5 pr-2">
                        <Badge
                          variant="outline"
                          className={cn(
                            "h-4 px-1.5 text-[9px] uppercase",
                            row.status === "success" && "text-[var(--emerald-accent)]",
                            row.status === "failed" && "text-destructive",
                            row.status === "cache_hit" && "text-[var(--cyan-accent)]"
                          )}
                        >
                          {row.status}
                        </Badge>
                      </td>
                      <td className="py-1.5 pr-2">{row.cacheHit ? "Yes" : "No"}</td>
                      <td className="py-1.5 pr-2">{row.fallbackUsed ? "Yes" : "No"}</td>
                      <td className="py-1.5 pr-2 tabular-nums">{row.totalTokens?.toLocaleString() ?? "—"}</td>
                      <td className="py-1.5 pr-2 tabular-nums">{row.costUsd !== null ? formatUsd(row.costUsd) : "—"}</td>
                      <td className="py-1.5 pr-2 tabular-nums">{row.latencyMs !== null ? formatMs(row.latencyMs) : "—"}</td>
                    </tr>
                  ))}
                  {summary.recentActivity.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-center text-muted-foreground">
                        No activity in this range.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </GlassPanel>
        </>
      )}
    </div>
  );
}
