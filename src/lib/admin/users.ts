import "server-only";
import type { User } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { getUserRole, type AppRole } from "@/lib/admin/roles";
import { getEntitlement } from "@/lib/ai-parser/entitlement";

// Bounded fetch from Supabase's admin.listUsers — appropriate for a
// personal app with a handful of accounts. A larger deployment would
// need real server-side search (e.g. a synced users table) instead of
// pulling every auth user into the server process on each request.
const MAX_AUTH_USERS_FETCH = 1000;
const AUTH_USERS_PAGE_SIZE = 200;

export interface AdminAiAccessSummary {
  enabled: boolean;
  suspended: boolean;
  suspensionReason: string | null;
  expiresAt: string | null;
  dailyRequestLimit: number | null;
  monthlyBudgetUsd: number | null;
}

export interface AdminUserSummary {
  id: string;
  email: string | null;
  emailVerified: boolean;
  displayName: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  banned: boolean;
  role: AppRole;
  aiAccess: AdminAiAccessSummary;
  usageThisMonth: { requests: number; estimatedCostUsd: number };
}

export interface AdminUserListPage {
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminUserActivityRow {
  id: string;
  createdAt: string;
  model: string | null;
  status: string;
  cacheHit: boolean;
  fallbackUsed: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  totalTokens: number | null;
  estimatedCostUsd: number | null;
  latencyMs: number | null;
}

export interface AdminUserDetail extends AdminUserSummary {
  usageAllTime: { requests: number; estimatedCostUsd: number };
  recentActivity: AdminUserActivityRow[];
}

function monthStartUtc(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

function isBanned(u: Pick<User, "id"> & { banned_until?: string | null }): boolean {
  if (!u.banned_until) return false;
  return new Date(u.banned_until).getTime() > Date.now();
}

async function fetchAllAuthUsers(supabase: ReturnType<typeof createServiceRoleClient>): Promise<User[]> {
  const all: User[] = [];
  let page = 1;
  while (all.length < MAX_AUTH_USERS_FETCH) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: AUTH_USERS_PAGE_SIZE });
    if (error || !data) throw new Error("Failed to enumerate auth users.");
    all.push(...data.users);
    if (data.users.length < AUTH_USERS_PAGE_SIZE) break;
    page += 1;
  }
  return all;
}

/**
 * Server-side search, aggregation, and pagination — the browser only
 * ever receives the requested page of safe account metadata, never the
 * full user list or raw usage rows.
 */
export async function listUsers(opts: { search?: string; page: number; pageSize: number }): Promise<AdminUserListPage> {
  const supabase = createServiceRoleClient();
  const authUsers = await fetchAllAuthUsers(supabase);
  const ids = authUsers.map((u) => u.id);
  if (ids.length === 0) return { users: [], total: 0, page: opts.page, pageSize: opts.pageSize };

  const [profilesResult, rolesResult, entitlementsResult, usageResult] = await Promise.all([
    supabase.from("profiles").select("id, full_name").in("id", ids),
    supabase.from("app_user_roles").select("user_id, role, revoked_at").in("user_id", ids),
    supabase
      .from("ai_parser_entitlements")
      .select("user_id, enabled, daily_request_limit, monthly_budget_usd, suspended_at, suspension_reason, expires_at")
      .in("user_id", ids),
    supabase.from("ai_parser_usage").select("user_id, estimated_total_cost_usd").in("user_id", ids).gte("created_at", monthStartUtc()),
  ]);
  if (profilesResult.error || rolesResult.error || entitlementsResult.error || usageResult.error) {
    throw new Error("Failed to load administrative user metadata.");
  }
  const profiles = profilesResult.data;
  const roles = rolesResult.data;
  const entitlements = entitlementsResult.data;
  const usageRows = usageResult.data;

  const profileMap = new Map((profiles ?? []).map((p) => [p.id as string, p.full_name as string | null]));
  const roleMap = new Map((roles ?? []).map((r) => [r.user_id as string, r]));
  const entitlementMap = new Map((entitlements ?? []).map((e) => [e.user_id as string, e]));

  const usageByUser = new Map<string, { requests: number; costUsd: number }>();
  for (const row of usageRows ?? []) {
    const cur = usageByUser.get(row.user_id) ?? { requests: 0, costUsd: 0 };
    cur.requests += 1;
    cur.costUsd += Number(row.estimated_total_cost_usd ?? 0);
    usageByUser.set(row.user_id, cur);
  }

  let summaries: AdminUserSummary[] = authUsers.map((u) => {
    const roleRow = roleMap.get(u.id);
    const role: AppRole = roleRow && !roleRow.revoked_at ? (roleRow.role as AppRole) : "user";
    const ent = entitlementMap.get(u.id);
    const usage = usageByUser.get(u.id) ?? { requests: 0, costUsd: 0 };
    return {
      id: u.id,
      email: u.email ?? null,
      emailVerified: !!u.email_confirmed_at,
      displayName: profileMap.get(u.id) ?? null,
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at ?? null,
      banned: isBanned(u),
      role,
      aiAccess: {
        enabled: ent?.enabled ?? false,
        suspended: !!ent?.suspended_at,
        suspensionReason: ent?.suspension_reason ?? null,
        expiresAt: ent?.expires_at ?? null,
        dailyRequestLimit: ent?.daily_request_limit ?? null,
        monthlyBudgetUsd: ent?.monthly_budget_usd !== null && ent?.monthly_budget_usd !== undefined ? Number(ent.monthly_budget_usd) : null,
      },
      usageThisMonth: { requests: usage.requests, estimatedCostUsd: usage.costUsd },
    };
  });

  const search = opts.search?.trim().toLowerCase() ?? "";
  if (search) {
    summaries = summaries.filter(
      (s) => (s.email ?? "").toLowerCase().includes(search) || (s.displayName ?? "").toLowerCase().includes(search)
    );
  }

  summaries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = summaries.length;
  const start = opts.page * opts.pageSize;
  const pageItems = summaries.slice(start, start + opts.pageSize);

  return { users: pageItems, total, page: opts.page, pageSize: opts.pageSize };
}

