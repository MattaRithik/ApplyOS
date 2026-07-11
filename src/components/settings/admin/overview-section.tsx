"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard, formatUsd } from "@/components/settings/admin/stat-card";

interface AdminOverview {
  totalUsers: number;
  usersWithAiAccess: number;
  suspendedAiAccess: number;
  aiRequestsThisMonth: number;
  aiCostThisMonthUsd: number;
}

export function OverviewSection() {
  const [overview, setOverview] = React.useState<AdminOverview | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchOverview = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/overview");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load overview");
      setOverview(json as AdminOverview);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load overview");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data fetch on mount
    fetchOverview();
  }, [fetchOverview]);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={fetchOverview} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      {!overview ? (
        <p className="text-sm text-muted-foreground">{loading ? "Loading overview…" : "No data."}</p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <StatCard label="Total users" value={overview.totalUsers} />
          <StatCard label="AI access enabled" value={overview.usersWithAiAccess} />
          <StatCard label="AI access suspended" value={overview.suspendedAiAccess} />
          <StatCard label="AI requests this month" value={overview.aiRequestsThisMonth} />
          <StatCard label="AI cost this month" value={formatUsd(overview.aiCostThisMonthUsd)} />
        </div>
      )}
    </div>
  );
}
