"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAllowedKeys, uuidSchema } from "@/lib/validation/common";

export interface ResumeMetadataInput {
  target_role?: string | null;
  version_notes?: string | null;
  resume_match_score?: number | null;
  missing_keywords?: string[];
}

export async function updateResumeMetadata(id: string, input: ResumeMetadataInput) {
  assertAllowedKeys(input, ["target_role", "version_notes", "resume_match_score", "missing_keywords"]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);
  if (input.target_role && input.target_role.length > 200) throw new Error("Target role is too long.");
  if (input.version_notes && input.version_notes.length > 5_000) throw new Error("Version notes are too long.");

  const { data, error } = await supabase
    .from("resumes")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, display_name, original_file_name, file_extension, file_type, file_size, status, uploaded_at, target_role, version_notes, resume_match_score, missing_keywords, is_archived, created_at, updated_at")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/resumes");
  revalidatePath(`/resumes/${id}`);
  return data;
}
