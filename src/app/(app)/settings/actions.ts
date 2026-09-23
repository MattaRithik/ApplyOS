"use server";

import { ensureProfile } from "@/lib/profiles/ensure-profile";
import { parseTargetRoles } from "@/lib/ai-parser/target-roles";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAllowedKeys } from "@/lib/validation/common";

export interface ProfileInput {
  full_name?: string | null;
  target_role?: string | null;
  job_search_start_date?: string | null;
}

export async function updateProfile(input: ProfileInput) {
  assertAllowedKeys(input, ["full_name", "target_role", "job_search_start_date"]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (input.full_name && input.full_name.length > 200) throw new Error("Name is too long.");
  if (input.target_role !== undefined) {
    if ((input.target_role?.length ?? 0) > 1000) throw new Error("Keep target roles under 1,000 characters.");
    const roles = parseTargetRoles(input.target_role);
    if (roles.length > 15 || roles.some((role) => role.length > 60)) throw new Error("Enter up to 15 short role names, each under 60 characters.");
    input = { ...input, target_role: roles.join(", ") };
  }

  const { data: profile, error: profileError } = await ensureProfile(supabase, user);
  if (profileError || !profile) throw new Error("Could not load your profile. Please try again.");
  const existingSettings = profile.settings && typeof profile.settings === "object" && !Array.isArray(profile.settings) ? profile.settings : {};
  const updates = input.target_role !== undefined
    ? { ...input, settings: { ...existingSettings, target_roles_setup_completed: true } }
    : input;

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
  return data;
}
