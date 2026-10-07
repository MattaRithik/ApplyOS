import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

interface VisitWindow {
  user_id: string;
  started_at: string;
  last_report_at: string;
}

export interface VisitActivity {
  added: number;
  updated: number;
  parsed: number;
}

interface Action {
  user_id: string;
  status: string;
  recorded_at: string;
}
interface Parse {
  user_id: string;
  status: string;
  created_at: string;
}

const ADDED = "Application added";
const UPDATED = ["Application updated", "Application status changed"];
const COMPLETED = ["success", "cache_hit"];
const BATCH_SIZE = 1000;

/** Counts cover the user's recorded time window, including concurrent tabs. */
export function countVisitActivity(visits: VisitWindow[], actions: Action[], parses: Parse[]): VisitActivity[] {
  return visits.map((visit) => {
    const start = Date.parse(visit.started_at);
    const end = Date.parse(visit.last_report_at);
    const within = (userId: string, timestamp: string) => userId === visit.user_id
      && Date.parse(timestamp) >= start && Date.parse(timestamp) <= end;
    const activity = { added: 0, updated: 0, parsed: 0 };
    for (const action of actions) {
      if (!within(action.user_id, action.recorded_at)) continue;
      if (action.status === ADDED) activity.added++;
      else if (UPDATED.includes(action.status)) activity.updated++;
    }
    for (const parse of parses) {
      if (COMPLETED.includes(parse.status) && within(parse.user_id, parse.created_at)) activity.parsed++;
    }
    return activity;
  });
}

/** Read action labels and successful parse timestamps only; no application contents. */
export async function withVisitActivity<T extends VisitWindow>(db: SupabaseClient, visits: T[]): Promise<(T & { activity: VisitActivity })[]> {
  if (visits.length === 0) return [];
  const userIds = [...new Set(visits.map((visit) => visit.user_id))];
  const since = new Date(Math.min(...visits.map((visit) => Date.parse(visit.started_at)))).toISOString();
  const until = new Date(Math.max(...visits.map((visit) => Date.parse(visit.last_report_at)))).toISOString();

  async function readActions() {
    const rows: Action[] = [];
    for (let offset = 0; ; offset += BATCH_SIZE) {
      const { data, error } = await db.from("user_presence_history")
        .select("user_id, status, recorded_at").in("user_id", userIds)
        .in("status", [ADDED, ...UPDATED]).gte("recorded_at", since).lte("recorded_at", until)
        .order("id", { ascending: true }).range(offset, offset + BATCH_SIZE - 1);
      if (error) throw new Error("Unable to load visit actions.");
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < BATCH_SIZE) return rows;
    }
  }
  async function readParses() {
    const rows: Parse[] = [];
    for (let offset = 0; ; offset += BATCH_SIZE) {
      const { data, error } = await db.from("ai_parser_usage")
        .select("user_id, status, created_at").in("user_id", userIds)
        .in("status", COMPLETED).gte("created_at", since).lte("created_at", until)
        .order("created_at", { ascending: true }).order("id", { ascending: true })
        .range(offset, offset + BATCH_SIZE - 1);
      if (error) throw new Error("Unable to load visit parses.");
      rows.push(...(data ?? []));
      if ((data?.length ?? 0) < BATCH_SIZE) return rows;
    }
  }
  const [actions, parses] = await Promise.all([readActions(), readParses()]);
  const counts = countVisitActivity(visits, actions, parses);
  return visits.map((visit, index) => ({ ...visit, activity: counts[index] }));
}
