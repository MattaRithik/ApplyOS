import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { ResumesGrid } from "@/components/resumes/resumes-grid";
import { UploadResumeDialog } from "@/components/resumes/upload-resume-dialog";
import type { ApplicationStatus } from "@/lib/types/database";

const INTERVIEW_STATUSES: ApplicationStatus[] = [
  "recruiter_screen",
  "oa_assessment",
  "first_round",
  "technical_round",
  "superday_final_round",
  "offer",
  "accepted",
];

export default async function ResumesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: resumes }, { data: applications }] = await Promise.all([
    supabase
      .from("resumes")
      .select("id, display_name, original_file_name, file_extension, file_size, target_role, status, created_at")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
    supabase.from("applications").select("resume_id, status").eq("user_id", user.id).eq("is_archived", false),
  ]);

  if (!resumes || resumes.length === 0) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <EmptyState
          iconName="fileText"
          title="No resumes yet"
          description="Upload PDF, DOC, or DOCX resumes and link versions to applications to track which one performs best."
        />
        <div className="mt-4 flex justify-center">
          <UploadResumeDialog />
        </div>
      </div>
    );
  }

  const withStats = resumes.map((r) => {
    const apps = applications?.filter((a) => a.resume_id === r.id) ?? [];
    const interviewed = apps.filter((a) => INTERVIEW_STATUSES.includes(a.status)).length;
    return {
      ...r,
      applicationCount: apps.length,
      interviewRate: apps.length > 0 ? Math.round((interviewed / apps.length) * 100) : 0,
    };
  });

  const bestResume = [...withStats]
    .filter((r) => r.applicationCount > 0)
    .sort((a, b) => b.interviewRate - a.interviewRate)[0];

  return (
    <div className="space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resume Library</h1>
          <p className="text-sm text-muted-foreground">{resumes.length} resumes</p>
        </div>
        <UploadResumeDialog />
      </div>
      <ResumesGrid resumes={withStats} bestResumeId={bestResume?.id ?? null} />
    </div>
  );
}
