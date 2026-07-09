import { ListChecks } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getFollowUpItems } from "@/lib/data/follow-ups";
import { EmptyState } from "@/components/shared/empty-state";
import { FollowUpCenterClient } from "@/components/follow-ups/follow-up-center-client";

export default async function FollowUpsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const items = await getFollowUpItems(supabase, user.id);

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <EmptyState
          icon={ListChecks}
          title="Nothing to follow up on"
          description="Follow-ups from applications, cold outreach, contacts, and interviews will show up here automatically as their dates come due."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Follow-up Center</h1>
        <p className="text-sm text-muted-foreground">{items.length} follow-ups tracked across your search</p>
      </div>
      <FollowUpCenterClient items={items} />
    </div>
  );
}
