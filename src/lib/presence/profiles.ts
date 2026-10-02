import "server-only";
import type { User } from "@supabase/supabase-js";
import { getNormalizedOwnerEmail } from "@/lib/admin/roles";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** The configured administrator is excluded even before owner-role bootstrap. */
export function isActivityExcluded(user: Pick<User, "email">): boolean {
  const owner = getNormalizedOwnerEmail();
  return !!owner && user.email?.trim().toLowerCase() === owner;
}

export async function withProfileNames<T extends { user_id: string }>(rows: T[]): Promise<(T & { profile_name: string })[]> {
  if (rows.length === 0) return [];
  const ids = [...new Set(rows.map((row) => row.user_id))];
  const { data, error } = await createServiceRoleClient().from("profiles").select("id, full_name").in("id", ids);
  if (error) throw new Error("Unable to load activity profile names.");
  const names = new Map((data ?? []).map((profile) => [profile.id, profile.full_name?.trim()]));
  return rows.map((row) => ({ ...row, profile_name: names.get(row.user_id) || "Unnamed profile" }));
}
