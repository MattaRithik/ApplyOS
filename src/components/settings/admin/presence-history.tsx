"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { HEARTBEAT_MS } from "@/lib/presence/shared";

interface ActivityEvent {
  id: string;
  profile_name: string;
  status: string;
  recorded_at: string;
}

export function PresenceHistory() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestRef = useRef<AbortController | null>(null);
  const pausedRef = useRef(false);
  const load = useCallback(async (before: string | null = null, automatic = false) => {
    if (automatic && (pausedRef.current || document.visibilityState !== "visible" || requestRef.current)) return;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    try {
      const response = await fetch(`/api/admin/presence/history${before ? `?before=${encodeURIComponent(before)}` : ""}`, {
        cache: "no-store", signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Unable to load activity.");
      if (controller.signal.aborted) return;
      setError(null);
      setEvents((previous) => before ? [...previous, ...result.events] : result.events);
      setCursor(result.nextCursor);
    } catch (err) {
      if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load activity.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
      if (requestRef.current === controller) requestRef.current = null;
    }
  }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- state follows an asynchronous request
    void load();
    const timer = window.setInterval(() => { void load(null, true); }, HEARTBEAT_MS);
    return () => { requestRef.current?.abort(); clearInterval(timer); };
  }, [load]);
  return <div className="space-y-3 border-t border-border/50 pt-5">
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-semibold">Recent activity</h3>
      <button type="button" className="text-xs underline disabled:opacity-50" disabled={loading} onClick={() => { pausedRef.current = false; setLoading(true); void load(); }}>Refresh</button>
    </div>
    <p className="text-xs text-muted-foreground">Saved changes, successful parses, and download requests.</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {events.length > 0 && <div className="overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full text-left text-xs">
        <thead className="bg-muted/40"><tr>{["User", "Activity", "When"].map((label) => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{events.map((event) => <tr key={event.id} className="border-t border-border/40">
          <td className="p-3">{event.profile_name}</td>
          <td className="p-3">{event.status}</td>
          <td className="whitespace-nowrap p-3">{new Date(event.recorded_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td>
        </tr>)}</tbody>
      </table>
    </div>}
    {loading && <p className="text-xs text-muted-foreground">Loading activity…</p>}
    {!loading && !error && events.length === 0 && <p className="text-xs text-muted-foreground">No saved activity recorded yet.</p>}
    {cursor && <button type="button" className="text-xs underline disabled:opacity-50" disabled={loading} onClick={() => { pausedRef.current = true; setLoading(true); void load(cursor); }}>Load older activity</button>}
  </div>;
}
