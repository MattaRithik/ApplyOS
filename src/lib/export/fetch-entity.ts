import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExportEntity } from "@/lib/types/database";
import { getFollowUpItems } from "@/lib/data/follow-ups";

const TABLE_BY_ENTITY: Record<Exclude<ExportEntity, "full_backup" | "follow_ups">, string> = {
  applications: "applications",
  companies: "companies",
  contacts: "contacts",
  outreach: "outreach",
  interviews: "interview_rounds",
  resumes: "resumes",
};

const OMIT_COLUMNS = new Set(["user_id"]);

function stripRow(row: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!OMIT_COLUMNS.has(key)) out[key] = value;
  }
  return out;
}

export async function fetchEntityRows(
  supabase: SupabaseClient,
  userId: string,
  entity: Exclude<ExportEntity, "full_backup">
) {
  if (entity === "follow_ups") {
    const items = await getFollowUpItems(supabase, userId);
    return items.map((i) => ({
      context: i.context,
      title: i.title,
      company: i.companyName,
      contact: i.contactName,
      due_date: i.dueDate,
      link: i.link,
    }));
  }

  const table = TABLE_BY_ENTITY[entity];
  const { data, error } = await supabase.from(table).select("*").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map(stripRow);
}

export const EXPORT_ENTITIES: { value: Exclude<ExportEntity, "full_backup">; label: string }[] = [
  { value: "applications", label: "Applications" },
  { value: "companies", label: "Companies" },
  { value: "contacts", label: "Contacts" },
  { value: "outreach", label: "Cold Emails / Outreach" },
  { value: "interviews", label: "Interviews" },
  { value: "follow_ups", label: "Follow-ups" },
  { value: "resumes", label: "Resume Metadata" },
];
