import { needsTargetRolesSetup } from "@/lib/ai-parser/target-roles";
import { ensureProfile } from "@/lib/profiles/ensure-profile";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";
import { ActivityHeartbeat } from "@/components/presence/activity-heartbeat";
import { isActivityExcluded } from "@/lib/presence/profiles";
import { isWorkspaceBlocked } from "@/lib/access/workspace";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (isWorkspaceBlocked(user)) redirect("/blocked");

  const [{ data: profile }, { count: followUpsDueCount }] = await Promise.all([
    ensureProfile(supabase, user),
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .lte("due_date", new Date().toISOString().slice(0, 10)),
  ]);

  return (
    <AppShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      followUpsDueCount={followUpsDueCount ?? 0}
      showOnboarding={profile?.onboarding_status === "not_started"}
      showTargetRoles={needsTargetRolesSetup(profile)}
    >
      {!isActivityExcluded(user) && <ActivityHeartbeat userId={user.id} />}
      {children}
    </AppShell>
  );
}
