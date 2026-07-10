import { createClient } from "@/lib/supabase/server";
import { AddApplicationClient } from "@/components/applications/add-application-client";

export default async function AddApplicationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: resumes } = await supabase
    .from("resumes")
    .select("id, display_name")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("display_name");

  return (
    <div className="py-6">
      <div className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tight">Add Application</h1>
        <p className="text-sm text-muted-foreground">
          Fill in the details manually, or paste a job posting into the AI assistant on the right.
        </p>
      </div>
      <AddApplicationClient resumeOptions={resumes ?? []} />
    </div>
  );
}
