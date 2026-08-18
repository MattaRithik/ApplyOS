import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { AddPartnerCard } from "@/components/job-drops/add-partner-card";
import { JobDropsClient } from "@/components/job-drops/job-drops-client";
import { JobDropsStatsRow } from "@/components/job-drops/stats-row";
import { getJobDropsSummary } from "@/lib/data/job-drops";
import type { LinkMessage, LinkMessageStatus } from "@/lib/types/database";

export default async function JobDropsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const summary = await getJobDropsSummary(supabase, user.id, user.email ?? null);

  if (!summary) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 pt-16">
        <EmptyState
          iconName="users"
          title="No shared thread yet"
          description="Add the one person you want to share job links with — you'll each be able to post links and mark your own status on each one."
        />
        <AddPartnerCard />
      </div>
    );
  }

  const { data: messages } = await supabase
    .from("link_messages")
    .select("*")
    .eq("thread_id", summary.threadId)
    .order("created_at", { ascending: true });
  const { data: statuses } = await supabase.from("link_message_statuses").select("*").eq("thread_id", summary.threadId);

  return (
    <div className="space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job Drops</h1>
        <p className="text-sm text-muted-foreground">Job links you and {summary.partnerName} drop for each other.</p>
      </div>
      <JobDropsStatsRow summary={summary} />
      <JobDropsClient
        threadId={summary.threadId}
        currentUserId={user.id}
        currentUserName={summary.myName}
        partnerId={summary.partnerId}
        partnerName={summary.partnerName}
        initialMessages={(messages ?? []) as LinkMessage[]}
        initialStatuses={(statuses ?? []) as LinkMessageStatus[]}
      />
    </div>
  );
}
