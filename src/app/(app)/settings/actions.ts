"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ProfileInput {
  full_name?: string | null;
  target_role?: string | null;
  job_search_start_date?: string | null;
}

export async function updateProfile(input: ProfileInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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
