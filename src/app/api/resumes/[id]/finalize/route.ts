import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resumeObjectExists } from "@/lib/storage/b2";

/**
 * Step 2 of the resume upload flow: after the browser PUTs the file
 * directly to B2 using the signed URL, it calls this route to confirm the
 * upload landed and flip the row from "uploading" to "uploaded".
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
    .select("id, storage_key, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  if (resume.status === "uploaded") {
    return NextResponse.json({ resume });
  }

  const { exists, size } = await resumeObjectExists(resume.storage_key);
  if (!exists) {
    await supabase.from("resumes").update({ status: "failed" }).eq("id", id).eq("user_id", user.id);
    return NextResponse.json(
      { error: "The file was never received by storage. Please try uploading again." },
      { status: 400 }
    );
  }

  const { data: updated, error: updateError } = await supabase
    .from("resumes")
    .update({
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
      ...(size ? { file_size: size } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ resume: updated });
}
