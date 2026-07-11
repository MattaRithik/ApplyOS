import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type ApiRateLimitAction =
  | "resume_upload"
  | "resume_finalize"
  | "resume_download"
  | "resume_delete"
  | "resume_rename"
  | "admin_mutation";

/** Atomic, database-backed rate limit. Database failures fail closed. */
export async function consumeApiRateLimit(
  userId: string,
  action: ApiRateLimitAction,
  windowSeconds: number,
  maxCount: number
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("try_consume_api_rate_limit", {
    p_user_id: userId,
    p_action: action,
    p_window_seconds: windowSeconds,
    p_max_count: maxCount,
  });
  return !error && data === true;
}
