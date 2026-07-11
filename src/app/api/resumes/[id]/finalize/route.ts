import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import {
  assertResumeObjectKeyOwnership,
  buildFinalResumeObjectKey,
  deleteResumeObject,
  inspectResumeObject,
  promoteResumeObject,
  type ResumeObjectInspection,
} from "@/lib/storage/b2";
import { canonicalMimeType, isAllowedResumeExtension, MAX_RESUME_FILE_SIZE_BYTES, sanitizeOriginalFileName } from "@/lib/utils/resume";
import { isSameOriginMutation } from "@/lib/security/request";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";

const uuidSchema = z.string().uuid();

/**
 * Step 2 of the resume upload flow: after the browser PUTs the file
 * directly to B2 using the signed URL, it calls this route to confirm the
 * upload landed and flip the row from "uploading" to "uploaded".
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
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
  if (!(await consumeApiRateLimit(user.id, "resume_finalize", 60 * 60, 30))) {
    return NextResponse.json({ error: "Finalize rate limit reached." }, { status: 429 });
  }
  const serviceClient = createServiceRoleClient();

  const { data: resume, error: fetchError } = await supabase
    .from("resumes")
    .select("id, storage_key, status, file_extension, file_type, file_size, original_file_name")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (fetchError || !resume) {
    return NextResponse.json({ error: "Resume not found" }, { status: 404 });
  }

  if (resume.status === "uploaded") {
    return NextResponse.json({ resume });
  }

  if (!isAllowedResumeExtension(resume.file_extension ?? "")) {
    return NextResponse.json({ error: "Resume metadata is invalid." }, { status: 409 });
  }
  let inspection: ResumeObjectInspection;
  try {
    assertResumeObjectKeyOwnership(resume.storage_key, user.id);
    inspection = await inspectResumeObject(resume.storage_key, resume.file_extension);
  } catch {
    return NextResponse.json({ error: "Storage validation is temporarily unavailable." }, { status: 502 });
  }
  const expectedType = canonicalMimeType(resume.file_extension);
  const invalidObject =
    !inspection.exists ||
    !inspection.signatureValid ||
    !inspection.eTag ||
    !inspection.size ||
    inspection.size > MAX_RESUME_FILE_SIZE_BYTES ||
    inspection.size !== Number(resume.file_size) ||
    (inspection.contentType !== undefined && inspection.contentType !== expectedType);

  if (invalidObject) {
    if (inspection.exists) await deleteResumeObject(resume.storage_key).catch(() => undefined);
    await serviceClient.from("resumes").update({ status: "failed" }).eq("id", id).eq("user_id", user.id);
    return NextResponse.json(
      { error: "The uploaded file failed validation. Please upload a valid PDF, DOC, or DOCX file." },
      { status: 400 }
    );
  }

  const finalStorageKey = buildFinalResumeObjectKey(
    user.id,
    resume.id,
    sanitizeOriginalFileName(resume.original_file_name)
  );
  try {
    await promoteResumeObject(resume.storage_key, finalStorageKey, inspection.eTag!, expectedType);
  } catch {
    await deleteResumeObject(resume.storage_key).catch(() => undefined);
    await serviceClient.from("resumes").update({ status: "failed" }).eq("id", id).eq("user_id", user.id);
    return NextResponse.json({ error: "The upload changed during validation. Please upload it again." }, { status: 409 });
  }

  const { data: updated, error: updateError } = await serviceClient
    .from("resumes")
    .update({
      status: "uploaded",
      uploaded_at: new Date().toISOString(),
      file_size: inspection.size,
      storage_key: finalStorageKey,
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, display_name, original_file_name, file_extension, file_type, file_size, status, uploaded_at, target_role, version_notes, resume_match_score, missing_keywords, is_archived, created_at, updated_at")
    .single();

  if (updateError) {
    await deleteResumeObject(finalStorageKey).catch(() => undefined);
    return NextResponse.json({ error: "Failed to finalize the upload." }, { status: 500 });
  }

  await deleteResumeObject(resume.storage_key).catch(() => undefined);

  return NextResponse.json({ resume: updated });
}
