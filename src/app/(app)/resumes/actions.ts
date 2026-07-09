"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ResumeMetadataInput {
  target_role?: string | null;
  version_notes?: string | null;
  resume_match_score?: number | null;
  missing_keywords?: string[];
}

export async function updateResumeMetadata(id: string, input: ResumeMetadataInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("resumes")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/resumes");
  revalidatePath(`/resumes/${id}`);
  return data;
}
