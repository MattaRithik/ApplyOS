import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { assertResumeObjectKeyOwnership, deleteResumeObject } from "@/lib/storage/b2";
import { isSameOriginMutation } from "@/lib/security/request";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";

const uuidSchema = z.string().uuid();

/**
 * Deletes a resume: verifies ownership, removes the B2 object, then the
 * DB row. B2 delete runs first (and is idempotent) so a failure here never
 * leaves an orphaned DB row pointing at a file that's actually gone.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSameOriginMutation(request)) {
    return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  }
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid resume id." }, { status: 400 });
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await consumeApiRateLimit(user.id, "resume_delete", 60 * 60, 30))) {
    return NextResponse.json({ error: "Delete rate limit reached." }, { status: 429 });
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
    assertResumeObjectKeyOwnership(resume.storage_key, user.id);
    await deleteResumeObject(resume.storage_key);
  } catch {
    return NextResponse.json({ error: "Failed to delete the stored file." }, { status: 502 });
  }

  const { error: deleteError } = await createServiceRoleClient()
    .from("resumes")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete resume metadata." }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
