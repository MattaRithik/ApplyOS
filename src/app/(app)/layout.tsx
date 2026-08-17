import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/nav/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { count: followUpsDueCount }, { data: jobDropsMembership }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("follow_ups")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_completed", false)
      .lte("due_date", new Date().toISOString().slice(0, 10)),
    supabase.from("link_thread_participants").select("thread_id, last_read_at").eq("user_id", user.id).maybeSingle(),
  ]);

  let jobDropsUnreadCount = 0;
  if (jobDropsMembership) {
    let unreadQuery = supabase
      .from("link_messages")
      .select("id", { count: "exact", head: true })
      .eq("thread_id", jobDropsMembership.thread_id)
      .neq("sender_id", user.id);
    if (jobDropsMembership.last_read_at) unreadQuery = unreadQuery.gt("created_at", jobDropsMembership.last_read_at);
    const { count } = await unreadQuery;
    jobDropsUnreadCount = count ?? 0;
  }

  return (
    <AppShell
      userEmail={user.email}
      userName={profile?.full_name}
      avatarUrl={profile?.avatar_url}
      followUpsDueCount={followUpsDueCount ?? 0}
      jobDropsUnreadCount={jobDropsUnreadCount}
      showOnboarding={profile?.onboarding_status === "not_started"}
    >
      {children}
    </AppShell>
  );
}
