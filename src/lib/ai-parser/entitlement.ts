import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { ensureOwnerBootstrap } from "@/lib/admin/roles";

export class ParserAuthError extends Error {
  status: 401 | 403;
  constructor(message: string, status: 401 | 403) {
    super(message);
    this.name = "ParserAuthError";
    this.status = status;
  }
}

export interface AiParserEntitlement {
  enabled: boolean;
  dailyRequestLimit: number | null;
  monthlyBudgetUsd: number | null;
  suspendedAt: string | null;
  suspensionReason: string | null;
  expiresAt: string | null;
  grantedAt: string | null;
}

export interface EffectiveLimits {
  dailyRequestLimit: number;
  monthlyBudgetUsd: number | null;
}

export interface AuthorizedParserContext {
  user: User;
  entitlement: AiParserEntitlement;
  limits: EffectiveLimits;
}

const DEFAULT_DAILY_LIMIT_FALLBACK = 100;

function defaultDailyLimit(): number {
  const raw = process.env.AI_PARSER_DEFAULT_DAILY_LIMIT;
  const parsed = raw && raw.trim() ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_DAILY_LIMIT_FALLBACK;
}

function defaultMonthlyBudgetUsd(): number | null {
  const raw = process.env.AI_PARSER_DEFAULT_MONTHLY_BUDGET_USD;
  if (!raw || !raw.trim()) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/** Single source of truth for AI entitlement lookup — always server-only, always scoped to one user_id. */
export async function getEntitlement(userId: string): Promise<AiParserEntitlement | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("ai_parser_entitlements")
    .select("enabled, daily_request_limit, monthly_budget_usd, suspended_at, suspension_reason, expires_at, granted_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;
  return {
    enabled: data.enabled,
    dailyRequestLimit: data.daily_request_limit,
    monthlyBudgetUsd: data.monthly_budget_usd !== null ? Number(data.monthly_budget_usd) : null,
    suspendedAt: data.suspended_at,
    suspensionReason: data.suspension_reason,
    expiresAt: data.expires_at,
    grantedAt: data.granted_at,
  };
}

/** Precedence: user-specific entitlement limit, then the global env default, then a safe hardcoded fallback. */
export function resolveEffectiveLimits(entitlement: AiParserEntitlement | null): EffectiveLimits {
  return {
    dailyRequestLimit: entitlement?.dailyRequestLimit ?? defaultDailyLimit(),
    monthlyBudgetUsd: entitlement?.monthlyBudgetUsd ?? defaultMonthlyBudgetUsd(),
  };
}

function isEntitlementActive(entitlement: AiParserEntitlement | null): boolean {
  if (!entitlement || !entitlement.enabled) return false;
  if (entitlement.suspendedAt) return false;
  if (entitlement.expiresAt && new Date(entitlement.expiresAt).getTime() <= Date.now()) return false;
  return true;
}

/**
 * Throws ParserAuthError(401) if unauthenticated, ParserAuthError(403) if
 * the account has no active AI entitlement (missing row, disabled,
 * suspended, or expired). This is the one place that decides whether an
 * OpenAI call is allowed to happen at all — the API route calls this
 * before touching the provider, the cache, or the rate limiter.
 */
export async function requireAIParserAccess(supabase: SupabaseClient): Promise<AuthorizedParserContext> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new ParserAuthError("Not authenticated.", 401);
  }

  // Grants the owner account its entitlement row the first time it
  // authenticates, without a manual SQL step. No-op for every other user.
  await ensureOwnerBootstrap(user).catch(() => {});

  const entitlement = await getEntitlement(user.id);
  if (!isEntitlementActive(entitlement)) {
    throw new ParserAuthError("AI parsing is not enabled for this account.", 403);
  }

  return { user, entitlement: entitlement!, limits: resolveEffectiveLimits(entitlement) };
}

/** Non-throwing variant for server components deciding UI visibility (parser button, panel, Add/Edit entry points). */
export async function hasAIParserAccess(supabase: SupabaseClient): Promise<boolean> {
  try {
    await requireAIParserAccess(supabase);
    return true;
  } catch {
    return false;
  }
}

/** For the user's own Settings "AI Parser Usage" tab — always the caller's own entitlement, never another user's. */
export async function getCurrentUserEntitlement(
  supabase: SupabaseClient
): Promise<{ entitlement: AiParserEntitlement | null; limits: EffectiveLimits } | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const entitlement = await getEntitlement(user.id);
  return { entitlement, limits: resolveEffectiveLimits(entitlement) };
}
