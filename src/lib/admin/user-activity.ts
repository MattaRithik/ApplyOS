import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { Application } from "@/lib/types/database";
import type { AiParserResult } from "@/lib/ai-parser/schema";

export type ActivityKind = "applications" | "parsing";
export interface ActivityPage<T> {
  entries: T[];
  total: number;
  page: number;
  pageSize: number;
}

export type AdminApplication = Omit<Application, "user_id" | "company_id" | "resume_id">;

export interface AdminParseAttempt {
  id: string;
  created_at: string;
  status: string;
  model: string | null;
  cache_hit: boolean;
  fallback_used: boolean;
  error_category: string | null;
  input_characters: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  estimated_total_cost_usd: number | null;
  latency_ms: number | null;
  request_id: string | null;
  parser_schema_version: string | null;
  job_description: string | null;
  job_url: string | null;
  parsed_result: AiParserResult | null;
}

// Explicit projections prevent future sensitive columns from being exposed.
const APPLICATION_COLUMNS = "id, company_name, job_title, job_url, job_description, location, work_mode, employment_type, salary_min, salary_max, salary_currency, visa_sponsorship_notes, visa_sponsorship_status, date_applied, status, priority_score, cover_letter_used, referral_person, referral_email, referral_phone, recruiter_name, hr_email, recruiter_linkedin_url, hiring_manager_linkedin_url, notes, follow_up_date, final_result, source, keywords, required_skills, preferred_skills, resume_match_score, is_archived, created_at, updated_at";
const PARSING_COLUMNS = "id, created_at, status, model, cache_hit, fallback_used, error_category, input_characters, input_tokens, output_tokens, total_tokens, estimated_total_cost_usd, latency_ms, request_id, parser_schema_version";

/** Call only after requireOwner; scope every privileged query to the selected user. */
export async function getUserActivity(userId: string, kind: ActivityKind, page: number, pageSize: number): Promise<ActivityPage<AdminApplication> | ActivityPage<AdminParseAttempt> | null> {
  const supabase = createServiceRoleClient();
  const { data: auth, error: authError } = await supabase.auth.admin.getUserById(userId);
  if (authError) {
    if (authError.status === 404) return null;
    throw new Error("Failed to look up user.");
  }
  if (!auth?.user) return null;

  const from = page * pageSize;
  if (kind === "applications") {
    const { data, count, error } = await supabase.from("applications")
      .select(APPLICATION_COLUMNS, { count: "exact" }).eq("user_id", userId)
      .order("created_at", { ascending: false }).order("id", { ascending: false })
      .range(from, from + pageSize - 1);
    if (error) throw new Error("Failed to load applications.");
    return { entries: (data ?? []) as unknown as AdminApplication[], total: count ?? 0, page, pageSize };
  }

  const { data, count, error } = await supabase.from("ai_parser_usage")
    .select(PARSING_COLUMNS, { count: "exact" }).eq("user_id", userId)
    .order("created_at", { ascending: false }).order("id", { ascending: false })
    .range(from, from + pageSize - 1);
  if (error) throw new Error("Failed to load parsing activity.");
  const rows = (data ?? []) as unknown as Omit<AdminParseAttempt, "job_description" | "job_url" | "parsed_result">[];
  // Only read context belonging to the already user-scoped usage rows.
  const details = rows.length ? await supabase.from("ai_parser_attempt_details")
    .select("usage_id, job_description, job_url, parsed_result").in("usage_id", rows.map((r) => r.id)) : { data: [], error: null };
  if (details.error) throw new Error("Failed to load posting context. Apply the admin user activity migration.");
  const contextById = new Map((details.data ?? []).map((r) => [r.usage_id, r]));
  return {
    entries: rows.map((r) => {
      const context = contextById.get(r.id);
      return { ...r, job_description: context?.job_description ?? null, job_url: context?.job_url ?? null, parsed_result: context?.parsed_result ?? null };
    }),
    total: count ?? 0, page, pageSize,
  };
}
