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
  email: string | null;
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

/** Elapsed time since the last report, not duration spent viewing a page. */
export function formatLastContact(timestamp: string, now: number): string {
  const elapsed = Math.max(0, Math.floor((now - Date.parse(timestamp)) / 1000));
  if (!Number.isFinite(elapsed)) return "Unknown";
  if (elapsed < 5) return "Just now";
  if (elapsed < 60) return `${elapsed}s ago`;
  const minutes = Math.floor(elapsed / 60);
  if (minutes < 60) return `${minutes}m ${elapsed % 60}s ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h ago`;
}
