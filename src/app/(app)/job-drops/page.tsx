import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { AddPartnerCard } from "@/components/job-drops/add-partner-card";
import { JobDropsClient } from "@/components/job-drops/job-drops-client";
import type { LinkMessage, LinkMessageStatus } from "@/lib/types/database";

export default async function JobDropsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("link_thread_participants")
    .select("thread_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
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

  const threadId = membership.thread_id;

  const [{ data: myProfile }, { data: participants }, { data: messages }, { data: statuses }] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).maybeSingle(),
    supabase.from("link_thread_participants").select("user_id").eq("thread_id", threadId),
    supabase.from("link_messages").select("*").eq("thread_id", threadId).order("created_at", { ascending: true }),
    supabase.from("link_message_statuses").select("*").eq("thread_id", threadId),
  ]);

  const partnerId = participants?.find((p) => p.user_id !== user.id)?.user_id ?? null;
  const { data: partnerProfile } = partnerId
    ? await supabase.from("profiles").select("full_name, email").eq("id", partnerId).maybeSingle()
    : { data: null };

  return (
    <div className="space-y-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Job Drops</h1>
        <p className="text-sm text-muted-foreground">
          Job links you and {partnerProfile?.full_name ?? partnerProfile?.email ?? "your partner"} drop for each other.
        </p>
      </div>
      <JobDropsClient
        threadId={threadId}
        currentUserId={user.id}
        currentUserName={myProfile?.full_name ?? user.email ?? "You"}
        partnerId={partnerId}
        partnerName={partnerProfile?.full_name ?? partnerProfile?.email ?? "Partner"}
        initialMessages={(messages ?? []) as LinkMessage[]}
        initialStatuses={(statuses ?? []) as LinkMessageStatus[]}
      />
    </div>
  );
}
