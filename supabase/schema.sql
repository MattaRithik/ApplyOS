-- =====================================================================
-- ApplyOS — Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
-- Safe to re-run: guarded with IF NOT EXISTS / OR REPLACE where possible.
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------

do $$ begin
  create type application_status as enum (
    'saved', 'planning_to_apply', 'applied', 'referral_requested',
    'hr_contacted', 'recruiter_screen', 'oa_assessment', 'first_round',
    'technical_round', 'superday_final_round', 'offer', 'accepted',
    'rejected', 'withdrawn', 'ghosted'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type work_mode as enum ('remote', 'hybrid', 'onsite');
exception when duplicate_object then null; end $$;

do $$ begin
  create type employment_type as enum (
    'full_time', 'part_time', 'internship', 'contract', 'temporary'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type visa_sponsorship_status as enum (
    'no_sponsorship', 'opt_accepted', 'cpt_accepted', 'h1b_available',
    'future_possible', 'requires_existing_auth', 'not_mentioned'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type relationship_type as enum (
    'recruiter', 'hiring_manager', 'hr', 'alumni', 'referral',
    'employee', 'professor', 'career_fair', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type outreach_type as enum (
    'cold_email', 'linkedin_dm', 'referral_request', 'follow_up',
    'thank_you', 'application_status_check', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type response_status as enum (
    'no_response', 'opened', 'replied_positive', 'replied_negative',
    'referred', 'meeting_scheduled', 'declined'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type interview_round_type as enum (
    'phone_screen', 'recruiter_screen', 'oa_assessment', 'first_round',
    'technical', 'behavioral', 'system_design', 'case_study',
    'superday', 'final_round', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type interview_result as enum (
    'pending', 'passed', 'failed', 'cancelled', 'no_show'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type template_category as enum (
    'recruiter_cold_email', 'hiring_manager_cold_email', 'alumni_referral_request',
    'linkedin_dm', 'follow_up_no_response', 'thank_you_after_interview',
    'interview_follow_up', 'career_fair_follow_up', 'referral_thank_you',
    'application_status_check', 'custom'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type follow_up_context as enum (
    'application', 'cold_email', 'interview', 'referral', 'general'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type export_format as enum ('xlsx', 'csv');
exception when duplicate_object then null; end $$;

do $$ begin
  create type export_entity as enum (
    'applications', 'companies', 'contacts', 'outreach',
    'interviews', 'follow_ups', 'resumes', 'full_backup'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------
-- Utility: updated_at trigger
-- ---------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ---------------------------------------------------------------------
-- profiles (extends auth.users)
-- ---------------------------------------------------------------------

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  target_role text,
  job_search_start_date date,
  theme_preference text default 'system',
  settings jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table profiles add column if not exists full_name text;
alter table profiles add column if not exists email text;
alter table profiles add column if not exists avatar_url text;
alter table profiles add column if not exists target_role text;
alter table profiles add column if not exists job_search_start_date date;
alter table profiles add column if not exists theme_preference text default 'system';
alter table profiles add column if not exists settings jsonb default '{}'::jsonb;
alter table profiles add column if not exists created_at timestamptz not null default now();
alter table profiles add column if not exists updated_at timestamptz not null default now();

drop trigger if exists trg_profiles_updated_at on profiles;
create trigger trg_profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_on_auth_user_created on auth.users;
create trigger trg_on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------
-- companies
-- ---------------------------------------------------------------------

create table if not exists companies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  website text,
  careers_page_url text,
  industry text,
  location text,
  linkedin_url text,
  sponsorship_friendly boolean,
  sponsorship_notes text,
  notes text,
  logo_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table companies add column if not exists name text not null default 'Untitled Company';
alter table companies add column if not exists website text;
alter table companies add column if not exists careers_page_url text;
alter table companies add column if not exists industry text;
alter table companies add column if not exists location text;
alter table companies add column if not exists linkedin_url text;
alter table companies add column if not exists sponsorship_friendly boolean;
alter table companies add column if not exists sponsorship_notes text;
alter table companies add column if not exists notes text;
alter table companies add column if not exists logo_url text;
alter table companies add column if not exists created_at timestamptz not null default now();
alter table companies add column if not exists updated_at timestamptz not null default now();
alter table companies alter column name drop default;

create index if not exists idx_companies_user on companies(user_id);
create unique index if not exists uniq_companies_user_name on companies(user_id, lower(name));

drop trigger if exists trg_companies_updated_at on companies;
create trigger trg_companies_updated_at before update on companies
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- resumes
-- ---------------------------------------------------------------------

-- Resume FILES live in Backblaze B2 (S3-compatible), never in Supabase Storage.
-- This table stores only metadata + the B2 object key — never a public URL.
-- `storage_key` is opaque to the browser; all reads/writes go through
-- server-side, ownership-checked API routes that mint short-lived signed
-- B2 URLs (see src/lib/storage/b2.ts and src/app/api/resumes/*).
create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  original_file_name text not null,
  storage_provider text not null default 'backblaze_b2',
  storage_key text not null unique,
  file_extension text check (file_extension in ('pdf', 'doc', 'docx')),
  file_type text,
  file_size bigint,
  status text not null default 'uploading' check (status in ('uploading', 'uploaded', 'failed')),
  uploaded_at timestamptz,
  target_role text,
  version_notes text,
  resume_match_score numeric,
  missing_keywords text[] default '{}',
  parsed_text text,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---- Migration for installs created before the Backblaze B2 move ----
-- No-ops on a fresh install (the CREATE TABLE above already has the final
-- shape); brings an existing `resumes` table from the old Supabase-Storage
-- schema (storage_path/file_name/file_size_bytes) up to date in place.
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'resumes' and column_name = 'storage_path')
     and not exists (select 1 from information_schema.columns where table_name = 'resumes' and column_name = 'storage_key') then
    alter table resumes rename column storage_path to storage_key;
  end if;

  if exists (select 1 from information_schema.columns where table_name = 'resumes' and column_name = 'file_size_bytes')
     and not exists (select 1 from information_schema.columns where table_name = 'resumes' and column_name = 'file_size') then
    alter table resumes rename column file_size_bytes to file_size;
  end if;

  -- Older installs stored the resume's name in a single `file_name` column;
  -- the current schema splits that into `display_name` (user-editable label)
  -- and `original_file_name` (the file as uploaded). Add both if missing and
  -- backfill from `file_name` before it's dropped below, so existing rows
  -- never end up with a null in a NOT NULL column (the bug that made
  -- PostgREST report display_name as missing from the schema cache).
  if not exists (select 1 from information_schema.columns where table_name = 'resumes' and column_name = 'display_name') then
    alter table resumes add column display_name text;
  end if;
  if not exists (select 1 from information_schema.columns where table_name = 'resumes' and column_name = 'original_file_name') then
    alter table resumes add column original_file_name text;
  end if;

  if exists (select 1 from information_schema.columns where table_name = 'resumes' and column_name = 'file_name') then
    update resumes set
      display_name = coalesce(display_name, file_name),
      original_file_name = coalesce(original_file_name, file_name)
    where file_name is not null;
    alter table resumes drop column file_name;
  end if;

  update resumes set display_name = coalesce(display_name, 'Untitled Resume') where display_name is null;
  update resumes set original_file_name = coalesce(original_file_name, display_name, 'resume.pdf') where original_file_name is null;

  alter table resumes alter column display_name set not null;
  alter table resumes alter column original_file_name set not null;
end $$;

alter table resumes add column if not exists file_size bigint;
alter table resumes add column if not exists storage_provider text not null default 'backblaze_b2';
alter table resumes add column if not exists file_type text;
alter table resumes add column if not exists status text not null default 'uploaded';
alter table resumes add column if not exists uploaded_at timestamptz;
alter table resumes add column if not exists parsed_text text;
alter table resumes add column if not exists target_role text;
alter table resumes add column if not exists version_notes text;
alter table resumes add column if not exists resume_match_score numeric;
alter table resumes add column if not exists missing_keywords text[] default '{}';
alter table resumes add column if not exists is_archived boolean not null default false;
alter table resumes add column if not exists file_extension text;
alter table resumes alter column file_extension drop not null;

-- Legacy rows predate `status`/`uploaded_at` and were already fully
-- uploaded under the old Supabase Storage flow.
update resumes set uploaded_at = created_at where status = 'uploaded' and uploaded_at is null;

create index if not exists idx_resumes_user on resumes(user_id);
create unique index if not exists uniq_resumes_user_display_name on resumes(user_id, lower(display_name)) where not is_archived;

drop trigger if exists trg_resumes_updated_at on resumes;
create trigger trg_resumes_updated_at before update on resumes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- applications
-- ---------------------------------------------------------------------

create table if not exists applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  company_name text not null,
  job_title text not null,
  job_url text,
  job_description text,
  location text,
  work_mode work_mode,
  employment_type employment_type,
  salary_min numeric,
  salary_max numeric,
  salary_currency text default 'USD',
  visa_sponsorship_notes text,
  visa_sponsorship_status visa_sponsorship_status not null default 'not_mentioned',
  date_applied date,
  status application_status not null default 'saved',
  priority_score numeric default 0 check (priority_score >= 0 and priority_score <= 100),
  resume_id uuid references resumes(id) on delete set null,
  cover_letter_used text,
  referral_person text,
  referral_email text,
  referral_phone text,
  recruiter_name text,
  hr_email text,
  recruiter_linkedin_url text,
  hiring_manager_linkedin_url text,
  notes text,
  follow_up_date date,
  final_result text,
  source text,
  keywords text[] default '{}',
  required_skills text[] default '{}',
  preferred_skills text[] default '{}',
  resume_match_score numeric,
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table applications add column if not exists company_id uuid references companies(id) on delete set null;
alter table applications add column if not exists company_name text not null default 'Unknown Company';
alter table applications add column if not exists job_title text not null default 'Untitled Role';
alter table applications add column if not exists job_url text;
alter table applications add column if not exists job_description text;
alter table applications add column if not exists location text;
alter table applications add column if not exists work_mode work_mode;
alter table applications add column if not exists employment_type employment_type;
alter table applications add column if not exists salary_min numeric;
alter table applications add column if not exists salary_max numeric;
alter table applications add column if not exists salary_currency text default 'USD';
alter table applications add column if not exists visa_sponsorship_notes text;
alter table applications add column if not exists visa_sponsorship_status visa_sponsorship_status not null default 'not_mentioned';
alter table applications add column if not exists date_applied date;
alter table applications add column if not exists status application_status not null default 'saved';
alter table applications add column if not exists priority_score numeric default 0;
alter table applications add column if not exists resume_id uuid references resumes(id) on delete set null;
alter table applications add column if not exists cover_letter_used text;
alter table applications add column if not exists referral_person text;
alter table applications add column if not exists referral_email text;
alter table applications add column if not exists referral_phone text;
alter table applications add column if not exists recruiter_name text;
alter table applications add column if not exists hr_email text;
alter table applications add column if not exists recruiter_linkedin_url text;
alter table applications add column if not exists hiring_manager_linkedin_url text;
alter table applications add column if not exists notes text;
alter table applications add column if not exists follow_up_date date;
alter table applications add column if not exists final_result text;
alter table applications add column if not exists source text;
alter table applications add column if not exists keywords text[] default '{}';
alter table applications add column if not exists required_skills text[] default '{}';
alter table applications add column if not exists preferred_skills text[] default '{}';
alter table applications add column if not exists resume_match_score numeric;
alter table applications add column if not exists is_archived boolean not null default false;
alter table applications add column if not exists created_at timestamptz not null default now();
alter table applications add column if not exists updated_at timestamptz not null default now();
alter table applications alter column company_name drop default;
alter table applications alter column job_title drop default;

create index if not exists idx_applications_user on applications(user_id);
create index if not exists idx_applications_company on applications(company_id);
create index if not exists idx_applications_status on applications(status);
create index if not exists idx_applications_follow_up on applications(follow_up_date);
create index if not exists idx_applications_resume on applications(resume_id);

drop trigger if exists trg_applications_updated_at on applications;
create trigger trg_applications_updated_at before update on applications
  for each row execute function set_updated_at();

-- Auto-log status changes into application_status_history
create table if not exists application_status_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  from_status application_status,
  to_status application_status not null,
  changed_at timestamptz not null default now(),
  notes text
);

-- Upgrade path for installs predating any of these columns.
alter table application_status_history add column if not exists application_id uuid references applications(id) on delete cascade;
alter table application_status_history add column if not exists from_status application_status;
alter table application_status_history add column if not exists to_status application_status;
alter table application_status_history add column if not exists changed_at timestamptz not null default now();
alter table application_status_history add column if not exists notes text;

create index if not exists idx_status_history_application on application_status_history(application_id);

create or replace function log_application_status_change()
returns trigger as $$
begin
  if (tg_op = 'INSERT') then
    insert into application_status_history (user_id, application_id, from_status, to_status)
    values (new.user_id, new.id, null, new.status);
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into application_status_history (user_id, application_id, from_status, to_status)
    values (new.user_id, new.id, old.status, new.status);
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_application_status_history on applications;
create trigger trg_application_status_history
  after insert or update on applications
  for each row execute function log_application_status_change();

-- ---------------------------------------------------------------------
-- parsed_job_details — raw parser output attached to an application
-- ---------------------------------------------------------------------

create table if not exists parsed_job_details (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid references applications(id) on delete cascade,
  source_url text,
  raw_job_description text,
  parsed_company text,
  parsed_job_title text,
  parsed_role_type text,
  parsed_location text,
  parsed_work_mode work_mode,
  parsed_employment_type employment_type,
  parsed_salary_range text,
  required_skills text[] default '{}',
  preferred_skills text[] default '{}',
  education text,
  years_experience text,
  visa_notes text,
  deadline date,
  recruiter_info text,
  keywords text[] default '{}',
  job_summary text,
  resume_match_score numeric,
  missing_skills text[] default '{}',
  suggested_resume_id uuid references resumes(id) on delete set null,
  suggested_cold_email_angle text,
  suggested_follow_up_date date,
  priority_score numeric,
  field_confidence jsonb default '{}'::jsonb,
  -- AI Job Intelligence Engine (v2) additions — full structured result plus provenance.
  model_used text,
  parser_version text,
  description_hash text,
  processing_time_ms integer,
  warnings jsonb default '[]'::jsonb,
  full_result jsonb,
  created_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table parsed_job_details add column if not exists application_id uuid references applications(id) on delete cascade;
alter table parsed_job_details add column if not exists source_url text;
alter table parsed_job_details add column if not exists raw_job_description text;
alter table parsed_job_details add column if not exists parsed_company text;
alter table parsed_job_details add column if not exists parsed_job_title text;
alter table parsed_job_details add column if not exists parsed_role_type text;
alter table parsed_job_details add column if not exists parsed_location text;
alter table parsed_job_details add column if not exists parsed_work_mode work_mode;
alter table parsed_job_details add column if not exists parsed_employment_type employment_type;
alter table parsed_job_details add column if not exists parsed_salary_range text;
alter table parsed_job_details add column if not exists required_skills text[] default '{}';
alter table parsed_job_details add column if not exists preferred_skills text[] default '{}';
alter table parsed_job_details add column if not exists education text;
alter table parsed_job_details add column if not exists years_experience text;
alter table parsed_job_details add column if not exists visa_notes text;
alter table parsed_job_details add column if not exists deadline date;
alter table parsed_job_details add column if not exists recruiter_info text;
alter table parsed_job_details add column if not exists keywords text[] default '{}';
alter table parsed_job_details add column if not exists job_summary text;
alter table parsed_job_details add column if not exists resume_match_score numeric;
alter table parsed_job_details add column if not exists missing_skills text[] default '{}';
alter table parsed_job_details add column if not exists suggested_resume_id uuid references resumes(id) on delete set null;
alter table parsed_job_details add column if not exists suggested_cold_email_angle text;
alter table parsed_job_details add column if not exists suggested_follow_up_date date;
alter table parsed_job_details add column if not exists priority_score numeric;
alter table parsed_job_details add column if not exists field_confidence jsonb default '{}'::jsonb;
alter table parsed_job_details add column if not exists created_at timestamptz not null default now();

-- Upgrade path for installs created before the AI Job Intelligence Engine.
alter table parsed_job_details add column if not exists model_used text;
alter table parsed_job_details add column if not exists parser_version text;
alter table parsed_job_details add column if not exists description_hash text;
alter table parsed_job_details add column if not exists processing_time_ms integer;
alter table parsed_job_details add column if not exists warnings jsonb default '[]'::jsonb;
alter table parsed_job_details add column if not exists full_result jsonb;

create index if not exists idx_parsed_job_details_application on parsed_job_details(application_id);

-- ---------------------------------------------------------------------
-- AI Parser (OpenAI gpt-5-nano/gpt-5-mini) — usage tracking + result
-- cache. Replaces the old job_parse_cache table (Hugging Face era).
--
-- Server-write-only by design: both tables get a SELECT-only RLS policy
-- for `authenticated` (see the policy block further down). All writes go
-- through createServiceRoleClient() (src/lib/supabase/server.ts), which
-- bypasses RLS — there is deliberately no insert/update/delete policy for
-- `authenticated` on either table. See
-- supabase/migrations/20260711120000_ai_parser_rewrite.sql for the
-- original migration and the rate-limit RPC function it defines
-- (ai_parser_try_acquire_slot), which is not repeated here since
-- `create or replace function` in that migration is itself idempotent.
-- ---------------------------------------------------------------------

create table if not exists ai_parser_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email_snapshot text,
  request_id text,
  provider text not null default 'openai',
  model text,
  fallback_used boolean not null default false,
  initial_model text,
  final_model text,
  status text not null default 'pending',
  cache_hit boolean not null default false,
  input_characters integer,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  cached_input_tokens integer,
  reasoning_tokens integer,
  provider_request_count integer not null default 0,
  estimated_input_cost_usd numeric(14, 8),
  estimated_cached_input_cost_usd numeric(14, 8),
  estimated_output_cost_usd numeric(14, 8),
  estimated_total_cost_usd numeric(14, 8),
  latency_ms integer,
  error_category text,
  parser_schema_version text,
  prompt_version text,
  description_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_parser_usage_user_created on ai_parser_usage(user_id, created_at);

create table if not exists ai_parser_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description_hash text not null,
  result jsonb not null,
  model text,
  parser_schema_version text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create unique index if not exists uniq_ai_parser_cache on ai_parser_cache(user_id, description_hash, parser_schema_version, prompt_version);

-- Atomic rate-limit RPC (SECURITY DEFINER) — checks per-minute/daily/
-- concurrency limits and inserts a `pending` usage row in one
-- transaction. Only ever called server-side via the service-role client
-- (src/lib/ai-parser/rate-limit.ts), never exposed to browser clients.
-- Tradeoff: minute/daily counts include abandoned 'pending' rows too —
-- acceptable for a single-user rollout, see the migration file for detail.
create or replace function ai_parser_try_acquire_slot(
  p_user_id uuid,
  p_minute_limit int,
  p_daily_limit int,
  p_concurrency_limit int
) returns table(ok boolean, reason text, usage_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minute_count int;
  v_daily_count int;
  v_concurrent_count int;
  v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select count(*) into v_concurrent_count from ai_parser_usage
    where user_id = p_user_id and status = 'pending' and created_at > now() - interval '2 minutes';
  if v_concurrent_count >= p_concurrency_limit then
    return query select false, 'concurrency_limit', null::uuid;
    return;
  end if;

  select count(*) into v_minute_count from ai_parser_usage
    where user_id = p_user_id and created_at > now() - interval '1 minute';
  if v_minute_count >= p_minute_limit then
    return query select false, 'minute_limit', null::uuid;
    return;
  end if;

  select count(*) into v_daily_count from ai_parser_usage
    where user_id = p_user_id and created_at > date_trunc('day', now());
  if v_daily_count >= p_daily_limit then
    return query select false, 'daily_limit', null::uuid;
    return;
  end if;

  insert into ai_parser_usage (user_id, status) values (p_user_id, 'pending') returning id into v_id;
  return query select true, null::text, v_id;
end;
$$;

revoke all on function ai_parser_try_acquire_slot(uuid, int, int, int) from public;
grant execute on function ai_parser_try_acquire_slot(uuid, int, int, int) to service_role;

-- ---------------------------------------------------------------------
-- contacts
-- ---------------------------------------------------------------------

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  name text not null,
  company_name text,
  role_title text,
  email text,
  linkedin_url text,
  phone text,
  relationship_type relationship_type not null default 'other',
  source text,
  last_contacted_date date,
  next_follow_up_date date,
  response_status response_status not null default 'no_response',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table contacts add column if not exists company_id uuid references companies(id) on delete set null;
alter table contacts add column if not exists name text not null default 'Unnamed Contact';
alter table contacts add column if not exists company_name text;
alter table contacts add column if not exists role_title text;
alter table contacts add column if not exists email text;
alter table contacts add column if not exists linkedin_url text;
alter table contacts add column if not exists phone text;
alter table contacts add column if not exists relationship_type relationship_type not null default 'other';
alter table contacts add column if not exists source text;
alter table contacts add column if not exists last_contacted_date date;
alter table contacts add column if not exists next_follow_up_date date;
alter table contacts add column if not exists response_status response_status not null default 'no_response';
alter table contacts add column if not exists notes text;
alter table contacts add column if not exists created_at timestamptz not null default now();
alter table contacts add column if not exists updated_at timestamptz not null default now();
alter table contacts alter column name drop default;

create index if not exists idx_contacts_user on contacts(user_id);
create index if not exists idx_contacts_company on contacts(company_id);
create index if not exists idx_contacts_next_follow_up on contacts(next_follow_up_date);

drop trigger if exists trg_contacts_updated_at on contacts;
create trigger trg_contacts_updated_at before update on contacts
  for each row execute function set_updated_at();

-- Applications <-> Contacts (many-to-many: a contact can relate to several applications)
create table if not exists application_contacts (
  application_id uuid not null references applications(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  primary key (application_id, contact_id)
);

-- ---------------------------------------------------------------------
-- email_templates
-- ---------------------------------------------------------------------

create table if not exists email_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category template_category not null default 'custom',
  subject text,
  body text not null,
  is_system_default boolean not null default false,
  times_used integer not null default 0,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table email_templates add column if not exists name text not null default 'Untitled Template';
alter table email_templates add column if not exists category template_category not null default 'custom';
alter table email_templates add column if not exists subject text;
alter table email_templates add column if not exists body text not null default '';
alter table email_templates add column if not exists is_system_default boolean not null default false;
alter table email_templates add column if not exists times_used integer not null default 0;
alter table email_templates add column if not exists reply_count integer not null default 0;
alter table email_templates add column if not exists created_at timestamptz not null default now();
alter table email_templates add column if not exists updated_at timestamptz not null default now();
alter table email_templates alter column name drop default;
alter table email_templates alter column body drop default;

create index if not exists idx_email_templates_user on email_templates(user_id);

drop trigger if exists trg_email_templates_updated_at on email_templates;
create trigger trg_email_templates_updated_at before update on email_templates
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- outreach (cold outreach tracker)
-- ---------------------------------------------------------------------

create table if not exists outreach (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  company_id uuid references companies(id) on delete set null,
  application_id uuid references applications(id) on delete set null,
  template_id uuid references email_templates(id) on delete set null,
  person_name text,
  company_name text,
  email text,
  linkedin_url text,
  outreach_type outreach_type not null default 'cold_email',
  subject_line text,
  message_sent text,
  date_sent date not null default current_date,
  follow_up_date date,
  response_received boolean not null default false,
  response_type response_status default 'no_response',
  response_date date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table outreach add column if not exists contact_id uuid references contacts(id) on delete set null;
alter table outreach add column if not exists company_id uuid references companies(id) on delete set null;
alter table outreach add column if not exists application_id uuid references applications(id) on delete set null;
alter table outreach add column if not exists template_id uuid references email_templates(id) on delete set null;
alter table outreach add column if not exists person_name text;
alter table outreach add column if not exists company_name text;
alter table outreach add column if not exists email text;
alter table outreach add column if not exists linkedin_url text;
alter table outreach add column if not exists outreach_type outreach_type not null default 'cold_email';
alter table outreach add column if not exists subject_line text;
alter table outreach add column if not exists message_sent text;
alter table outreach add column if not exists date_sent date not null default current_date;
alter table outreach add column if not exists follow_up_date date;
alter table outreach add column if not exists response_received boolean not null default false;
alter table outreach add column if not exists response_type response_status default 'no_response';
alter table outreach add column if not exists response_date date;
alter table outreach add column if not exists notes text;
alter table outreach add column if not exists created_at timestamptz not null default now();
alter table outreach add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_outreach_user on outreach(user_id);
create index if not exists idx_outreach_contact on outreach(contact_id);
create index if not exists idx_outreach_company on outreach(company_id);
create index if not exists idx_outreach_follow_up on outreach(follow_up_date);
create index if not exists idx_outreach_date_sent on outreach(date_sent);

drop trigger if exists trg_outreach_updated_at on outreach;
create trigger trg_outreach_updated_at before update on outreach
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- interview_rounds
-- ---------------------------------------------------------------------

create table if not exists interview_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  application_id uuid not null references applications(id) on delete cascade,
  round_name text not null,
  round_type interview_round_type not null default 'other',
  scheduled_at timestamptz,
  interviewer_name text,
  interviewer_linkedin_url text,
  interviewer_email text,
  meeting_link text,
  preparation_notes text,
  questions_asked text,
  result interview_result not null default 'pending',
  follow_up_sent boolean not null default false,
  thank_you_email_sent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table interview_rounds add column if not exists application_id uuid references applications(id) on delete cascade;
alter table interview_rounds add column if not exists round_name text not null default 'Interview';
alter table interview_rounds add column if not exists round_type interview_round_type not null default 'other';
alter table interview_rounds add column if not exists scheduled_at timestamptz;
alter table interview_rounds add column if not exists interviewer_name text;
alter table interview_rounds add column if not exists interviewer_linkedin_url text;
alter table interview_rounds add column if not exists interviewer_email text;
alter table interview_rounds add column if not exists meeting_link text;
alter table interview_rounds add column if not exists preparation_notes text;
alter table interview_rounds add column if not exists questions_asked text;
alter table interview_rounds add column if not exists result interview_result not null default 'pending';
alter table interview_rounds add column if not exists follow_up_sent boolean not null default false;
alter table interview_rounds add column if not exists thank_you_email_sent boolean not null default false;
alter table interview_rounds add column if not exists created_at timestamptz not null default now();
alter table interview_rounds add column if not exists updated_at timestamptz not null default now();
alter table interview_rounds alter column round_name drop default;

create index if not exists idx_interview_rounds_application on interview_rounds(application_id);
create index if not exists idx_interview_rounds_user on interview_rounds(user_id);
create index if not exists idx_interview_rounds_scheduled on interview_rounds(scheduled_at);

drop trigger if exists trg_interview_rounds_updated_at on interview_rounds;
create trigger trg_interview_rounds_updated_at before update on interview_rounds
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- follow_ups
-- ---------------------------------------------------------------------

create table if not exists follow_ups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  context follow_up_context not null default 'general',
  application_id uuid references applications(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  company_id uuid references companies(id) on delete set null,
  outreach_id uuid references outreach(id) on delete cascade,
  interview_round_id uuid references interview_rounds(id) on delete cascade,
  title text not null,
  due_date date not null,
  is_completed boolean not null default false,
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table follow_ups add column if not exists context follow_up_context not null default 'general';
alter table follow_ups add column if not exists application_id uuid references applications(id) on delete cascade;
alter table follow_ups add column if not exists contact_id uuid references contacts(id) on delete cascade;
alter table follow_ups add column if not exists company_id uuid references companies(id) on delete set null;
alter table follow_ups add column if not exists outreach_id uuid references outreach(id) on delete cascade;
alter table follow_ups add column if not exists interview_round_id uuid references interview_rounds(id) on delete cascade;
alter table follow_ups add column if not exists title text not null default 'Follow up';
alter table follow_ups add column if not exists due_date date not null default current_date;
alter table follow_ups add column if not exists is_completed boolean not null default false;
alter table follow_ups add column if not exists completed_at timestamptz;
alter table follow_ups add column if not exists notes text;
alter table follow_ups add column if not exists created_at timestamptz not null default now();
alter table follow_ups add column if not exists updated_at timestamptz not null default now();
alter table follow_ups alter column title drop default;
alter table follow_ups alter column due_date drop default;

create index if not exists idx_follow_ups_user on follow_ups(user_id);
create index if not exists idx_follow_ups_due on follow_ups(due_date);
create index if not exists idx_follow_ups_completed on follow_ups(is_completed);

drop trigger if exists trg_follow_ups_updated_at on follow_ups;
create trigger trg_follow_ups_updated_at before update on follow_ups
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- notes (freeform notes linkable to any entity)
-- ---------------------------------------------------------------------

create table if not exists notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in
    ('application', 'company', 'contact', 'outreach', 'interview_round', 'resume')),
  entity_id uuid not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table notes add column if not exists entity_type text;
alter table notes add column if not exists entity_id uuid;
alter table notes add column if not exists body text not null default '';
alter table notes add column if not exists created_at timestamptz not null default now();
alter table notes add column if not exists updated_at timestamptz not null default now();
alter table notes alter column body drop default;

create index if not exists idx_notes_entity on notes(entity_type, entity_id);
create index if not exists idx_notes_user on notes(user_id);

drop trigger if exists trg_notes_updated_at on notes;
create trigger trg_notes_updated_at before update on notes
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- exports (export job history)
-- ---------------------------------------------------------------------

create table if not exists exports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity export_entity not null,
  format export_format not null,
  filters jsonb default '{}'::jsonb,
  row_count integer,
  file_path text,
  created_at timestamptz not null default now()
);

-- Upgrade path for installs predating any of these columns.
alter table exports add column if not exists entity export_entity not null default 'applications';
alter table exports add column if not exists format export_format not null default 'xlsx';
alter table exports add column if not exists filters jsonb default '{}'::jsonb;
alter table exports add column if not exists row_count integer;
alter table exports add column if not exists file_path text;
alter table exports add column if not exists created_at timestamptz not null default now();

create index if not exists idx_exports_user on exports(user_id);

-- =====================================================================
-- Row Level Security — every table is scoped to auth.uid() = user_id
-- =====================================================================

alter table profiles enable row level security;
alter table companies enable row level security;
alter table resumes enable row level security;
alter table applications enable row level security;
alter table application_status_history enable row level security;
alter table parsed_job_details enable row level security;
alter table contacts enable row level security;
alter table application_contacts enable row level security;
alter table email_templates enable row level security;
alter table outreach enable row level security;
alter table interview_rounds enable row level security;
alter table follow_ups enable row level security;
alter table notes enable row level security;
alter table exports enable row level security;

-- ai_parser_usage / ai_parser_cache are intentionally NOT included in the
-- insert/update/delete policy loop below — they get a select-own policy
-- only (see the dedicated block right after the loop). All writes to
-- those two tables go through the service-role client, which bypasses
-- RLS entirely.
alter table ai_parser_usage enable row level security;
alter table ai_parser_cache enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles for select using (auth.uid() = id);
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles for update using (auth.uid() = id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'companies', 'resumes', 'applications', 'application_status_history',
    'parsed_job_details', 'contacts', 'email_templates', 'outreach',
    'interview_rounds', 'follow_ups', 'notes', 'exports'
  ]
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

-- ai_parser_usage / ai_parser_cache: select-own ONLY, no insert/update/
-- delete policy for `authenticated` — writes are service-role only.
drop policy if exists "ai_parser_usage_select_own" on ai_parser_usage;
create policy "ai_parser_usage_select_own" on ai_parser_usage for select using (auth.uid() = user_id);
drop policy if exists "ai_parser_cache_select_own" on ai_parser_cache;
create policy "ai_parser_cache_select_own" on ai_parser_cache for select using (auth.uid() = user_id);

drop policy if exists "application_contacts_select" on application_contacts;
create policy "application_contacts_select" on application_contacts for select using (
  exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
);
drop policy if exists "application_contacts_insert" on application_contacts;
create policy "application_contacts_insert" on application_contacts for insert with check (
  exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
);
drop policy if exists "application_contacts_delete" on application_contacts;
create policy "application_contacts_delete" on application_contacts for delete using (
  exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
);

-- =====================================================================
-- Helpful views for dashboard / analytics
-- =====================================================================

create or replace view v_follow_ups_overdue with (security_invoker = true) as
select f.* from follow_ups f
where f.is_completed = false and f.due_date < current_date;

create or replace view v_follow_ups_due_today with (security_invoker = true) as
select f.* from follow_ups f
where f.is_completed = false and f.due_date = current_date;

create or replace view v_outreach_stale with (security_invoker = true) as
select o.* from outreach o
where o.response_received = false
  and o.date_sent <= (current_date - interval '7 days');

-- =====================================================================
-- Onboarding + Dashboard Timelines
-- Adds: optional user-category onboarding, an international-student
-- profile table, and a generic pinned-timeline (countdown) table used by
-- the dashboard "Important Timelines" section. Introduced alongside
-- supabase/migrations/20260710120000_onboarding_and_timelines.sql — kept
-- here too so this file stays the single canonical "run me on a fresh
-- project" schema. Safe to re-run.
-- =====================================================================

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

-- `not null default 'not_started'` backfills every pre-existing row —
-- no separate UPDATE statement needed.
alter table profiles add column if not exists user_category user_category;
alter table profiles add column if not exists onboarding_status onboarding_status not null default 'not_started';
alter table profiles add column if not exists onboarding_completed_at timestamptz;
alter table profiles add column if not exists onboarding_skipped_at timestamptz;
alter table profiles add column if not exists timezone text;

-- international_student_profiles — 1:1 with auth.users, only created for
-- users who actually fill in international-student details, so every
-- other user's row never carries a wall of null immigration columns.
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
  -- Optional, never surfaced on dashboard cards/exports/logs by default —
  -- see src/lib/export/fetch-entity.ts OMIT_COLUMNS.
  sevis_id text,
  opt_start_date date,
  opt_end_date date,
  ead_expiration_date date,
  stem_opt_expiration_date date,
  -- Days-before-deadline the user opted into for dashboard emphasis.
  -- ApplyOS has no email/push notification system yet — see
  -- src/lib/actions/timelines.ts — this only affects in-app highlighting.
  reminder_days_before smallint[] not null default '{}',
  -- Lets a user hide immigration features/cards without losing data.
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

-- user_timelines — dashboard countdown cards (system-generated or
-- custom). At most 3 rows per user may have is_pinned = true, one per
-- dashboard_slot (1/2/3) — enforced below by a check constraint plus a
-- partial unique index, not just client-side logic.
create table if not exists user_timelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  icon text,
  timeline_type timeline_type not null default 'custom',
  category timeline_category not null default 'other',
  -- Source of truth for 'fixed_date'/'custom' rows. For rows derived from
  -- international_student_profiles or computed on the fly
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
-- same slot for the same user.
drop index if exists uniq_user_timelines_user_slot;
create unique index if not exists uniq_user_timelines_user_slot
  on user_timelines(user_id, dashboard_slot)
  where is_pinned and archived_at is null;

drop trigger if exists trg_user_timelines_updated_at on user_timelines;
create trigger trg_user_timelines_updated_at before update on user_timelines
  for each row execute function set_updated_at();

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

-- Export integration — let the existing export system include a
-- clearly-labeled "International Student Profile" sheet. SEVIS ID is
-- stripped in src/lib/export/fetch-entity.ts regardless of this value.
alter type export_entity add value if not exists 'international_profile';

-- =====================================================================
-- Administrator-managed access control
-- Replaces the old AI_PARSER_ALLOWED_EMAIL single-email allowlist.
-- Introduced alongside
-- supabase/migrations/20260712090000_admin_authorization.sql — kept here
-- too so this file stays the single canonical "run me on a fresh
-- project" schema. Safe to re-run. See that migration file for the full
-- rationale on the server-write-only RLS design used here.
-- =====================================================================

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

alter table app_user_roles enable row level security;
alter table ai_parser_entitlements enable row level security;
alter table admin_audit_log enable row level security;

drop policy if exists "app_user_roles_select_own" on app_user_roles;
create policy "app_user_roles_select_own" on app_user_roles for select using (auth.uid() = user_id);

drop policy if exists "ai_parser_entitlements_select_own" on ai_parser_entitlements;
create policy "ai_parser_entitlements_select_own" on ai_parser_entitlements for select using (auth.uid() = user_id);

-- Deliberately no policy of any kind for admin_audit_log + `authenticated`:
-- reads happen only via the owner-only /api/admin/audit-log route using
-- the service-role client.
