import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertResumeObjectKeyOwnership, createResumeDownloadUrl } from "@/lib/storage/b2";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";
import { canonicalMimeType, isAllowedResumeExtension } from "@/lib/utils/resume";

const uuidSchema = z.string().uuid();

/**
 * Mints a short-lived signed GET URL for a resume. Ownership is checked
 * against `resumes.user_id = auth.uid()` before any B2 call is made — a
 * user can never reach another user's file by guessing/changing an id.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!uuidSchema.safeParse(id).success) return NextResponse.json({ error: "Invalid resume id." }, { status: 400 });
  const disposition = new URL(request.url).searchParams.get("disposition") === "attachment" ? "attachment" : "inline";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (!(await consumeApiRateLimit(user.id, "resume_download", 60 * 60, 120))) {
    return NextResponse.json({ error: "Download rate limit reached." }, { status: 429 });
  }

  const { data: resume, error } = await supabase
    .from("resumes")
    .select("id, storage_key, display_name, file_extension, status")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  if (resume.status !== "uploaded") {
    return NextResponse.json({ error: "This resume hasn't finished uploading yet." }, { status: 409 });
  }

  const downloadFileName = resume.file_extension
    ? `${resume.display_name}.${resume.file_extension}`
    : resume.display_name;

  try {
    assertResumeObjectKeyOwnership(resume.storage_key, user.id);
    const contentType = isAllowedResumeExtension(resume.file_extension ?? "")
      ? canonicalMimeType(resume.file_extension)
      : "application/octet-stream";
    const { url, expiresIn } = await createResumeDownloadUrl(resume.storage_key, downloadFileName, disposition, contentType);

    return NextResponse.json({ url, expires_in: expiresIn, file_name: downloadFileName });
  } catch {
    return NextResponse.json({ error: "Failed to prepare the download." }, { status: 502 });
  }
}
