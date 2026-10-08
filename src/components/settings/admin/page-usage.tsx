"use client";
import { useEffect, useState } from "react";
interface Summary {
  user_id: string; profile_name: string; page: string;
  visible_seconds: number; active_seconds: number;
}
function duration(seconds: number) {
  const total = Math.floor(seconds);
  return total >= 3600 ? `${Math.floor(total / 3600)}h ${Math.floor(total % 3600 / 60)}m` : total < 60 ? "<1m" : `${Math.floor(total / 60)}m`;
}
export function PageUsage() {
  const [revision, setRevision] = useState(0);
  const [summary, setSummary] = useState<Summary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/admin/presence/usage", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load page usage.");
        if (controller.signal.aborted) return;
        setSummary(result.summary);
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load page usage.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [revision]);
  return <div className="space-y-3 border-t border-border/50 pt-5">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold">Time spent by page</h3>
      <button className="text-xs underline disabled:opacity-50" disabled={loading} onClick={() => { setLoading(true); setRevision(value => value + 1); }}>Refresh usage</button>
    </div>
    <p className="text-xs text-muted-foreground">Estimated foreground time over the last 30 days.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {summary && summary.length > 0 && <div className="overflow-x-auto rounded-xl border border-border/50"><table className="w-full text-left text-xs">
      <thead className="bg-muted/40"><tr>{["User", "Page", "Active time", "Visible time"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead>
      <tbody>{summary.map((row) => <tr key={`${row.user_id}:${row.page}`} className="border-t border-border/40">
        <td className="p-3">{row.profile_name}</td><td className="p-3">{row.page}</td><td className="p-3">{duration(row.active_seconds)}</td><td className="p-3">{duration(row.visible_seconds)}</td>
      </tr>)}</tbody>
    </table></div>}
    {!loading && !error && summary?.length === 0 && <p className="text-xs text-muted-foreground">No measured activity yet.</p>}
    {loading && <p className="text-xs text-muted-foreground">Loading usage…</p>}
  </div>;
}
