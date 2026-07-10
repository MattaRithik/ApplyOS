import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DuplicateInfo } from "@/lib/parser/schema";

/**
 * Looks for an existing application from the same user that's plausibly the
 * same posting: an exact job URL match, or a company + job title match.
 */
export async function detectDuplicateApplication(
  supabase: SupabaseClient,
  userId: string,
  params: { companyName?: string; jobTitle?: string; jobUrl?: string }
): Promise<DuplicateInfo> {
  const { companyName, jobTitle, jobUrl } = params;
  if (!jobUrl && !(companyName && jobTitle)) {
    return { isDuplicate: false };
  }

  let query = supabase
    .from("applications")
    .select("id, company_name, job_title, job_url, status")
    .eq("user_id", userId)
    .limit(5);

  if (jobUrl) {
    query = query.eq("job_url", jobUrl);
  } else if (companyName && jobTitle) {
    query = query.ilike("company_name", companyName).ilike("job_title", jobTitle);
  }

  const { data } = await query;
  if (!data || data.length === 0) return { isDuplicate: false };

  const match = data[0];
  const matchedOn: string[] = [];
  if (jobUrl && match.job_url === jobUrl) matchedOn.push("Job URL");
  if (companyName && match.company_name?.toLowerCase() === companyName.toLowerCase()) matchedOn.push("Company");
  if (jobTitle && match.job_title?.toLowerCase() === jobTitle.toLowerCase()) matchedOn.push("Job Title");

  return {
    isDuplicate: true,
    duplicateApplicationId: match.id as string,
    matchedOn,
  };
}
