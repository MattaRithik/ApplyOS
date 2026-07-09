import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { CompanyDetailClient } from "@/components/companies/company-detail-client";

export default async function CompanyDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: company }, { data: applications }, { data: contacts }, { data: outreach }, { data: notes }] =
    await Promise.all([
      supabase.from("companies").select("*").eq("id", id).eq("user_id", user.id).single(),
      supabase
        .from("applications")
        .select("id, job_title, status, date_applied, priority_score")
        .eq("company_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("contacts").select("*").eq("company_id", id).eq("user_id", user.id).order("name"),
      supabase
        .from("outreach")
        .select("*")
        .eq("company_id", id)
        .eq("user_id", user.id)
        .order("date_sent", { ascending: false }),
      supabase
        .from("notes")
        .select("*")
        .eq("entity_type", "company")
        .eq("entity_id", id)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  if (!company) notFound();

  return (
    <CompanyDetailClient
      company={company}
      applications={applications ?? []}
      contacts={contacts ?? []}
      outreach={outreach ?? []}
      notes={notes ?? []}
    />
  );
}
