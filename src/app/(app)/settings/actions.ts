"use server";

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
  if (input.target_role && input.target_role.length > 200) throw new Error("Target role is too long.");

  const { data, error } = await supabase
    .from("profiles")
    .update(input)
    .eq("id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  return data;
}
