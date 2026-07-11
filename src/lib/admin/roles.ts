import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";

export type AppRole = "owner" | "admin" | "user";

export class AdminAuthError extends Error {
  status: 401 | 403;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "AdminAuthError";
    this.status = status;
  }
}

/** Server-only bootstrap identity for the permanent root administrator — never trusted from the browser. */
export function getNormalizedOwnerEmail(): string | null {
  const raw = process.env.APP_OWNER_EMAIL;
  if (!raw || !raw.trim()) return null;
  return raw.trim().toLowerCase();
}

function isOwnerEmailMatch(user: User): boolean {
  const ownerEmail = getNormalizedOwnerEmail();
  if (!ownerEmail) return false;
  const userEmail = (user.email ?? "").trim().toLowerCase();
  return !!userEmail && userEmail === ownerEmail;
}

/**
 * Supabase JS v2 `User` exposes `email_confirmed_at`; some configurations
 * instead populate `confirmed_at`. Prefer `email_confirmed_at`, fall back
 * to `confirmed_at`, and only treat verification as failing when we have
 * positive evidence it's unset (explicit null) — an absent field
 * (undefined, e.g. some magic-link-only configs) is not treated as
 * unverified.
 */
function isEmailVerified(user: User): boolean {
  const emailConfirmedAt = (user as unknown as { email_confirmed_at?: string | null }).email_confirmed_at;
  const confirmedAt = (user as unknown as { confirmed_at?: string | null }).confirmed_at;
  const verifiedAt = emailConfirmedAt !== undefined ? emailConfirmedAt : confirmedAt;
  return typeof verifiedAt === "string" && verifiedAt.length > 0;
}

/** Throws AdminAuthError(401) if no session is present. */
export async function requireAuthenticatedUser(supabase: SupabaseClient): Promise<User> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new AdminAuthError("Not authenticated.", 401);
  }
  return user;
}

/**
 * Idempotently grants the `owner` role and an enabled AI entitlement to
 * the currently authenticated user IF their verified session email
 * matches APP_OWNER_EMAIL. This only ever acts on the user already
 * resolved by Supabase for the current session — there is no separate
 * lookup across all accounts, so there is no "multiple matches" case to
 * handle; auth.users enforces a unique email per account. If the caller
 * isn't the owner-email account, or the email isn't verified, this is a
 * no-op. Errors are the caller's responsibility (this never silently
 * grants access — see requireOwner, which treats a failed/absent
 * bootstrap as "not owner").
 */
export async function ensureOwnerBootstrap(user: User): Promise<void> {
  if (!isEmailVerified(user) || !isOwnerEmailMatch(user)) return;

  const supabase = createServiceRoleClient();
  const nowIso = new Date().toISOString();

  const { data: existingRole, error: roleLookupError } = await supabase
    .from("app_user_roles")
    .select("role, revoked_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (roleLookupError) throw new Error("Failed to verify owner role bootstrap state.");

  if (!existingRole || existingRole.role !== "owner" || existingRole.revoked_at) {
    const { error } = await supabase.from("app_user_roles").upsert({
      user_id: user.id,
      role: "owner",
      revoked_at: null,
      updated_at: nowIso,
    });
    if (error) throw new Error("Failed to bootstrap owner role.");
  }

  const { data: existingEntitlement, error: entitlementLookupError } = await supabase
    .from("ai_parser_entitlements")
    .select("enabled, suspended_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (entitlementLookupError) throw new Error("Failed to verify owner entitlement bootstrap state.");

  if (!existingEntitlement || !existingEntitlement.enabled || existingEntitlement.suspended_at) {
    const { error } = await supabase.from("ai_parser_entitlements").upsert({
      user_id: user.id,
      enabled: true,
      granted_by: user.id,
      granted_at: nowIso,
      suspended_at: null,
      suspension_reason: null,
    });
    if (error) throw new Error("Failed to bootstrap owner entitlement.");
  }
}

/** Looks up the user's role. Missing row or a revoked role both resolve to "user" — fail closed. */
export async function getUserRole(userId: string): Promise<AppRole> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("app_user_roles")
    .select("role, revoked_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data || data.revoked_at) return "user";
  return data.role === "owner" || data.role === "admin" ? data.role : "user";
}

/**
 * Throws AdminAuthError(401)/(403). Never trusts a client-supplied role
 * or email — always re-derives from the server-side session and the
 * app_user_roles table (service-role client, bypassing RLS by design).
 */
export async function requireOwner(supabase: SupabaseClient): Promise<User> {
  const user = await requireAuthenticatedUser(supabase);
  // Best-effort: if bootstrap itself fails (e.g. a transient DB error),
  // swallow it here and let the role check below fail closed to "not
  // owner" rather than throwing a different error shape.
  await ensureOwnerBootstrap(user).catch(() => {});

  const role = await getUserRole(user.id);
  if (role !== "owner") {
    throw new AdminAuthError("Owner access required.", 403);
  }
  return user;
}

/** Non-throwing variant for server components deciding UI visibility (e.g. the Settings "Administration" tab). */
export async function isOwner(supabase: SupabaseClient): Promise<boolean> {
  try {
    await requireOwner(supabase);
    return true;
  } catch {
    return false;
  }
}
