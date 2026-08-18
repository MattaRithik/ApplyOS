import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { displayName } from "@/lib/utils/user-display";
import type { LinkStatus } from "@/lib/types/database";

export interface JobDropsStatusCounts {
  applied: number;
  notApplied: number;
  notApplicable: number;
}

export interface JobDropsSummary {
  threadId: string;
  myName: string;
  partnerId: string | null;
  partnerName: string;
  totalPosted: number;
  postedByMe: number;
  postedByPartner: number;
  my: JobDropsStatusCounts;
  partner: JobDropsStatusCounts;
}

function emptyCounts(): JobDropsStatusCounts {
  return { applied: 0, notApplied: 0, notApplicable: 0 };
}

function countFor(statuses: { user_id: string; status: LinkStatus }[], userId: string): JobDropsStatusCounts {
  const counts = emptyCounts();
  for (const s of statuses) {
    if (s.user_id !== userId) continue;
    if (s.status === "applied") counts.applied++;
    else if (s.status === "not_applied") counts.notApplied++;
    else if (s.status === "not_applicable") counts.notApplicable++;
  }
  return counts;
}

/**
 * Names come from the service-role client, never the session-scoped one:
 * `profiles` RLS only lets a user read their own row, so looking up a
 * thread partner's display name through the regular client always comes
 * back empty (that's the bug that made the UI show a literal "Partner"
 * fallback). Only id/full_name/email are read here — nothing else from
 * `profiles` is exposed to the other participant.
 */
export async function getJobDropsSummary(
  supabase: SupabaseClient,
  userId: string,
  userEmail: string | null
): Promise<JobDropsSummary | null> {
  const { data: membership } = await supabase
    .from("link_thread_participants")
    .select("thread_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!membership) return null;

  const threadId = membership.thread_id as string;

  const [{ data: participants }, { data: messages }, { data: statuses }] = await Promise.all([
    supabase.from("link_thread_participants").select("user_id").eq("thread_id", threadId),
    supabase.from("link_messages").select("id, sender_id").eq("thread_id", threadId),
    supabase.from("link_message_statuses").select("user_id, status").eq("thread_id", threadId),
  ]);

  const partnerId = (participants ?? []).find((p) => p.user_id !== userId)?.user_id ?? null;

  const ids = [userId, partnerId].filter((id): id is string => !!id);
  const service = createServiceRoleClient();
  const { data: profiles } = await service.from("profiles").select("id, full_name, email").in("id", ids);
  const nameFor = (id: string, fallbackEmail: string | null) => {
    const p = profiles?.find((row) => row.id === id);
    return displayName(p?.full_name as string | null, (p?.email as string | null) ?? fallbackEmail, "Someone");
  };

  const totalPosted = messages?.length ?? 0;
  const postedByMe = (messages ?? []).filter((m) => m.sender_id === userId).length;

  return {
    threadId,
    myName: nameFor(userId, userEmail),
    partnerId,
    partnerName: partnerId ? nameFor(partnerId, null) : "your partner",
    totalPosted,
    postedByMe,
    postedByPartner: totalPosted - postedByMe,
    my: countFor(statuses ?? [], userId),
    partner: partnerId ? countFor(statuses ?? [], partnerId) : emptyCounts(),
  };
}
