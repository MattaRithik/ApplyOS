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

  if exists (select 1 from information_schema.columns where table_name = 'resumes' and column_name = 'file_name') then
    alter table resumes drop column file_name;
  end if;
end $$;

alter table resumes add column if not exists storage_provider text not null default 'backblaze_b2';
alter table resumes add column if not exists file_type text;
alter table resumes add column if not exists status text not null default 'uploaded';
alter table resumes add column if not exists uploaded_at timestamptz;
alter table resumes add column if not exists parsed_text text;
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
  date_applied date,
  status application_status not null default 'saved',
  priority_score numeric default 0 check (priority_score >= 0 and priority_score <= 100),
  resume_id uuid references resumes(id) on delete set null,
  cover_letter_used text,
  referral_person text,
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
  created_at timestamptz not null default now()
);

create index if not exists idx_parsed_job_details_application on parsed_job_details(application_id);

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

create or replace view v_follow_ups_overdue as
select f.* from follow_ups f
where f.is_completed = false and f.due_date < current_date;

create or replace view v_follow_ups_due_today as
select f.* from follow_ups f
where f.is_completed = false and f.due_date = current_date;

create or replace view v_outreach_stale as
select o.* from outreach o
where o.response_received = false
  and o.date_sent <= (current_date - interval '7 days');
