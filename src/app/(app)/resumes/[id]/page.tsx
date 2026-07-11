import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ResumeDetailClient } from "@/components/resumes/resume-detail-client";

export default async function ResumeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: resume }, { data: applications }] = await Promise.all([
    supabase
      .from("resumes")
      .select("id, display_name, original_file_name, file_extension, file_size, target_role, version_notes, resume_match_score, missing_keywords, status, created_at, updated_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("applications")
      .select("id, job_title, company_name, status, date_applied")
      .eq("resume_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (!resume) notFound();

  return <ResumeDetailClient resume={resume} applications={applications ?? []} />;
}
