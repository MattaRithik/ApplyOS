import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import type { AiParserResult } from "@/lib/ai-parser/schema";

/** Keep posting context even when parsing fails or the request times out. */
export async function recordAttemptInput(usageId: string, jobDescription: string, jobUrl?: string): Promise<void> {
  const { error } = await createServiceRoleClient().from("ai_parser_attempt_details").insert({
    usage_id: usageId,
    job_description: jobDescription,
    job_url: jobUrl ?? null,
  });
  if (error) throw new Error("Failed to record parser input.");
}

export async function recordAttemptResult(usageId: string, result: AiParserResult): Promise<void> {
  const { error } = await createServiceRoleClient().from("ai_parser_attempt_details")
    .update({ parsed_result: result }).eq("usage_id", usageId);
  if (error) throw new Error("Failed to record parser result.");
}
