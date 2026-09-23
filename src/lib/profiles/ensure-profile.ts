import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";

/** Caller must pass the user returned by auth.getUser(), never a client-supplied ID. */
export async function ensureProfile(supabase: SupabaseClient, user: User) {
  const existing = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (existing.error || existing.data) return existing;

  // Some older accounts predate the profile-creation trigger. Only insert a
  // missing row; ignore conflicts so concurrent requests cannot reset a profile.
  const admin = createServiceRoleClient();
  const { error } = await admin.from("profiles").upsert({
    id: user.id,
    email: user.email ?? null,
    full_name: typeof user.user_metadata?.full_name === "string" ? user.user_metadata.full_name : null,
  }, { onConflict: "id", ignoreDuplicates: true });
  if (error) return { data: null, error };
  // Re-read through the authenticated client so RLS still governs access.
  return supabase.from("profiles").select("*").eq("id", user.id).single();
}
