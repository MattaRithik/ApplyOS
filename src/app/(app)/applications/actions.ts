"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus, VisaSponsorshipStatus } from "@/lib/types/database";
import type { JobIntelligenceResult } from "@/lib/parser/schema";

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
  visa_sponsorship_status?: VisaSponsorshipStatus;
  date_applied?: string | null;
  status?: ApplicationStatus;
  priority_score?: number;
  resume_id?: string | null;
  cover_letter_used?: string | null;
  referral_person?: string | null;
  referral_email?: string | null;
  referral_phone?: string | null;
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

/** Only pass through strings that actually parse as a date — parser output is never trusted blindly. */
function toDateOrNull(value: string | undefined | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

export async function saveParsedJobDetails(
  applicationId: string,
  sourceUrl: string | null,
  rawJobDescription: string,
  result: JobIntelligenceResult
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { extraction, intelligence, resumeComparison, warnings, meta } = result;

  const fieldConfidence: Record<string, number> = {};
  for (const [key, field] of Object.entries(extraction)) {
    if (field && typeof field === "object" && "confidence" in field) {
      fieldConfidence[key] = (field as { confidence: number }).confidence;
    }
  }

  const salaryRange =
    extraction.salaryMin || extraction.salaryMax
      ? [extraction.salaryMin?.value, extraction.salaryMax?.value].filter(Boolean).join(" - ")
      : null;

  const recruiterInfo = [extraction.recruiterName?.value, extraction.recruiterEmail?.value].filter(Boolean).join(" · ") || null;

  await supabase.from("parsed_job_details").insert({
    user_id: user.id,
    application_id: applicationId,
    source_url: sourceUrl,
    raw_job_description: rawJobDescription,
    parsed_company: extraction.companyName?.value ?? null,
    parsed_job_title: extraction.jobTitle?.value ?? null,
    parsed_role_type: extraction.roleCategory?.value ?? null,
    parsed_location: extraction.locations?.value?.join(", ") ?? null,
    parsed_work_mode: extraction.workMode?.value || null,
    parsed_employment_type: extraction.employmentType?.value || null,
    parsed_salary_range: salaryRange,
    required_skills: extraction.requiredSkills?.value ?? [],
    preferred_skills: extraction.preferredSkills?.value ?? [],
    education: extraction.education?.value ?? null,
    years_experience: extraction.experience?.value ?? null,
    visa_notes: extraction.visaStatus?.value ?? null,
    deadline: toDateOrNull(extraction.deadline?.value),
    recruiter_info: recruiterInfo,
    keywords: extraction.keywords?.value ?? [],
    job_summary: extraction.jobSummary?.value ?? null,
    missing_skills: resumeComparison?.missingSkills ?? intelligence.missingSkills ?? [],
    suggested_cold_email_angle: intelligence.suggestedColdEmailAngle ?? null,
    suggested_follow_up_date: toDateOrNull(intelligence.suggestedFollowUpDate),
    priority_score: intelligence.priorityScore ?? null,
    field_confidence: fieldConfidence,
    model_used: meta.modelUsed,
    parser_version: meta.parserVersion,
    description_hash: meta.descriptionHash,
    processing_time_ms: meta.processingTimeMs,
    warnings,
    full_result: result,
  });
}

/** Fills in a company's website/LinkedIn URL from parser output, but only if the field is still empty. */
export async function updateCompanyMetaIfEmpty(
  companyId: string | null,
  meta: { website?: string | null; linkedinUrl?: string | null }
) {
  if (!companyId || (!meta.website && !meta.linkedinUrl)) return;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: company } = await supabase
    .from("companies")
    .select("website, linkedin_url")
    .eq("id", companyId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!company) return;

  const patch: Record<string, string> = {};
  if (!company.website && meta.website) patch.website = meta.website;
  if (!company.linkedin_url && meta.linkedinUrl) patch.linkedin_url = meta.linkedinUrl;
  if (Object.keys(patch).length === 0) return;

  await supabase.from("companies").update(patch).eq("id", companyId).eq("user_id", user.id);
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
