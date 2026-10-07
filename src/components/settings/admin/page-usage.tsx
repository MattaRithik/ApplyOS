"use client";
import { useEffect, useState } from "react";
interface UsageRow {
  user_id: string; profile_name: string; page: string;
  visible_seconds: number; active_seconds: number;
}
interface Visit extends UsageRow { id: number; started_at: string; last_report_at: string }
interface Summary extends UsageRow { visits: number }
function duration(seconds: number) {
  const total = Math.floor(seconds);
  return total >= 3600 ? `${Math.floor(total / 3600)}h ${Math.floor(total % 3600 / 60)}m` : total < 60 ? "<1m" : `${Math.floor(total / 60)}m`;
}
export function PageUsage() {
  const [request, setRequest] = useState({ before: "", revision: 0 });
  const [data, setData] = useState<{ visits: Visit[]; summary: Summary[]; nextCursor: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/admin/presence/usage${request.before ? `?before=${request.before}` : ""}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load page usage.");
        if (controller.signal.aborted) return;
        setData((previous) => ({ ...result, visits: request.before ? [...(previous?.visits ?? []), ...result.visits] : result.visits }));
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load page usage.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [request]);
  const load = (before = "") => { setLoading(true); setRequest((value) => ({ before, revision: value.revision + 1 })); };
  return <div className="space-y-3 border-t border-border/50 pt-5">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold">Time spent by page</h3>
      <button className="text-xs underline disabled:opacity-50" disabled={loading} onClick={() => load()}>Refresh usage</button>
    </div>
    <p className="text-xs text-muted-foreground">Estimated time by page. Active time includes recent interaction; visible time includes idle time.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {data && <>
      <p className="text-xs font-medium">Visits started in the last 30 days · most active time first</p>
      <div className="overflow-x-auto rounded-xl border border-border/50"><table className="w-full text-left text-xs">
        <thead className="bg-muted/40"><tr>{["Profile", "Page", "Visits", "Active time", "Visible time"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{data.summary.map((row) => <tr key={`${row.user_id}:${row.page}`} className="border-t border-border/40">
          <td className="p-3">{row.profile_name}</td><td className="p-3">{row.page}</td><td className="p-3">{row.visits}</td><td className="p-3">{duration(row.active_seconds)}</td><td className="p-3">{duration(row.visible_seconds)}</td>
        </tr>)}</tbody>
      </table></div>
      <details className="space-y-3"><summary className="cursor-pointer text-xs font-medium">View individual visits</summary>
      <div className="overflow-x-auto rounded-xl border border-border/50"><table className="w-full text-left text-xs">
        <thead className="bg-muted/40"><tr>{["Profile", "Page", "First report", "Last measured report", "Active time", "Visible time"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead>
        <tbody>{data.visits.map((row) => <tr key={row.id} className="border-t border-border/40">
          <td className="p-3">{row.profile_name}</td><td className="p-3">{row.page}</td><td className="whitespace-nowrap p-3">{new Date(row.started_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td><td className="whitespace-nowrap p-3">{new Date(row.last_report_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td><td className="p-3">{duration(row.active_seconds)}</td><td className="p-3">{duration(row.visible_seconds)}</td>
        </tr>)}</tbody>
      </table></div>
      {data.visits.length === 0 && <p className="text-xs text-muted-foreground">No measured visits yet.</p>}
      {data.nextCursor && <button className="text-xs underline disabled:opacity-50" disabled={loading} onClick={() => load(data.nextCursor!)}>Load older visits</button>}
      </details>
    </>}
    {loading && <p className="text-xs text-muted-foreground">Loading usage…</p>}
  </div>;
}
