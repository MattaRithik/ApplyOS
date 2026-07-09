"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus } from "@/lib/types/database";

export interface ApplicationInput {
  company_name: string;
  job_title: string;
  job_url?: string | null;
  job_description?: string | null;
  location?: string | null;
  work_mode?: string | null;
  employment_type?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
  visa_sponsorship_notes?: string | null;
  date_applied?: string | null;
  status?: ApplicationStatus;
  priority_score?: number;
  resume_id?: string | null;
  cover_letter_used?: string | null;
  referral_person?: string | null;
  recruiter_name?: string | null;
  hr_email?: string | null;
  recruiter_linkedin_url?: string | null;
  hiring_manager_linkedin_url?: string | null;
  notes?: string | null;
  follow_up_date?: string | null;
  source?: string | null;
  keywords?: string[];
  required_skills?: string[];
  preferred_skills?: string[];
  resume_match_score?: number | null;
}

async function findOrCreateCompany(userId: string, companyName: string) {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("companies")
    .select("id")
    .eq("user_id", userId)
    .ilike("name", companyName)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabase
    .from("companies")
    .insert({ user_id: userId, name: companyName })
    .select("id")
    .single();
  if (error) return null;
  return created.id as string;
}

export async function createApplication(input: ApplicationInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const companyId = await findOrCreateCompany(user.id, input.company_name);

  const { data, error } = await supabase
    .from("applications")
    .insert({ ...input, user_id: user.id, company_id: companyId })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/applications");
  revalidatePath("/dashboard");
  revalidatePath("/companies");
  return data;
}

export async function updateApplication(id: string, input: Partial<ApplicationInput>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  let companyId: string | null | undefined = undefined;
  if (input.company_name) {
    companyId = await findOrCreateCompany(user.id, input.company_name);
  }

  const { data, error } = await supabase
    .from("applications")
    .update({ ...input, ...(companyId !== undefined ? { company_id: companyId } : {}) })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/applications");
  revalidatePath(`/applications/${id}`);
  revalidatePath("/dashboard");
  return data;
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus) {
  return updateApplication(id, { status });
}

export async function saveParsedJobDetails(
  applicationId: string,
  sourceUrl: string | null,
  rawJobDescription: string,
  parsed: Record<string, { value: unknown; confidence: number }>
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const fieldConfidence: Record<string, number> = {};
  for (const [key, field] of Object.entries(parsed)) {
    fieldConfidence[key] = field.confidence;
  }

  await supabase.from("parsed_job_details").insert({
    user_id: user.id,
    application_id: applicationId,
    source_url: sourceUrl,
    raw_job_description: rawJobDescription,
    parsed_company: parsed.company?.value ?? null,
    parsed_job_title: parsed.jobTitle?.value ?? null,
    parsed_role_type: parsed.roleType?.value ?? null,
    parsed_location: parsed.location?.value ?? null,
    parsed_work_mode: parsed.workMode?.value || null,
    parsed_employment_type: parsed.employmentType?.value || null,
    parsed_salary_range: parsed.salaryRange?.value ?? null,
    required_skills: parsed.requiredSkills?.value ?? [],
    preferred_skills: parsed.preferredSkills?.value ?? [],
    education: parsed.education?.value ?? null,
    years_experience: parsed.yearsExperience?.value ?? null,
    visa_notes: parsed.visaNotes?.value ?? null,
    deadline: parsed.deadline?.value || null,
    recruiter_info: parsed.recruiterInfo?.value ?? null,
    keywords: parsed.keywords?.value ?? [],
    job_summary: parsed.jobSummary?.value ?? null,
    missing_skills: parsed.missingSkills?.value ?? [],
    suggested_cold_email_angle: parsed.suggestedColdEmailAngle?.value ?? null,
    suggested_follow_up_date: parsed.suggestedFollowUpDate?.value || null,
    priority_score: parsed.priorityScore?.value ?? null,
    field_confidence: fieldConfidence,
  });
}

export async function deleteApplication(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("applications").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/applications");
  revalidatePath("/dashboard");
}
