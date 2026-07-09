import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ApplicationDetailClient } from "@/components/applications/detail/application-detail-client";

export default async function ApplicationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: application }, { data: resumes }, { data: interviewRounds }, { data: statusHistory }, { data: notes }] =
    await Promise.all([
      supabase
        .from("applications")
        .select("*, resume:resumes(id, display_name)")
        .eq("id", id)
        .eq("user_id", user.id)
        .single(),
      supabase.from("resumes").select("id, display_name").eq("user_id", user.id).eq("is_archived", false),
      supabase
        .from("interview_rounds")
        .select("*")
        .eq("application_id", id)
        .eq("user_id", user.id)
        .order("scheduled_at", { ascending: true, nullsFirst: false }),
      supabase
        .from("application_status_history")
        .select("*")
        .eq("application_id", id)
        .eq("user_id", user.id)
        .order("changed_at", { ascending: false }),
      supabase
        .from("notes")
        .select("*")
        .eq("entity_type", "application")
        .eq("entity_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  if (!application) notFound();

  return (
    <ApplicationDetailClient
      application={application as never}
      resumeOptions={resumes ?? []}
      interviewRounds={interviewRounds ?? []}
      statusHistory={statusHistory ?? []}
      notes={notes ?? []}
    />
  );
}
