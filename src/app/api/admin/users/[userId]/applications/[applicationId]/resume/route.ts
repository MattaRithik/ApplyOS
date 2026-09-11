import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireOwner, AdminAuthError } from "@/lib/admin/roles";
import { recordAuditEvent } from "@/lib/admin/audit";
import { consumeApiRateLimit } from "@/lib/security/rate-limit";
import { assertResumeObjectKeyOwnership, createResumeDownloadUrl } from "@/lib/storage/b2";
import { canonicalMimeType, isAllowedResumeExtension } from "@/lib/utils/resume";

const paramsSchema = z.object({ userId: z.string().uuid(), applicationId: z.string().uuid() });
const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const errorResponse = (error: string, status: number) => NextResponse.json({ error }, { status, headers });

/** A normal new-tab link reaches this authenticated route before redirecting to B2. */
export async function GET(_request: Request, { params }: { params: Promise<{ userId: string; applicationId: string }> }) {
  let owner;
  try {
    owner = await requireOwner(await createClient());
  } catch (err) {
    if (err instanceof AdminAuthError) return errorResponse(err.message, err.status);
    return errorResponse("Authorization check failed.", 503);
  }
  const parsed = paramsSchema.safeParse(await params);
  if (!parsed.success) return errorResponse("Invalid application request.", 400);
  const { userId, applicationId } = parsed.data;

  try {
    if (!(await consumeApiRateLimit(owner.id, "resume_download", 60 * 60, 120))) {
      return errorResponse("Resume access rate limit reached.", 429);
    }
    const supabase = createServiceRoleClient();
    const { data: application, error: applicationError } = await supabase.from("applications")
      .select("resume_id").eq("id", applicationId).eq("user_id", userId).maybeSingle();
    if (applicationError) return errorResponse("Unable to load application.", 503);
    if (!application) return errorResponse("Application not found.", 404);
    if (!application.resume_id) return errorResponse("No resume is linked to this application.", 404);

    // Verify both relationships even when legacy data contains a mismatched resume id.
    const { data: resume, error: resumeError } = await supabase.from("resumes")
      .select("id, storage_key, display_name, file_extension, status")
      .eq("id", application.resume_id).eq("user_id", userId).maybeSingle();
    if (resumeError) return errorResponse("Unable to load resume.", 503);
    if (!resume) return errorResponse("The linked resume is no longer available.", 404);
    if (resume.status !== "uploaded") return errorResponse("This resume is not ready to open.", 409);

    assertResumeObjectKeyOwnership(resume.storage_key, userId);
    const fileName = resume.file_extension ? `${resume.display_name}.${resume.file_extension}` : resume.display_name;
    const contentType = isAllowedResumeExtension(resume.file_extension ?? "")
      ? canonicalMimeType(resume.file_extension) : "application/octet-stream";
    const { url } = await createResumeDownloadUrl(resume.storage_key, fileName, "inline", contentType);
    await recordAuditEvent({
      actorUserId: owner.id, targetUserId: userId, actionType: "user_application_resume_opened",
      metadata: { applicationId, resumeId: resume.id }, requestId: randomUUID(),
    });
    return NextResponse.redirect(url, { status: 302, headers });
  } catch {
    return errorResponse("Unable to open this resume. Please try again.", 503);
  }
}
