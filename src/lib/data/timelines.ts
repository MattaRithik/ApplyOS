import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveTimeline, type ResolvedTimeline } from "@/lib/timelines/resolve";
import type { InternationalStudentProfile, UserTimeline } from "@/lib/types/database";

export interface TimelinesContext {
  internationalProfile: InternationalStudentProfile | null;
  /** All non-archived saved timelines (pinned and unpinned) for the "manage timelines" UI in Settings. */
  allTimelines: UserTimeline[];
  /** Up to 3 resolved cards for the dashboard, already sorted by slot. */
  pinnedTimelines: ResolvedTimeline[];
}

export async function getTimelinesContext(supabase: SupabaseClient, userId: string): Promise<TimelinesContext> {
  const [{ data: profile }, { data: timelines }] = await Promise.all([
    supabase.from("international_student_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase
      .from("user_timelines")
      .select("*")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("dashboard_slot", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  const internationalProfile = (profile ?? null) as InternationalStudentProfile | null;
  const allTimelines = (timelines ?? []) as UserTimeline[];

  const pinned = allTimelines
    .filter((t) => t.is_pinned && t.dashboard_slot !== null)
    .sort((a, b) => (a.dashboard_slot ?? 0) - (b.dashboard_slot ?? 0))
    .slice(0, 3);

  const showImmigration = internationalProfile?.enabled !== false;

  const pinnedTimelines = pinned
    .filter((t) => showImmigration || t.category !== "immigration")
    .map((t) => resolveTimeline(t, internationalProfile));

  return { internationalProfile, allTimelines, pinnedTimelines };
}
