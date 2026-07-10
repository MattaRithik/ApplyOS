-- =====================================================================
-- ApplyOS — full teardown
--
-- DESTROYS EVERYTHING: every table, view, function, trigger, and enum
-- type this app owns, plus all data in them. Irreversible.
--
-- Run this FIRST in the Supabase SQL editor, then run schema.sql fresh
-- immediately after. Safe to re-run (every statement is "if exists").
-- =====================================================================

-- ---- Views (depend on tables, drop first) ----
drop view if exists v_follow_ups_overdue;
drop view if exists v_follow_ups_due_today;
drop view if exists v_outreach_stale;

-- ---- Tables (cascade clears FKs/policies/indexes regardless of order) ----
drop table if exists follow_ups cascade;
drop table if exists notes cascade;
drop table if exists exports cascade;
drop table if exists interview_rounds cascade;
drop table if exists outreach cascade;
drop table if exists application_contacts cascade;
drop table if exists contacts cascade;
drop table if exists job_parse_cache cascade;
drop table if exists parsed_job_details cascade;
drop table if exists application_status_history cascade;
drop table if exists applications cascade;
drop table if exists resumes cascade;
drop table if exists companies cascade;
drop table if exists email_templates cascade;
drop table if exists profiles cascade;

-- ---- Trigger on Supabase's own auth.users table ----
drop trigger if exists trg_on_auth_user_created on auth.users;

-- ---- Functions ----
drop function if exists handle_new_user() cascade;
drop function if exists log_application_status_change() cascade;
drop function if exists set_updated_at() cascade;

-- ---- Enum types ----
drop type if exists application_status cascade;
drop type if exists work_mode cascade;
drop type if exists employment_type cascade;
drop type if exists visa_sponsorship_status cascade;
drop type if exists relationship_type cascade;
drop type if exists outreach_type cascade;
drop type if exists response_status cascade;
drop type if exists interview_round_type cascade;
drop type if exists interview_result cascade;
drop type if exists template_category cascade;
drop type if exists follow_up_context cascade;
drop type if exists export_format cascade;
drop type if exists export_entity cascade;
