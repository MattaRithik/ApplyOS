import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSameOriginMutation, readJsonBody } from "@/lib/security/request";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";

const renameSchema = z
  .object({
    resumeId: z.string().uuid(),
    newDisplayName: z.string().trim().min(1).max(150).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
  })
  .strict();

/**
 * Renames a resume. The underlying B2 object is never touched — only
 * `display_name` changes. `original_file_name` and `storage_key` stay
 * exactly as they were set at upload time, so every application that
 * references this resume by id keeps working with no risk of a storage
 * copy/delete step ever failing partway.
 */
export async function POST(request: Request) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await consumeApiRateLimit(user.id, "resume_rename", 60 * 60, 60))) {
    return NextResponse.json({ error: "Rename rate limit reached." }, { status: 429 });
  }

  const json = await readJsonBody(request, 4 * 1024);
  if (!json.ok) return NextResponse.json({ error: json.error }, { status: json.status });
  const parsedBody = renameSchema.safeParse(json.value);
  if (!parsedBody.success) return NextResponse.json({ error: "Invalid rename request." }, { status: 400 });
  const { resumeId, newDisplayName } = parsedBody.data;

  const { data: resume, error: fetchError } = await supabase
    .from("resumes")
    .select("id, display_name")
    .eq("id", resumeId)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  if (newDisplayName.toLowerCase() === resume.display_name.toLowerCase()) {
    return NextResponse.json({ resume });
  }

  const { data: existing } = await supabase
    .from("resumes")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .ilike("display_name", newDisplayName)
    .neq("id", resumeId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You already have a resume with this name." },
      { status: 409 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("resumes")
    .update({ display_name: newDisplayName })
    .eq("id", resumeId)
    .eq("user_id", user.id)
    .select("id, display_name, original_file_name, file_extension, file_type, file_size, status, uploaded_at, target_role, version_notes, resume_match_score, missing_keywords, is_archived, created_at, updated_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: "Failed to rename the resume." }, { status: 500 });
  }

  return NextResponse.json({ resume: updated });
}
