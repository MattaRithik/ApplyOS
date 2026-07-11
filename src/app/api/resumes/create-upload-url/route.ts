import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { buildResumeObjectKey, createResumeUploadUrl } from "@/lib/storage/b2";
import {
  ALLOWED_RESUME_MIME_TYPES,
  MAX_RESUME_FILE_SIZE_BYTES,
  getFileExtension,
  isAllowedResumeExtension,
  isAllowedResumeMimeType,
  sanitizeOriginalFileName,
  canonicalMimeType,
} from "@/lib/utils/resume";
import { isSameOriginMutation, readJsonBody } from "@/lib/security/request";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";

const uploadRequestSchema = z
  .object({
    fileName: z.string().trim().min(1).max(255).refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
    fileType: z.string().trim().max(150),
    fileSize: z.number().int().positive().max(MAX_RESUME_FILE_SIZE_BYTES),
    displayName: z.string().trim().min(1).max(150).optional(),
  })
  .strict();

/**
 * Step 1 of the resume upload flow: verify the caller, validate the file,
 * reserve a `resumes` row, and mint a short-lived signed PUT URL for
 * Backblaze B2. The browser never sees B2 credentials — only this one
 * single-use, time-limited URL.
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
  if (!(await consumeApiRateLimit(user.id, "resume_upload", 60 * 60, 20))) {
    return NextResponse.json({ error: "Upload rate limit reached." }, { status: 429 });
  }
  const serviceClient = createServiceRoleClient();

  const json = await readJsonBody(request, 8 * 1024);
  if (!json.ok) return NextResponse.json({ error: json.error }, { status: json.status });
  const parsedBody = uploadRequestSchema.safeParse(json.value);
  if (!parsedBody.success) return NextResponse.json({ error: "Invalid upload request." }, { status: 400 });
  const { fileName, fileType, fileSize, displayName: displayNameInput } = parsedBody.data;

  const extensionFromName = getFileExtension(fileName);
  const extension = isAllowedResumeExtension(extensionFromName) ? extensionFromName : null;

  if (!extension) {
    return NextResponse.json(
      { error: "Only PDF, DOC, and DOCX files are allowed." },
      { status: 400 }
    );
  }

  const canonicalType = canonicalMimeType(extension);
  if (fileType && (!isAllowedResumeMimeType(fileType) || ALLOWED_RESUME_MIME_TYPES[fileType] !== extension)) {
    return NextResponse.json({ error: "The file extension and MIME type do not match." }, { status: 400 });
  }

  if (fileSize <= 0 || fileSize > MAX_RESUME_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `File must be under ${MAX_RESUME_FILE_SIZE_BYTES / (1024 * 1024)}MB.` },
      { status: 400 }
    );
  }

  const displayName = displayNameInput || fileName.replace(/\.[^.]+$/, "").trim().slice(0, 150);
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

  const { data: resume, error: insertError } = await serviceClient
    .from("resumes")
    .insert({
      id: resumeId,
      user_id: user.id,
      display_name: displayName,
      original_file_name: fileName,
      storage_provider: "backblaze_b2",
      storage_key: storageKey,
      file_extension: extension,
      file_type: canonicalType,
      file_size: fileSize,
      status: "uploading",
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Failed to reserve the upload." }, { status: 500 });
  }

  try {
    const { url, expiresIn } = await createResumeUploadUrl(storageKey, canonicalType);
    return NextResponse.json({
      resume_id: resume.id,
      signed_upload_url: url,
      expires_in: expiresIn,
    });
  } catch {
    // Roll back the reserved row if we can't even hand back an upload URL.
    await serviceClient.from("resumes").delete().eq("id", resumeId).eq("user_id", user.id);
    return NextResponse.json({ error: "Failed to prepare the upload." }, { status: 500 });
  }
}
