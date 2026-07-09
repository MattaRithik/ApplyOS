import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Renames a resume. The underlying B2 object is never touched — only
 * `display_name` changes. `original_file_name` and `storage_key` stay
 * exactly as they were set at upload time, so every application that
 * references this resume by id keeps working with no risk of a storage
 * copy/delete step ever failing partway.
 */
export async function POST(request: Request) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const resumeId = body?.resumeId as string | undefined;
  const newDisplayName = (body?.newDisplayName as string | undefined)?.trim();

  if (!resumeId || !newDisplayName) {
    return NextResponse.json(
      { error: "resumeId and newDisplayName are required" },
      { status: 400 }
    );
  }

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
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ resume: updated });
}
