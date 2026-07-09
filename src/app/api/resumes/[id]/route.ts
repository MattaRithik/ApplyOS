import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteResumeObject } from "@/lib/storage/b2";

/**
 * Deletes a resume: verifies ownership, removes the B2 object, then the
 * DB row. B2 delete runs first (and is idempotent) so a failure here never
 * leaves an orphaned DB row pointing at a file that's actually gone.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: resume, error: fetchError } = await supabase
    .from("resumes")
    .select("id, storage_key")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  try {
    await deleteResumeObject(resume.storage_key);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Failed to delete file from storage";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const { error: deleteError } = await supabase
    .from("resumes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
