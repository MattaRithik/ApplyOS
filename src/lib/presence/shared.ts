export const HEARTBEAT_MS = 15_000;
export const OFFLINE_MS = 45_000;
export const IDLE_MS = 60_000;
export const PAGE_SECTIONS = ["dashboard", "applications", "companies", "interviews", "outreach", "export", "follow-ups", "templates", "resumes", "contacts", "settings", "analytics", "job-drops", "other"] as const;
export function pageSection(path: string): (typeof PAGE_SECTIONS)[number] {
  const section = path.split(/[/?#]/)[1];
  return PAGE_SECTIONS.find((value) => value === section) ?? "other";
}
export interface PresenceSession {
  user_id: string;
  session_id: string;
  profile_name: string;
  page: string;
  visible: boolean;
  closed: boolean;
  last_seen_at: string;
  last_active_at: string;
  ip_address: string | null;
  location: string | null;
  user_agent: string | null;
}
export function presenceStatus(session: PresenceSession, now: number) {
  if (session.closed || now - Date.parse(session.last_seen_at) >= OFFLINE_MS) return "Offline";
  if (!session.visible) return "Background";
  return now - Date.parse(session.last_active_at) >= IDLE_MS ? "Idle" : "Active";
}

/** One user row; background reports never count as interaction or online time. */
export function summarizePresence(sessions: PresenceSession[], now: number) {
  const users = new Map<string, { user_id: string; profile_name: string; isOnline: boolean; last_active_at: string }>();
  for (const session of sessions) {
    const isOnline = presenceStatus(session, now) === "Active";
    const previous = users.get(session.user_id);
    if (!previous) {
      users.set(session.user_id, {
        user_id: session.user_id, profile_name: session.profile_name,
        isOnline, last_active_at: session.last_active_at,
      });
    } else {
      previous.isOnline ||= isOnline;
      if (Date.parse(session.last_active_at) > Date.parse(previous.last_active_at)) {
        previous.last_active_at = session.last_active_at;
      }
    }
  }
  return [...users.values()].sort((a, b) => Number(b.isOnline) - Number(a.isOnline)
    || Date.parse(b.last_active_at) - Date.parse(a.last_active_at));
}

/** Elapsed time since the last report, not duration spent viewing a page. */
export function formatLastContact(timestamp: string, now: number): string {
  const elapsed = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 1000));
  if (!Number.isFinite(elapsed)) return "Unknown";
  if (elapsed < 60) return "Just now";
  const minutes = Math.floor(elapsed / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
