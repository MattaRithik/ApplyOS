import "server-only";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type AdminActionType =
  | "ai_access_granted"
  | "ai_access_revoked"
  | "ai_access_suspended"
  | "ai_access_reactivated"
  | "ai_limits_updated"
  | "password_reset_sent"
  | "sessions_revoked"
  | "user_disabled"
  | "user_enabled";

export interface RecordAuditEventInput {
  actorUserId: string;
  actionType: AdminActionType;
  targetUserId?: string | null;
  /** Non-sensitive administrative fields only — never tokens, passwords, API keys, or application content. */
  metadata?: Record<string, unknown>;
  requestId?: string | null;
}

const SENSITIVE_KEY = /(authorization|cookie|password|secret|token|api[_-]?key|service[_-]?role)/i;
const SECRET_LIKE_VALUE = /(sk-[A-Za-z0-9_-]{16,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|Bearer\s+\S+)/i;

export function sanitizeAuditMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEY.test(key)) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && SECRET_LIKE_VALUE.test(value)) {
      sanitized[key] = "[REDACTED]";
    } else if (value === null || ["string", "number", "boolean"].includes(typeof value)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export async function recordAuditEvent(input: RecordAuditEventInput): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase.from("admin_audit_log").insert({
    actor_user_id: input.actorUserId,
    action_type: input.actionType,
    target_user_id: input.targetUserId ?? null,
    metadata: sanitizeAuditMetadata(input.metadata ?? {}),
    request_id: input.requestId ?? null,
  });
  if (error) throw new Error("Failed to record the administrative audit event.");
}

export interface AuditLogEntry {
  id: string;
  actorUserId: string | null;
  actionType: string;
  targetUserId: string | null;
  metadata: Record<string, unknown>;
  requestId: string | null;
  createdAt: string;
}

export interface AuditLogPage {
  entries: AuditLogEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export async function listAuditLog(page: number, pageSize: number): Promise<AuditLogPage> {
  const supabase = createServiceRoleClient();
  const from = page * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await supabase
    .from("admin_audit_log")
    .select("id, actor_user_id, action_type, target_user_id, metadata, request_id, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw new Error("Failed to read the administrative audit log.");

  return {
    entries: (data ?? []).map((row) => ({
      id: row.id,
      actorUserId: row.actor_user_id,
      actionType: row.action_type,
      targetUserId: row.target_user_id,
      metadata: (row.metadata as Record<string, unknown>) ?? {},
      requestId: row.request_id,
      createdAt: row.created_at,
    })),
    total: count ?? 0,
    page,
    pageSize,
  };
}

/**
 * Abuse guard for sensitive, repeatable actions (e.g. password-reset
 * emails): counts audit rows of the given action type against the given
 * target within a trailing window. Reuses the audit log itself rather
 * than standing up separate rate-limit infrastructure — proportionate
 * for a personal app's admin surface, which sees at most a handful of
 * these actions per day.
 */
export async function checkRecentActionRate(
  actionType: AdminActionType,
  targetUserId: string,
  opts: { windowMinutes: number; maxCount: number }
): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const since = new Date(Date.now() - opts.windowMinutes * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("admin_audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action_type", actionType)
    .eq("target_user_id", targetUserId)
    .gte("created_at", since);

  if (error) return false;

  return (count ?? 0) < opts.maxCount;
}
