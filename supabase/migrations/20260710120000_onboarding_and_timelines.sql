-- =====================================================================
-- ApplyOS — Onboarding + Dashboard Timelines
-- Adds: optional user-category onboarding, an international-student
-- profile table, and a generic pinned-timeline (countdown) table used by
-- the dashboard "Important Timelines" section.
--
-- Safe to re-run: guarded with IF NOT EXISTS / OR REPLACE where possible,
-- matches the conventions in supabase/schema.sql. Does not drop or
-- destructively alter any existing table, column, or row. Existing users
-- are left with onboarding_status = 'not_started' via the column default
-- below (no explicit UPDATE needed — see comment inline).
-- =====================================================================

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

do $$ begin
  create type user_category as enum (
    'us_citizen_or_permanent_resident',
    'international_student_us',
    'other_temporary_authorization',
    'prefer_not_to_answer'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type onboarding_status as enum ('not_started', 'skipped', 'completed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type visa_status as enum ('f1', 'j1', 'other', 'prefer_not_to_answer');
exception when duplicate_object then null; end $$;

do $$ begin
  create type program_level as enum ('bachelors', 'masters', 'phd', 'certificate', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type stem_designated_status as enum ('yes', 'no', 'unsure');
exception when duplicate_object then null; end $$;

do $$ begin
  create type authorization_stage as enum (
    'enrolled', 'preparing_for_cpt', 'using_cpt', 'preparing_for_opt',
    'opt_application_pending', 'opt_approved', 'post_completion_opt',
    'preparing_for_stem_opt', 'stem_opt_application_pending', 'on_stem_opt', 'other'
  );
exception when duplicate_object then null; end $$;

-- Kept intentionally narrow — new calculated timeline types belong in
-- src/lib/config/immigration-rules.ts first, then here.
do $$ begin
  create type timeline_type as enum (
    'fixed_date', 'i20_program_end', 'opt_earliest_filing', 'opt_general_latest_filing',
    'opt_start', 'opt_end', 'stem_opt_preparation', 'ead_expiration',
    'end_of_month', 'end_of_quarter', 'end_of_year', 'custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type timeline_category as enum (
    'academic', 'immigration', 'job_search', 'interview', 'personal', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type timeline_source as enum ('user', 'profile', 'calculated');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- profiles — add onboarding + user-category columns
-- ---------------------------------------------------------------------

-- `not null default 'not_started'` means every pre-existing row is
-- backfilled to 'not_started' by Postgres as part of adding the column —
-- no separate UPDATE statement is needed or safe to skip accidentally.
alter table profiles add column if not exists user_category user_category;
alter table profiles add column if not exists onboarding_status onboarding_status not null default 'not_started';
alter table profiles add column if not exists onboarding_completed_at timestamptz;
alter table profiles add column if not exists onboarding_skipped_at timestamptz;
alter table profiles add column if not exists timezone text;

-- ---------------------------------------------------------------------
-- international_student_profiles — 1:1 with auth.users, only created
-- for users who actually fill in international-student details. Kept
-- separate from `profiles` so the common table stays small and every
-- other user's row never carries a wall of null immigration columns.
-- ---------------------------------------------------------------------

create table if not exists international_student_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  visa_status visa_status,
  program_level program_level,
  program_name text,
  school_name text,
  i20_program_end_date date,
  expected_graduation_date date,
  stem_designated_status stem_designated_status,
  current_authorization_stage authorization_stage,
  -- Optional, never surfaced on dashboard cards/exports/logs — see
  -- src/lib/export/fetch-entity.ts OMIT_COLUMNS.
  sevis_id text,
  opt_start_date date,
  opt_end_date date,
  ead_expiration_date date,
  stem_opt_expiration_date date,
  -- Days-before-deadline the user opted into for dashboard emphasis.
  -- ApplyOS has no email/push notification system yet (see
  -- docs comment in src/lib/actions/timelines.ts) — this only affects
  -- in-app dashboard highlighting today.
  reminder_days_before smallint[] not null default '{}',
  -- Lets a user hide immigration features/cards without losing data.
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table international_student_profiles add column if not exists visa_status visa_status;
alter table international_student_profiles add column if not exists program_level program_level;
alter table international_student_profiles add column if not exists program_name text;
alter table international_student_profiles add column if not exists school_name text;
alter table international_student_profiles add column if not exists i20_program_end_date date;
alter table international_student_profiles add column if not exists expected_graduation_date date;
alter table international_student_profiles add column if not exists stem_designated_status stem_designated_status;
alter table international_student_profiles add column if not exists current_authorization_stage authorization_stage;
alter table international_student_profiles add column if not exists sevis_id text;
alter table international_student_profiles add column if not exists opt_start_date date;
alter table international_student_profiles add column if not exists opt_end_date date;
alter table international_student_profiles add column if not exists ead_expiration_date date;
alter table international_student_profiles add column if not exists stem_opt_expiration_date date;
alter table international_student_profiles add column if not exists reminder_days_before smallint[] not null default '{}';
alter table international_student_profiles add column if not exists enabled boolean not null default true;
alter table international_student_profiles add column if not exists created_at timestamptz not null default now();
alter table international_student_profiles add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_intl_student_profiles_user on international_student_profiles(user_id);

drop trigger if exists trg_intl_student_profiles_updated_at on international_student_profiles;
create trigger trg_intl_student_profiles_updated_at before update on international_student_profiles
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- user_timelines — dashboard countdown cards (system-generated or
-- custom). At most 3 rows per user may have is_pinned = true, one per
-- dashboard_slot (1/2/3) — enforced below by a check constraint plus a
-- partial unique index, not just client-side logic.
-- ---------------------------------------------------------------------

create table if not exists user_timelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  icon text,
  timeline_type timeline_type not null default 'custom',
  category timeline_category not null default 'other',
  -- Source of truth for 'fixed_date'/'custom' rows. For rows derived
  -- from international_student_profiles or computed on the fly
  -- (opt_earliest_filing, end_of_month, ...) this is intentionally left
  -- null — the concrete date is resolved at read time by
  -- src/lib/timelines/resolve.ts so it's never a stale cached number.
  target_date date,
  rolling_rule text check (rolling_rule in ('end_of_month', 'end_of_quarter', 'end_of_year')),
  source timeline_source not null default 'user',
  is_system_generated boolean not null default false,
  is_pinned boolean not null default false,
  dashboard_slot smallint check (dashboard_slot in (1, 2, 3)),
  sort_order integer not null default 0,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_user_timelines_pinned_requires_slot
    check (is_pinned = false or dashboard_slot is not null)
);

-- Upgrade path for installs predating any of these columns.
alter table user_timelines add column if not exists title text not null default 'Untitled timeline';
alter table user_timelines add column if not exists description text;
alter table user_timelines add column if not exists icon text;
alter table user_timelines add column if not exists timeline_type timeline_type not null default 'custom';
alter table user_timelines add column if not exists category timeline_category not null default 'other';
alter table user_timelines add column if not exists target_date date;
alter table user_timelines add column if not exists rolling_rule text;
alter table user_timelines add column if not exists source timeline_source not null default 'user';
alter table user_timelines add column if not exists is_system_generated boolean not null default false;
alter table user_timelines add column if not exists is_pinned boolean not null default false;
alter table user_timelines add column if not exists dashboard_slot smallint;
alter table user_timelines add column if not exists sort_order integer not null default 0;
alter table user_timelines add column if not exists completed_at timestamptz;
alter table user_timelines add column if not exists archived_at timestamptz;
alter table user_timelines add column if not exists created_at timestamptz not null default now();
alter table user_timelines add column if not exists updated_at timestamptz not null default now();
alter table user_timelines alter column title drop default;

create index if not exists idx_user_timelines_user on user_timelines(user_id);

-- The actual "max 3 pinned, one per slot" enforcement: a partial unique
-- index means the database itself rejects a second row pinned to the
-- same slot for the same user, so this can never be bypassed by a bug
-- (or a malicious request) in the client or a server action.
drop index if exists uniq_user_timelines_user_slot;
create unique index if not exists uniq_user_timelines_user_slot
  on user_timelines(user_id, dashboard_slot)
  where is_pinned and archived_at is null;

drop trigger if exists trg_user_timelines_updated_at on user_timelines;
create trigger trg_user_timelines_updated_at before update on user_timelines
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------

alter table international_student_profiles enable row level security;
alter table user_timelines enable row level security;

do $$
declare
  t text;
begin
  foreach t in array array['international_student_profiles', 'user_timelines']
  loop
    execute format('drop policy if exists "%1$s_select_own" on %1$s', t);
    execute format('create policy "%1$s_select_own" on %1$s for select using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "%1$s_insert_own" on %1$s', t);
    execute format('create policy "%1$s_insert_own" on %1$s for insert with check (auth.uid() = user_id)', t);
    execute format('drop policy if exists "%1$s_update_own" on %1$s', t);
    execute format('create policy "%1$s_update_own" on %1$s for update using (auth.uid() = user_id)', t);
    execute format('drop policy if exists "%1$s_delete_own" on %1$s', t);
    execute format('create policy "%1$s_delete_own" on %1$s for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- Export integration — let the existing export system include a
-- clearly-labeled "International Student Profile" sheet. SEVIS ID is
-- stripped in src/lib/export/fetch-entity.ts regardless of this value.
-- ---------------------------------------------------------------------

alter type export_entity add value if not exists 'international_profile';
