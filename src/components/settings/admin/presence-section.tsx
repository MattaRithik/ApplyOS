"use client";
import { PresenceHistory } from "./presence-history";
import { useEffect, useState, useSyncExternalStore } from "react";
import { HEARTBEAT_MS, formatLastContact, presenceStatus, type PresenceSession } from "@/lib/presence/shared";

import { subscribeHeartbeat, getHeartbeatSnapshot, getServerHeartbeatSnapshot } from "@/lib/presence/client-status";

export function PresenceSection() {
  const heartbeat = useSyncExternalStore(subscribeHeartbeat, getHeartbeatSnapshot, getServerHeartbeatSnapshot);
  const [sessions, setSessions] = useState<PresenceSession[]>([]);
  const [now, setNow] = useState(0);
  const [updated, setUpdated] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    let denied = false;
    let offset = 0;
    async function refresh() {
      if (pending || denied || document.visibilityState !== "visible") return;
      pending = true;
      try {
        const response = await fetch("/api/admin/presence", { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) denied = true;
          throw new Error(result.error || "Unable to refresh activity.");
        }
        if (controller.signal.aborted) return;
        offset = Date.parse(result.serverTime) - Date.now();
        setSessions(result.sessions);
        setUpdated(result.serverTime);
        setNow(Date.now() + offset);
        setError(null);
      } catch (err) {
        if (!controller.signal.aborted) {
          setSessions([]);
          setError(err instanceof Error ? err.message : "Unable to refresh activity.");
        }
      } finally { pending = false; }
    }
    void refresh();
    const poll = window.setInterval(refresh, HEARTBEAT_MS);
    const tick = window.setInterval(() => setNow(Date.now() + offset), 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => { controller.abort(); clearInterval(poll); clearInterval(tick); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const online = new Set(sessions.filter((s) => presenceStatus(s, now) !== "Offline").map((s) => s.user_id)).size;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Signed-in activity · {online} users online</h3>
        <p className="text-xs text-muted-foreground">Only your configured owner account can read this feed. Latest 200 tab sessions. Older recorded events are available in Activity history below.</p>
        <p className="mt-1 text-xs text-muted-foreground">Refreshes every 15 seconds. Last report means time since the tab contacted the server, not time spent viewing. Active means a visible tab with recent interaction; it does not confirm attention. Background tabs may stop reporting. Offline after 45 seconds without contact.</p>
        {updated && <p className="mt-1 text-xs text-muted-foreground">Last refreshed {new Date(updated).toLocaleTimeString()}</p>}
      </div>
      {heartbeat.error && <p role="alert" className="text-sm text-destructive">This tab is not reporting activity: {heartbeat.error} Retrying automatically.</p>}
      {updated && online === 0 && <p className="text-sm text-muted-foreground">No recent activity reports. The rows below are previous tab sessions, not currently connected users.</p>}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : !updated ? <p className="text-sm text-muted-foreground">Loading activity…</p> : sessions.length === 0 ? <p className="text-sm text-muted-foreground">No recent signed-in sessions.</p> : (
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40"><tr>{["Account", "Status", "Page", "Last report", "Last interaction", "IP address", "Approx. location", "Browser / device"].map((label) => <th key={label} className="whitespace-nowrap p-3 font-medium">{label}</th>)}</tr></thead>
            <tbody>{sessions.map((session) => {
              const status = presenceStatus(session, now);
              return <tr key={`${session.user_id}:${session.session_id}`} className="border-t border-border/40">
                <td className="p-3">{session.email || session.user_id}</td>
                <td className="p-3"><span className={status === "Active" ? "text-emerald-500" : "text-muted-foreground"}>{status}</span></td>
                <td className="p-3">{session.page}</td>
                <td className="whitespace-nowrap p-3" title={new Date(session.last_seen_at).toLocaleString()}>{formatLastContact(session.last_seen_at, now)}</td>
                <td className="whitespace-nowrap p-3">{new Date(session.last_active_at).toLocaleString()}</td>
                <td className="whitespace-nowrap p-3 font-mono" title={session.ip_address ? undefined : "No IP was recorded for this tab session. A successful new report is needed; historical IPs cannot be recovered."}>{session.ip_address || "Not recorded"}</td>
                <td className="p-3">{session.location || "Unavailable"}</td>
                <td className="max-w-64 break-words p-3">{session.user_agent || "Unavailable"}</td>
              </tr>;
            })}</tbody>
          </table>
        </div>
      )}
      <PresenceHistory />
      <p className="text-xs text-muted-foreground">IP locations are approximate and can reflect a VPN or proxy. Page sections and browser activity are reported by the browser and are not proof of identity.</p>
    </div>
  );
}
