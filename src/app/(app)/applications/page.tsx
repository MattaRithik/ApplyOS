import Link from "next/link";
import { Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { ApplicationsWorkspace } from "@/components/applications/applications-workspace";
import { Button } from "@/components/ui/button";
import type { ApplicationWithResume } from "@/components/applications/types";

export default async function ApplicationsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: applications }, { data: resumes }] = await Promise.all([
    supabase
      .from("applications")
      .select("*, resume:resumes(id, display_name)")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
    supabase.from("resumes").select("id, display_name").eq("user_id", user.id).eq("is_archived", false),
  ]);

  if (!applications || applications.length === 0) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <EmptyState
          iconName="sparkles"
          title="No applications yet"
          description="Track every role you apply to — status, contacts, interviews, and follow-ups all in one place."
          actionLabel="Add your first application"
          actionHref="/applications/add"
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Applications</h1>
          <p className="text-sm text-muted-foreground">{applications.length} tracked applications</p>
        </div>
        <Button render={<Link href="/applications/add" />} className="gap-2">
          <Sparkles className="h-4 w-4" /> Add Application
        </Button>
      </div>

      <ApplicationsWorkspace
        applications={applications as unknown as ApplicationWithResume[]}
        resumeOptions={resumes ?? []}
      />
    </div>
  );
}
