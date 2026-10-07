"use client";
import { PageUsage } from "./page-usage";
import { useEffect, useState } from "react";
import { HEARTBEAT_MS, OFFLINE_MS, type PresenceSession } from "@/lib/presence/shared";



export function PresenceSection() {
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
  const users = Array.from(sessions.reduce((byUser, session) => {
    const isOnline = !session.closed && now - Date.parse(session.last_seen_at) < OFFLINE_MS;
    const previous = byUser.get(session.user_id);
    if (!previous) byUser.set(session.user_id, { ...session, isOnline });
    else {
      previous.isOnline ||= isOnline;
      if (Date.parse(session.last_seen_at) > Date.parse(previous.last_seen_at)) {
        previous.last_seen_at = session.last_seen_at;
      }
    }
    return byUser;
  }, new Map<string, PresenceSession & { isOnline: boolean }>()).values())
    .sort((a, b) => Number(b.isOnline) - Number(a.isOnline) || Date.parse(b.last_seen_at) - Date.parse(a.last_seen_at));
  const online = users.filter((user) => user.isOnline).length;
  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-sm font-semibold">Live Activity · {online} online</h3>
        <p className="mt-1 text-xs text-muted-foreground">Online now and last seen, by user.</p>
      </div>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : !updated ? <p className="text-sm text-muted-foreground">Loading activity…</p> : users.length === 0 ? <p className="text-sm text-muted-foreground">No activity yet.</p> : (
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/40"><tr><th className="p-3 font-medium">User</th><th className="p-3 font-medium">Last online</th></tr></thead>
            <tbody>{users.map((user) => (
              <tr key={user.user_id} className="border-t border-border/40">
                <td className="p-3">{user.profile_name}</td>
                <td className="whitespace-nowrap p-3">
                  {user.isOnline ? <span className="inline-flex items-center gap-2 text-emerald-500"><span className="size-2 rounded-full bg-emerald-500" />Online now</span> :
                    <span className="text-muted-foreground">{new Date(user.last_seen_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
                </td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <PageUsage />
    </div>
  );
}
