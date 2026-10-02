"use client";
import { useCallback, useEffect, useRef, useState } from "react";

interface ActivityEvent {
  id: number;
  profile_name: string;
  user_id: string;
  page: string;
  status: string;
  recorded_at: string;
}

export function PresenceHistory() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const load = useCallback(async (before: string | null = null) => {
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch(`/api/admin/presence/history${before ? `?before=${encodeURIComponent(before)}` : ""}`, {
        cache: "no-store", signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load activity history.");
      if (controller.signal.aborted) return;
      setError(null);
      setEvents((previous) => before ? [...previous, ...result.events] : result.events);
      setCursor(result.nextCursor);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load activity history.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, []);
  useEffect(() => {
    // State updates in load follow the asynchronous history request.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    return () => requestRef.current?.abort();
  }, [load]);
  return <div className="space-y-3 border-t border-border/50 pt-5">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">Activity history</h3>
      <button type="button" className="text-xs underline disabled:opacity-50" disabled={loading} onClick={() => { setLoading(true); setError(null); void load(); }}>Refresh history</button>
    </div>
    <p className="text-xs text-muted-foreground">Recorded page changes, tab status changes, and resumed connections are retained without an automatic time limit. Times show when the server received each report. History starts when tracking was enabled; previously deleted records cannot be recovered. This is not a log of every click, login attempt, or application error.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {events.length > 0 && <div className="overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/40"><tr>{["Reported at", "Profile", "Page", "Reported status"].map((label) => <th key={label} className="whitespace-nowrap p-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{events.map((event) => <tr key={event.id} className="border-t border-border/40">
          <td className="whitespace-nowrap p-3">{new Date(event.recorded_at).toLocaleString()}</td>
          <td className="p-3">{event.profile_name}</td>
          <td className="p-3">{event.page}</td>
          <td className="p-3">{event.status}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {loading && <p className="text-xs text-muted-foreground">Loading history…</p>}
    {!loading && !error && events.length === 0 && <p className="text-xs text-muted-foreground">No activity history recorded yet.</p>}
    {cursor && <button type="button" className="text-xs underline disabled:opacity-50" disabled={loading} onClick={() => { setLoading(true); setError(null); void load(cursor); }}>Load older activity</button>}
  </div>;
}
