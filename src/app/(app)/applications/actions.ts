"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ApplicationStatus, VisaSponsorshipStatus, WorkMode, EmploymentType } from "@/lib/types/database";
import type { AiParserApiResponse } from "@/lib/ai-parser/schema";
import { assertOptionalOwnedEntity, assertOwnedEntity } from "@/lib/security/ownership";
import { assertAllowedKeys, httpUrlSchema, uuidSchema } from "@/lib/validation/common";

const APPLICATION_INPUT_KEYS = [
  "company_name", "job_title", "job_url", "job_description", "location", "work_mode", "employment_type",
  "salary_min", "salary_max", "salary_currency", "visa_sponsorship_notes", "visa_sponsorship_status", "date_applied",
  "status", "priority_score", "resume_id", "cover_letter_used", "referral_person", "referral_email", "referral_phone",
  "recruiter_name", "hr_email", "recruiter_linkedin_url", "hiring_manager_linkedin_url", "notes", "follow_up_date",
  "source", "keywords", "required_skills", "preferred_skills", "resume_match_score",
] as const;

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
  assertAllowedKeys(input, APPLICATION_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (!input.company_name?.trim() || input.company_name.length > 200) throw new Error("Invalid company name.");
  if (!input.job_title?.trim() || input.job_title.length > 200) throw new Error("Invalid job title.");
  if (input.job_url) httpUrlSchema.parse(input.job_url);
  if (input.recruiter_linkedin_url) httpUrlSchema.parse(input.recruiter_linkedin_url);
  if (input.hiring_manager_linkedin_url) httpUrlSchema.parse(input.hiring_manager_linkedin_url);
  if (input.job_description && input.job_description.length > 100_000) throw new Error("Job description is too long.");
  await assertOptionalOwnedEntity(supabase, user.id, "resume", input.resume_id);

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
  assertAllowedKeys(input, APPLICATION_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);
  await assertOwnedEntity(supabase, user.id, "application", id);
  await assertOptionalOwnedEntity(supabase, user.id, "resume", input.resume_id);
  if (input.company_name !== undefined && (!input.company_name.trim() || input.company_name.length > 200)) throw new Error("Invalid company name.");
  if (input.job_title !== undefined && (!input.job_title.trim() || input.job_title.length > 200)) throw new Error("Invalid job title.");
  if (input.job_url) httpUrlSchema.parse(input.job_url);
  if (input.recruiter_linkedin_url) httpUrlSchema.parse(input.recruiter_linkedin_url);
  if (input.hiring_manager_linkedin_url) httpUrlSchema.parse(input.hiring_manager_linkedin_url);
  if (input.job_description && input.job_description.length > 100_000) throw new Error("Job description is too long.");

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

const WORKPLACE_TO_WORK_MODE: Record<string, WorkMode | null> = {
  remote: "remote",
  hybrid: "hybrid",
  onsite: "onsite",
  unknown: null,
};

const EMPLOYMENT_TYPE_TO_DB: Record<string, EmploymentType | null> = {
  full_time: "full_time",
  part_time: "part_time",
  internship: "internship",
  contract: "contract",
  temporary: "temporary",
  seasonal: null,
  apprenticeship: null,
  unknown: null,
};

/** Persists the AI parser's structured output (from POST /api/ai-parser) onto an application. */
export async function saveParsedJobDetails(
  applicationId: string,
  sourceUrl: string | null,
  rawJobDescription: string,
  apiResponse: AiParserApiResponse
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(applicationId);
  await assertOwnedEntity(supabase, user.id, "application", applicationId);
  if (rawJobDescription.length > 100_000) throw new Error("Job description is too long.");
  if (sourceUrl) httpUrlSchema.parse(sourceUrl);

  const { result } = apiResponse;
  const { identity, location, employment, compensation, skills, experienceEducation, roleContent, immigration, metadata } = result;

  const salaryRange =
    compensation.salaryMinimum || compensation.salaryMaximum
      ? [compensation.salaryMinimum, compensation.salaryMaximum].filter((v) => v !== null).join(" - ")
      : null;

  const yearsExperience =
    experienceEducation.experienceText ||
    (experienceEducation.minimumYearsExperience !== null || experienceEducation.maximumYearsExperience !== null
      ? [experienceEducation.minimumYearsExperience, experienceEducation.maximumYearsExperience]
          .filter((v) => v !== null)
          .join("-")
      : null);

  const recruiterInfo = [identity.recruiterName, identity.recruiterEmail].filter(Boolean).join(" · ") || null;

  const { error } = await supabase.from("parsed_job_details").insert({
    user_id: user.id,
    application_id: applicationId,
    source_url: sourceUrl,
    raw_job_description: rawJobDescription,
    parsed_company: identity.companyName,
    parsed_job_title: identity.jobTitle,
    parsed_role_type: employment.roleCategory,
    parsed_location: location.rawLocation,
    parsed_work_mode: WORKPLACE_TO_WORK_MODE[location.workplaceType] ?? null,
    parsed_employment_type: EMPLOYMENT_TYPE_TO_DB[employment.employmentType] ?? null,
    parsed_salary_range: salaryRange,
    required_skills: skills.requiredSkills ?? [],
    preferred_skills: skills.preferredSkills ?? [],
    education: experienceEducation.educationLevel,
    years_experience: yearsExperience,
    visa_notes: immigration.sponsorshipText,
    deadline: toDateOrNull(roleContent.applicationDeadline),
    recruiter_info: recruiterInfo,
    keywords: skills.keywords ?? [],
    job_summary: roleContent.conciseSummary,
    model_used: apiResponse.modelUsed,
    parser_version: apiResponse.parserVersion,
    description_hash: apiResponse.descriptionHash,
    processing_time_ms: result.parseMeta.latencyMs,
    warnings: metadata.warnings ?? [],
    full_result: { result, provenance: result.provenance },
  });
  if (error) throw new Error("Failed to save parsed job details.");
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
  if (!company.website && meta.website && httpUrlSchema.safeParse(meta.website).success) patch.website = meta.website;
  if (!company.linkedin_url && meta.linkedinUrl && httpUrlSchema.safeParse(meta.linkedinUrl).success) patch.linkedin_url = meta.linkedinUrl;
  if (Object.keys(patch).length === 0) return;

  await supabase.from("companies").update(patch).eq("id", companyId).eq("user_id", user.id);
}

export async function deleteApplication(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);

  const { error } = await supabase.from("applications").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/applications");
  revalidatePath("/dashboard");
}
