-- =====================================================================
-- ApplyOS — Administrator-managed access control
--
-- Replaces the old AI_PARSER_ALLOWED_EMAIL single-email allowlist with:
--   - app_user_roles         one role per user (owner / admin / user)
--   - ai_parser_entitlements one AI-parser entitlement per user
--   - admin_audit_log        append-only log of administrative actions
--
-- All three tables are server-write-only by design, same pattern as
-- ai_parser_usage/ai_parser_cache: RLS is enabled, ordinary users get a
-- select-own policy where reading their own row is useful (roles,
-- entitlements), and there is deliberately NO insert/update/delete
-- policy for `authenticated` on any of them — every mutation happens
-- through createServiceRoleClient() from owner-only server routes
-- (src/lib/admin/*), which bypasses RLS entirely. admin_audit_log gets
-- no policy at all for `authenticated` — it is only ever read through a
-- server endpoint that has already verified the caller is the owner.
-- =====================================================================

-- ---------------------------------------------------------------------
-- app_user_roles
-- ---------------------------------------------------------------------

create table if not exists app_user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'user' check (role in ('owner', 'admin', 'user')),
  granted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_app_user_roles_role on app_user_roles(role);

drop trigger if exists trg_app_user_roles_updated_at on app_user_roles;
create trigger trg_app_user_roles_updated_at before update on app_user_roles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- ai_parser_entitlements — one row per user who is allowed to use the
-- AI parser at all. Absence of a row (or enabled = false, or a set
-- suspended_at/expired expires_at) means no access. The owner account
-- gets an explicit enabled row via the app-level bootstrap
-- (src/lib/admin/roles.ts) rather than an implicit rule, so its access
-- is easy to inspect and audit like anyone else's.
-- ---------------------------------------------------------------------

create table if not exists ai_parser_entitlements (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default false,
  daily_request_limit integer check (daily_request_limit is null or daily_request_limit > 0),
  monthly_budget_usd numeric(10, 2) check (monthly_budget_usd is null or monthly_budget_usd >= 0),
  granted_by uuid references auth.users(id) on delete set null,
  granted_at timestamptz,
  suspended_at timestamptz,
  suspension_reason text,
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index if not exists idx_ai_parser_entitlements_enabled on ai_parser_entitlements(enabled);

drop trigger if exists trg_ai_parser_entitlements_updated_at on ai_parser_entitlements;
create trigger trg_ai_parser_entitlements_updated_at before update on ai_parser_entitlements
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- admin_audit_log — append-only. actor/target reference auth.users with
-- ON DELETE SET NULL (not CASCADE) so the log survives account deletion.
-- metadata must only ever contain non-sensitive administrative fields —
-- enforced by convention in src/lib/admin/audit.ts, never raw provider
-- responses, tokens, or application content.
-- ---------------------------------------------------------------------

create table if not exists admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action_type text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_log_target on admin_audit_log(target_user_id, created_at);
create index if not exists idx_admin_audit_log_actor on admin_audit_log(actor_user_id, created_at);
create index if not exists idx_admin_audit_log_action on admin_audit_log(action_type, created_at);

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table app_user_roles enable row level security;
alter table ai_parser_entitlements enable row level security;
alter table admin_audit_log enable row level security;

drop policy if exists "app_user_roles_select_own" on app_user_roles;
create policy "app_user_roles_select_own" on app_user_roles for select using (auth.uid() = user_id);

drop policy if exists "ai_parser_entitlements_select_own" on ai_parser_entitlements;
create policy "ai_parser_entitlements_select_own" on ai_parser_entitlements for select using (auth.uid() = user_id);

-- Deliberately no policy of any kind for admin_audit_log + `authenticated`:
-- RLS with zero policies denies all access, including to the row's own
-- actor/target. Reads happen only via the owner-only /api/admin/audit-log
-- route using the service-role client.
