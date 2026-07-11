import "server-only";
import { randomBytes } from "node:crypto";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { recordAuditEvent } from "@/lib/admin/audit";

export interface SecurityActionParams {
  actorUserId: string;
  targetUserId: string;
  requestId?: string;
}

export interface SecurityActionResult {
  ok: boolean;
  error?: string;
}

/**
 * Sends Supabase's own password-recovery email to the target's verified,
 * on-file address — the browser never supplies (or sees) an email
 * address or token here. Audited without ever recording the token or
 * email body.
 */
export async function sendPasswordResetForUser(params: SecurityActionParams): Promise<SecurityActionResult> {
  const supabase = createServiceRoleClient();
  const { data: userData, error: lookupError } = await supabase.auth.admin.getUserById(params.targetUserId);
  if (lookupError || !userData?.user?.email || !userData.user.email_confirmed_at) {
    return { ok: false, error: "User not found." };
  }

  const { error } = await supabase.auth.resetPasswordForEmail(userData.user.email);

  if (error) return { ok: false, error: "Failed to send reset email." };
  await recordAuditEvent({
    actorUserId: params.actorUserId,
    actionType: "password_reset_sent",
    targetUserId: params.targetUserId,
    requestId: params.requestId,
  });
  return { ok: true };
}

/**
 * There is no dedicated "revoke all sessions for user X" admin endpoint
 * in the Supabase JS SDK reachable without the target's own access
 * token. The safe, documented lever available server-side is rotating
 * the account's password to a freshly generated random secret, which
 * immediately invalidates sign-in with the old password. Any already-
 * live access token remains valid until its own (short) expiry — this
 * is a known limitation, not a full instant revocation, and is
 * documented as such rather than overclaimed.
 */
export async function revokeSessionsForUser(params: SecurityActionParams): Promise<SecurityActionResult> {
  const supabase = createServiceRoleClient();
  const randomPassword = randomBytes(32).toString("base64url");
  const { error } = await supabase.auth.admin.updateUserById(params.targetUserId, { password: randomPassword });

  if (error) return { ok: false, error: "Failed to revoke sessions." };
  await recordAuditEvent({
    actorUserId: params.actorUserId,
    actionType: "sessions_revoked",
    targetUserId: params.targetUserId,
    requestId: params.requestId,
  });
  return { ok: true };
}

export async function disableUser(params: SecurityActionParams): Promise<SecurityActionResult> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.auth.admin.updateUserById(params.targetUserId, { ban_duration: "876000h" });

  if (error) return { ok: false, error: "Failed to disable account." };
  await recordAuditEvent({
    actorUserId: params.actorUserId,
    actionType: "user_disabled",
    targetUserId: params.targetUserId,
    requestId: params.requestId,
  });
  return { ok: true };
}

export async function enableUser(params: SecurityActionParams): Promise<SecurityActionResult> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.auth.admin.updateUserById(params.targetUserId, { ban_duration: "none" });

  if (error) return { ok: false, error: "Failed to re-enable account." };
  await recordAuditEvent({
    actorUserId: params.actorUserId,
    actionType: "user_enabled",
    targetUserId: params.targetUserId,
    requestId: params.requestId,
  });
  return { ok: true };
}