/** Full detail for one user — still only account/access/usage metadata, never application data. */
export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const supabase = createServiceRoleClient();
  const { data: authData, error } = await supabase.auth.admin.getUserById(userId);
  if (error || !authData?.user) return null;
  const u = authData.user;

  const [profileResult, role, entitlement, monthResult, allTimeResult, recentResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", userId).maybeSingle(),
    getUserRole(userId),
    getEntitlement(userId),
    supabase.from("ai_parser_usage").select("estimated_total_cost_usd").eq("user_id", userId).gte("created_at", monthStartUtc()),
    supabase.from("ai_parser_usage").select("estimated_total_cost_usd").eq("user_id", userId),
    supabase
      .from("ai_parser_usage")
      .select(
        "id, created_at, model, status, cache_hit, fallback_used, input_tokens, output_tokens, total_tokens, estimated_total_cost_usd, latency_ms"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (profileResult.error || monthResult.error || allTimeResult.error || recentResult.error) {
    throw new Error("Failed to load administrative user detail.");
  }
  const profile = profileResult.data;
  const monthRows = monthResult.data;
  const allTimeRows = allTimeResult.data;
  const recentRows = recentResult.data;

  const sumCost = (rows: { estimated_total_cost_usd: number | null }[] | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.estimated_total_cost_usd ?? 0), 0);

  return {
    id: u.id,
    email: u.email ?? null,
    emailVerified: !!u.email_confirmed_at,
    displayName: profile?.full_name ?? null,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    banned: isBanned(u),
    role,
    aiAccess: {
      enabled: entitlement?.enabled ?? false,
      suspended: !!entitlement?.suspendedAt,
      suspensionReason: entitlement?.suspensionReason ?? null,
      expiresAt: entitlement?.expiresAt ?? null,
      dailyRequestLimit: entitlement?.dailyRequestLimit ?? null,
      monthlyBudgetUsd: entitlement?.monthlyBudgetUsd ?? null,
    },
    usageThisMonth: { requests: (monthRows ?? []).length, estimatedCostUsd: sumCost(monthRows) },
    usageAllTime: { requests: (allTimeRows ?? []).length, estimatedCostUsd: sumCost(allTimeRows) },
    recentActivity: (recentRows ?? []).map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      model: r.model,
      status: r.status,
      cacheHit: r.cache_hit,
      fallbackUsed: r.fallback_used,
      inputTokens: r.input_tokens,
      outputTokens: r.output_tokens,
      totalTokens: r.total_tokens,
      estimatedCostUsd: r.estimated_total_cost_usd,
      latencyMs: r.latency_ms,
    })),
  };
}

export interface AdminOverview {
  totalUsers: number;
  usersWithAiAccess: number;
  suspendedAiAccess: number;
  aiRequestsThisMonth: number;
  aiCostThisMonthUsd: number;
}

export async function getOverview(): Promise<AdminOverview> {
  const supabase = createServiceRoleClient();
  const authUsers = await fetchAllAuthUsers(supabase);

  const [entitlementsResult, monthResult] = await Promise.all([
    supabase.from("ai_parser_entitlements").select("enabled, suspended_at"),
    supabase.from("ai_parser_usage").select("estimated_total_cost_usd").gte("created_at", monthStartUtc()),
  ]);
  if (entitlementsResult.error || monthResult.error) throw new Error("Failed to load administrative overview.");
  const entitlements = entitlementsResult.data;
  const monthRows = monthResult.data;

  const usersWithAiAccess = (entitlements ?? []).filter((e) => e.enabled && !e.suspended_at).length;
  const suspendedAiAccess = (entitlements ?? []).filter((e) => e.enabled && e.suspended_at).length;

  return {
    totalUsers: authUsers.length,
    usersWithAiAccess,
    suspendedAiAccess,
    aiRequestsThisMonth: (monthRows ?? []).length,
    aiCostThisMonthUsd: (monthRows ?? []).reduce((s, r) => s + Number(r.estimated_total_cost_usd ?? 0), 0),
  };
}
