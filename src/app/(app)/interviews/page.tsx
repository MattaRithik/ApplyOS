import { CalendarClock } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { InterviewsList } from "@/components/interviews/interviews-list";

export default async function InterviewsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: rounds } = await supabase
    .from("interview_rounds")
    .select("*, application:applications(id, job_title, company_name)")
    .eq("user_id", user.id)
    .order("scheduled_at", { ascending: false, nullsFirst: false });

  if (!rounds || rounds.length === 0) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <EmptyState
          icon={CalendarClock}
          title="No interviews yet"
          description="Interview rounds you add on an application's detail page show up here — prep notes, interviewers, results, and thank-you tracking all in one place."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Interviews</h1>
        <p className="text-sm text-muted-foreground">{rounds.length} rounds across all applications</p>
      </div>
      <InterviewsList rounds={rounds as never} />
    </div>
  );
}
