import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildResumeObjectKey, createResumeUploadUrl } from "@/lib/storage/b2";
import {
  ALLOWED_RESUME_MIME_TYPES,
  MAX_RESUME_FILE_SIZE_BYTES,
  getFileExtension,
  isAllowedResumeExtension,
  isAllowedResumeMimeType,
  sanitizeOriginalFileName,
} from "@/lib/utils/resume";

/**
 * Step 1 of the resume upload flow: verify the caller, validate the file,
 * reserve a `resumes` row, and mint a short-lived signed PUT URL for
 * Backblaze B2. The browser never sees B2 credentials — only this one
 * single-use, time-limited URL.
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
  const fileName = (body?.fileName as string | undefined)?.trim();
  const fileType = body?.fileType as string | undefined;
  const fileSize = Number(body?.fileSize);
  const displayNameInput = (body?.displayName as string | undefined)?.trim();

  if (!fileName || !fileType || !Number.isFinite(fileSize)) {
    return NextResponse.json({ error: "fileName, fileType, and fileSize are required" }, { status: 400 });
  }

  const extensionFromName = getFileExtension(fileName);
  const extension = isAllowedResumeMimeType(fileType)
    ? ALLOWED_RESUME_MIME_TYPES[fileType]
    : isAllowedResumeExtension(extensionFromName)
      ? extensionFromName
      : null;

  if (!extension) {
    return NextResponse.json(
      { error: "Only PDF, DOC, and DOCX files are allowed." },
      { status: 400 }
    );
  }

  if (fileSize <= 0 || fileSize > MAX_RESUME_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File must be under ${MAX_RESUME_FILE_SIZE_BYTES / (1024 * 1024)}MB.` },
      { status: 400 }
    );
  }

  const displayName = (displayNameInput || fileName.replace(/\.[^.]+$/, "")).slice(0, 150);
  if (!displayName) {
    return NextResponse.json({ error: "displayName is required" }, { status: 400 });
  }

  const { data: duplicate } = await supabase
    .from("resumes")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .ilike("display_name", displayName)
    .maybeSingle();

  if (duplicate) {
    return NextResponse.json(
      { error: "You already have a resume with this name." },
      { status: 409 }
    );
  }

  // The resume id is generated here (not left to the DB default) so the B2
  // object key can embed it — the browser never chooses the storage key.
  const resumeId = crypto.randomUUID();
  const safeFileName = sanitizeOriginalFileName(fileName);
  const storageKey = buildResumeObjectKey(user.id, resumeId, safeFileName);

  const { data: resume, error: insertError } = await supabase
    .from("resumes")
    .insert({
      id: resumeId,
      user_id: user.id,
      display_name: displayName,
      original_file_name: fileName,
      storage_provider: "backblaze_b2",
      storage_key: storageKey,
      file_extension: extension,
      file_type: fileType,
      file_size: fileSize,
      status: "uploading",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  try {
    const { url, expiresIn } = await createResumeUploadUrl(storageKey, fileType);
    return NextResponse.json({
      resume_id: resume.id,
      signed_upload_url: url,
      storage_key: storageKey,
      expires_in: expiresIn,
    });
  } catch (e) {
    // Roll back the reserved row if we can't even hand back an upload URL.
    await supabase.from("resumes").delete().eq("id", resumeId).eq("user_id", user.id);
    const message = e instanceof Error ? e.message : "Failed to create upload URL";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
