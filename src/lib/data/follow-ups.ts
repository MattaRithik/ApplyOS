import type { SupabaseClient } from "@supabase/supabase-js";

export type FollowUpContext = "application" | "cold_email" | "interview" | "contact";

export interface FollowUpItem {
  id: string;
  context: FollowUpContext;
  title: string;
  subtitle: string | null;
  companyName: string | null;
  contactName: string | null;
  dueDate: string;
  link: string;
}

export async function getFollowUpItems(supabase: SupabaseClient, userId: string): Promise<FollowUpItem[]> {
  const [{ data: applications }, { data: outreach }, { data: contacts }, { data: interviewRounds }] =
    await Promise.all([
      supabase
        .from("applications")
        .select("id, job_title, company_name, follow_up_date")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .not("follow_up_date", "is", null),
      supabase
        .from("outreach")
        .select("id, person_name, company_name, follow_up_date, response_received")
        .eq("user_id", userId)
        .eq("response_received", false)
        .not("follow_up_date", "is", null),
      supabase
        .from("contacts")
        .select("id, name, company_name, next_follow_up_date")
        .eq("user_id", userId)
        .not("next_follow_up_date", "is", null),
      supabase
        .from("interview_rounds")
        .select("id, round_name, application_id, scheduled_at, follow_up_sent, application:applications(job_title, company_name)")
        .eq("user_id", userId)
        .eq("follow_up_sent", false)
        .not("scheduled_at", "is", null),
    ]);

  const items: FollowUpItem[] = [];
  const today = new Date().toISOString().slice(0, 10);

  (applications ?? []).forEach((a) => {
    items.push({
      id: `application-${a.id}`,
      context: "application",
      title: `Follow up: ${a.job_title}`,
      subtitle: a.company_name,
      companyName: a.company_name,
      contactName: null,
      dueDate: a.follow_up_date!,
      link: `/applications/${a.id}`,
    });
  });

  (outreach ?? []).forEach((o) => {
    items.push({
      id: `outreach-${o.id}`,
      context: "cold_email",
      title: `Follow up with ${o.person_name ?? "contact"}`,
      subtitle: o.company_name,
      companyName: o.company_name,
      contactName: o.person_name,
      dueDate: o.follow_up_date!,
      link: `/outreach`,
    });
  });

  (contacts ?? []).forEach((c) => {
    items.push({
      id: `contact-${c.id}`,
      context: "contact",
      title: `Reach out to ${c.name}`,
      subtitle: c.company_name,
      companyName: c.company_name,
      contactName: c.name,
      dueDate: c.next_follow_up_date!,
      link: `/contacts`,
    });
  });

  (interviewRounds ?? [])
    .filter((r) => r.scheduled_at && r.scheduled_at.slice(0, 10) <= today)
    .forEach((r) => {
      const app = r.application as unknown as { job_title: string; company_name: string } | null;
      items.push({
        id: `interview-${r.id}`,
        context: "interview",
        title: `Send follow-up after ${r.round_name}`,
        subtitle: app?.company_name ?? null,
        companyName: app?.company_name ?? null,
        contactName: null,
        dueDate: r.scheduled_at!.slice(0, 10),
        link: `/applications/${r.application_id}`,
      });
    });

  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}
