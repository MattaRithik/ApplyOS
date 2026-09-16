import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getNormalizedOwnerEmail } from "@/lib/admin/roles";
import { isBanned } from "@/lib/admin/users";
import { recordAuditEvent } from "@/lib/admin/audit";
import { assertResumeObjectKeyOwnership, deleteResumeObject } from "@/lib/storage/b2";

export async function deleteDisabledUser(params: {
  actorUserId: string;
  targetUserId: string;
  confirmation: string;
  requestId: string;
}): Promise<{ ok: true; warning?: string } | { ok: false; status: number; error: string }> {
  const { actorUserId, targetUserId, requestId } = params;
  if (actorUserId === targetUserId) {
    return { ok: false, status: 400, error: "You cannot delete your own account." };
  }
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.auth.admin.getUserById(targetUserId);
  if (error || !data?.user) {
    return { ok: false, status: 404, error: "User not found." };
  }
  const user = data.user;
  const { data: role, error: roleError } = await supabase.from("app_user_roles")
    .select("role, revoked_at").eq("user_id", targetUserId).maybeSingle();
  if (roleError) throw new Error("Failed to verify account role.");
  if ((role?.role === "owner" && !role.revoked_at) ||
      (user.email && user.email.trim().toLowerCase() === getNormalizedOwnerEmail())) {
    return { ok: false, status: 400, error: "The permanent owner account cannot be deleted." };
  }
  if (!isBanned(user)) {
    return { ok: false, status: 409, error: "Disable this account before deleting it." };
  }
  if (params.confirmation !== (user.email || user.id)) {
    return { ok: false, status: 400, error: "Confirmation does not match this account. Type its email address (or user ID if it has no email)." };
  }

  // Persist the attempt before any destructive operation. Keep the ID in
  // metadata because auth deletion sets audit-log foreign keys to null.
  await recordAuditEvent({ actorUserId, targetUserId, requestId,
    actionType: "user_deletion_requested", metadata: { deletedUserId: targetUserId } });

  // Remove linked files before cascading away the records that identify them.
  // Page explicitly so accounts with many uploads do not leave files behind.
  const pageSize = 100;
  for (let offset = 0; ; offset += pageSize) {
    const { data: resumes, error: resumeError } = await supabase.from("resumes")
      .select("id, storage_key").eq("user_id", targetUserId).order("id").range(offset, offset + pageSize - 1);
    if (resumeError) throw new Error("Failed to load account files.");
    try {
      for (const resume of resumes ?? []) {
        assertResumeObjectKeyOwnership(resume.storage_key, targetUserId);
        await deleteResumeObject(resume.storage_key);
      }
    } catch {
      return { ok: false, status: 502, error: "File cleanup did not finish. The account is still disabled; some files may already be removed. Retry deletion." };
    }
    if ((resumes ?? []).length < pageSize) break;
  }

  // Hard deletion removes auth.users and the app records with ON DELETE CASCADE.
  const { error: deleteError } = await supabase.auth.admin.deleteUser(targetUserId, false);
  if (deleteError) {
    return { ok: false, status: 502, error: "Account deletion failed after file cleanup. The account is still disabled. Retry deletion." };
  }
  try {
    await recordAuditEvent({ actorUserId, requestId, actionType: "user_deleted",
      metadata: { deletedUserId: targetUserId } });
  } catch {
    // Deletion has already committed; do not tell the UI to retry it.
    return { ok: true, warning: "Account deleted, but the completion audit event could not be saved. The deletion request is recorded." };
  }
  return { ok: true };
}
