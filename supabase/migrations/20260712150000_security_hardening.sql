-- ApplyOS production security hardening.
-- Non-destructive: no user rows, application rows, or stored-file metadata
-- are deleted. Existing cross-owner relationship rows are left untouched
-- but become inaccessible/mutation-protected by the corrected policies.

-- Views are SECURITY DEFINER with respect to underlying RLS by default.
-- Make the caller's RLS policies apply so these convenience views cannot
-- expose another user's rows through PostgREST.
alter view if exists v_follow_ups_overdue set (security_invoker = true);
alter view if exists v_follow_ups_due_today set (security_invoker = true);
alter view if exists v_outreach_stale set (security_invoker = true);

-- Resume storage metadata is server-managed. Authenticated users may read
-- their own rows and edit presentation metadata, but cannot mint arbitrary
-- storage keys/statuses or bypass file cleanup by writing/deleting directly.
revoke insert, delete, update on table resumes from authenticated;
grant update (display_name, target_role, version_notes, resume_match_score, missing_keywords, is_archived)
  on table resumes to authenticated;

-- Applications may only point at companies/resumes owned by the same user.
drop policy if exists "applications_insert_own" on applications;
create policy "applications_insert_own" on applications for insert with check (
  auth.uid() = user_id
  and (company_id is null or exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid()))
  and (resume_id is null or exists (select 1 from resumes r where r.id = resume_id and r.user_id = auth.uid()))
);
drop policy if exists "applications_update_own" on applications;
create policy "applications_update_own" on applications for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (company_id is null or exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid()))
    and (resume_id is null or exists (select 1 from resumes r where r.id = resume_id and r.user_id = auth.uid()))
  );

drop policy if exists "contacts_insert_own" on contacts;
create policy "contacts_insert_own" on contacts for insert with check (
  auth.uid() = user_id
  and (company_id is null or exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid()))
);
drop policy if exists "contacts_update_own" on contacts;
create policy "contacts_update_own" on contacts for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (company_id is null or exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid()))
);

drop policy if exists "application_status_history_insert_own" on application_status_history;
create policy "application_status_history_insert_own" on application_status_history for insert with check (
  auth.uid() = user_id
  and exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
);
drop policy if exists "application_status_history_update_own" on application_status_history;
create policy "application_status_history_update_own" on application_status_history for update using (
  auth.uid() = user_id
  and exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
) with check (
  auth.uid() = user_id
  and exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
);
drop policy if exists "application_status_history_select_own" on application_status_history;
create policy "application_status_history_select_own" on application_status_history for select using (
  auth.uid() = user_id and exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
);
drop policy if exists "application_status_history_delete_own" on application_status_history;
create policy "application_status_history_delete_own" on application_status_history for delete using (
  auth.uid() = user_id and exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
);

drop policy if exists "parsed_job_details_insert_own" on parsed_job_details;
create policy "parsed_job_details_insert_own" on parsed_job_details for insert with check (
  auth.uid() = user_id
  and (application_id is null or exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid()))
  and (suggested_resume_id is null or exists (select 1 from resumes r where r.id = suggested_resume_id and r.user_id = auth.uid()))
);
drop policy if exists "parsed_job_details_update_own" on parsed_job_details;
create policy "parsed_job_details_update_own" on parsed_job_details for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (application_id is null or exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid()))
  and (suggested_resume_id is null or exists (select 1 from resumes r where r.id = suggested_resume_id and r.user_id = auth.uid()))
);
drop policy if exists "parsed_job_details_select_own" on parsed_job_details;
create policy "parsed_job_details_select_own" on parsed_job_details for select using (
  auth.uid() = user_id
  and (application_id is null or exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid()))
  and (suggested_resume_id is null or exists (select 1 from resumes r where r.id = suggested_resume_id and r.user_id = auth.uid()))
);
drop policy if exists "parsed_job_details_delete_own" on parsed_job_details;
create policy "parsed_job_details_delete_own" on parsed_job_details for delete using (
  auth.uid() = user_id
  and (application_id is null or exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid()))
);

drop policy if exists "interview_rounds_insert_own" on interview_rounds;
create policy "interview_rounds_insert_own" on interview_rounds for insert with check (
  auth.uid() = user_id
  and exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
);
drop policy if exists "interview_rounds_update_own" on interview_rounds;
create policy "interview_rounds_update_own" on interview_rounds for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
);
drop policy if exists "interview_rounds_select_own" on interview_rounds;
create policy "interview_rounds_select_own" on interview_rounds for select using (
  auth.uid() = user_id and exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
);
drop policy if exists "interview_rounds_delete_own" on interview_rounds;
create policy "interview_rounds_delete_own" on interview_rounds for delete using (
  auth.uid() = user_id and exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
);

drop policy if exists "outreach_insert_own" on outreach;
create policy "outreach_insert_own" on outreach for insert with check (
  auth.uid() = user_id
  and (contact_id is null or exists (select 1 from contacts c where c.id = contact_id and c.user_id = auth.uid()))
  and (company_id is null or exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid()))
  and (application_id is null or exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid()))
  and (template_id is null or exists (select 1 from email_templates e where e.id = template_id and e.user_id = auth.uid()))
);
drop policy if exists "outreach_update_own" on outreach;
create policy "outreach_update_own" on outreach for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (contact_id is null or exists (select 1 from contacts c where c.id = contact_id and c.user_id = auth.uid()))
  and (company_id is null or exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid()))
  and (application_id is null or exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid()))
  and (template_id is null or exists (select 1 from email_templates e where e.id = template_id and e.user_id = auth.uid()))
);
drop policy if exists "outreach_select_own" on outreach;
create policy "outreach_select_own" on outreach for select using (
  auth.uid() = user_id
  and (contact_id is null or exists (select 1 from contacts c where c.id = contact_id and c.user_id = auth.uid()))
  and (company_id is null or exists (select 1 from companies c where c.id = company_id and c.user_id = auth.uid()))
  and (application_id is null or exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid()))
  and (template_id is null or exists (select 1 from email_templates e where e.id = template_id and e.user_id = auth.uid()))
);
drop policy if exists "outreach_delete_own" on outreach;
create policy "outreach_delete_own" on outreach for delete using (auth.uid() = user_id);

drop policy if exists "application_contacts_insert" on application_contacts;
create policy "application_contacts_insert" on application_contacts for insert with check (
  exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
  and exists (select 1 from contacts c where c.id = contact_id and c.user_id = auth.uid())
);
drop policy if exists "application_contacts_select" on application_contacts;
create policy "application_contacts_select" on application_contacts for select using (
  exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
  and exists (select 1 from contacts c where c.id = contact_id and c.user_id = auth.uid())
);
drop policy if exists "application_contacts_delete" on application_contacts;
create policy "application_contacts_delete" on application_contacts for delete using (
  exists (select 1 from applications a where a.id = application_id and a.user_id = auth.uid())
  and exists (select 1 from contacts c where c.id = contact_id and c.user_id = auth.uid())
);

-- Follow-up references, when present, must all be owned by the row owner.
drop policy if exists "follow_ups_insert_own" on follow_ups;
create policy "follow_ups_insert_own" on follow_ups for insert with check (
  auth.uid() = user_id
  and (application_id is null or exists (select 1 from applications x where x.id = application_id and x.user_id = auth.uid()))
  and (contact_id is null or exists (select 1 from contacts x where x.id = contact_id and x.user_id = auth.uid()))
  and (company_id is null or exists (select 1 from companies x where x.id = company_id and x.user_id = auth.uid()))
  and (outreach_id is null or exists (select 1 from outreach x where x.id = outreach_id and x.user_id = auth.uid()))
  and (interview_round_id is null or exists (select 1 from interview_rounds x where x.id = interview_round_id and x.user_id = auth.uid()))
);
drop policy if exists "follow_ups_update_own" on follow_ups;
create policy "follow_ups_update_own" on follow_ups for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id
  and (application_id is null or exists (select 1 from applications x where x.id = application_id and x.user_id = auth.uid()))
  and (contact_id is null or exists (select 1 from contacts x where x.id = contact_id and x.user_id = auth.uid()))
  and (company_id is null or exists (select 1 from companies x where x.id = company_id and x.user_id = auth.uid()))
  and (outreach_id is null or exists (select 1 from outreach x where x.id = outreach_id and x.user_id = auth.uid()))
  and (interview_round_id is null or exists (select 1 from interview_rounds x where x.id = interview_round_id and x.user_id = auth.uid()))
);
drop policy if exists "follow_ups_select_own" on follow_ups;
create policy "follow_ups_select_own" on follow_ups for select using (
  auth.uid() = user_id
  and (application_id is null or exists (select 1 from applications x where x.id = application_id and x.user_id = auth.uid()))
  and (contact_id is null or exists (select 1 from contacts x where x.id = contact_id and x.user_id = auth.uid()))
  and (company_id is null or exists (select 1 from companies x where x.id = company_id and x.user_id = auth.uid()))
  and (outreach_id is null or exists (select 1 from outreach x where x.id = outreach_id and x.user_id = auth.uid()))
  and (interview_round_id is null or exists (select 1 from interview_rounds x where x.id = interview_round_id and x.user_id = auth.uid()))
);

-- Generic note links must resolve to an entity owned by the note owner.
drop policy if exists "notes_insert_own" on notes;
create policy "notes_insert_own" on notes for insert with check (
  auth.uid() = user_id and (
    (entity_type = 'application' and exists (select 1 from applications x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'company' and exists (select 1 from companies x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'contact' and exists (select 1 from contacts x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'outreach' and exists (select 1 from outreach x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'interview_round' and exists (select 1 from interview_rounds x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'resume' and exists (select 1 from resumes x where x.id = entity_id and x.user_id = auth.uid()))
  )
);
drop policy if exists "notes_select_own" on notes;
create policy "notes_select_own" on notes for select using (
  auth.uid() = user_id and (
    (entity_type = 'application' and exists (select 1 from applications x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'company' and exists (select 1 from companies x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'contact' and exists (select 1 from contacts x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'outreach' and exists (select 1 from outreach x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'interview_round' and exists (select 1 from interview_rounds x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'resume' and exists (select 1 from resumes x where x.id = entity_id and x.user_id = auth.uid()))
  )
);
drop policy if exists "notes_update_own" on notes;
create policy "notes_update_own" on notes for update using (auth.uid() = user_id) with check (
  auth.uid() = user_id and (
    (entity_type = 'application' and exists (select 1 from applications x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'company' and exists (select 1 from companies x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'contact' and exists (select 1 from contacts x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'outreach' and exists (select 1 from outreach x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'interview_round' and exists (select 1 from interview_rounds x where x.id = entity_id and x.user_id = auth.uid()))
    or (entity_type = 'resume' and exists (select 1 from resumes x where x.id = entity_id and x.user_id = auth.uid()))
  )
);

-- Database-backed, service-role-only abuse limiter for authenticated API
-- operations that do not already have a dedicated atomic limiter.
create table if not exists api_rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (action ~ '^[a-z0-9_]{1,64}$'),
  created_at timestamptz not null default now()
);
create index if not exists idx_api_rate_limit_events_lookup
  on api_rate_limit_events(user_id, action, created_at desc);
alter table api_rate_limit_events enable row level security;

create or replace function try_consume_api_rate_limit(
  p_user_id uuid,
  p_action text,
  p_window_seconds integer,
  p_max_count integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  if p_user_id is null or p_action !~ '^[a-z0-9_]{1,64}$'
     or p_window_seconds < 1 or p_window_seconds > 86400
     or p_max_count < 1 or p_max_count > 10000 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_action, 0));
  delete from api_rate_limit_events
  where user_id = p_user_id and created_at < now() - interval '7 days';
  select count(*) into v_count
  from api_rate_limit_events
  where user_id = p_user_id
    and action = p_action
    and created_at > now() - make_interval(secs => p_window_seconds);

  if v_count >= p_max_count then return false; end if;
  insert into api_rate_limit_events(user_id, action) values (p_user_id, p_action);
  return true;
end;
$$;

revoke all on function try_consume_api_rate_limit(uuid, text, integer, integer) from public;
grant execute on function try_consume_api_rate_limit(uuid, text, integer, integer) to service_role;

-- Apply an entitlement mutation and append its audit row atomically. The
-- function independently verifies that the actor still has the owner role;
-- route-level requireOwner remains the first authorization layer.
create or replace function admin_mutate_ai_entitlement(
  p_actor_user_id uuid,
  p_target_user_id uuid,
  p_action text,
  p_patch jsonb,
  p_request_id text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit_action text;
  v_metadata jsonb := '{}'::jsonb;
begin
  if not exists (
    select 1 from app_user_roles
    where user_id = p_actor_user_id and role = 'owner' and revoked_at is null
  ) then
    raise exception 'owner authorization required';
  end if;
  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'target user not found';
  end if;

  insert into ai_parser_entitlements(user_id) values (p_target_user_id)
  on conflict (user_id) do nothing;

  case p_action
    when 'grant' then
      update ai_parser_entitlements set
        enabled = true, granted_by = p_actor_user_id, granted_at = now(),
        suspended_at = null, suspension_reason = null
      where user_id = p_target_user_id;
      v_audit_action := 'ai_access_granted';
    when 'revoke' then
      update ai_parser_entitlements set enabled = false where user_id = p_target_user_id;
      v_audit_action := 'ai_access_revoked';
    when 'suspend' then
      update ai_parser_entitlements set
        suspended_at = now(),
        suspension_reason = nullif(left(coalesce(p_patch->>'reason', ''), 500), '')
      where user_id = p_target_user_id;
      v_audit_action := 'ai_access_suspended';
      if coalesce(p_patch->>'reason', '') <> '' then v_metadata := '{"reasonProvided":true}'::jsonb; end if;
    when 'reactivate' then
      update ai_parser_entitlements set suspended_at = null, suspension_reason = null
      where user_id = p_target_user_id;
      v_audit_action := 'ai_access_reactivated';
    when 'update_limits' then
      if p_patch ? 'dailyRequestLimit' and p_patch->'dailyRequestLimit' <> 'null'::jsonb
         and ((p_patch->>'dailyRequestLimit')::integer < 1 or (p_patch->>'dailyRequestLimit')::integer > 10000) then
        raise exception 'invalid daily request limit';
      end if;
      if p_patch ? 'monthlyBudgetUsd' and p_patch->'monthlyBudgetUsd' <> 'null'::jsonb
         and ((p_patch->>'monthlyBudgetUsd')::numeric < 0 or (p_patch->>'monthlyBudgetUsd')::numeric > 10000) then
        raise exception 'invalid monthly budget';
      end if;
      update ai_parser_entitlements set
        daily_request_limit = case
          when not (p_patch ? 'dailyRequestLimit') then daily_request_limit
          when p_patch->'dailyRequestLimit' = 'null'::jsonb then null
          else (p_patch->>'dailyRequestLimit')::integer
        end,
        monthly_budget_usd = case
          when not (p_patch ? 'monthlyBudgetUsd') then monthly_budget_usd
          when p_patch->'monthlyBudgetUsd' = 'null'::jsonb then null
          else (p_patch->>'monthlyBudgetUsd')::numeric
        end,
        expires_at = case
          when not (p_patch ? 'expiresAt') then expires_at
          when p_patch->'expiresAt' = 'null'::jsonb then null
          else (p_patch->>'expiresAt')::timestamptz
        end
      where user_id = p_target_user_id;
      v_audit_action := 'ai_limits_updated';
      v_metadata := p_patch - 'reason';
    else
      raise exception 'unsupported entitlement action';
  end case;

  insert into admin_audit_log(actor_user_id, action_type, target_user_id, metadata, request_id)
  values (p_actor_user_id, v_audit_action, p_target_user_id, v_metadata, p_request_id);
end;
$$;
revoke all on function admin_mutate_ai_entitlement(uuid, uuid, text, jsonb, text) from public;
grant execute on function admin_mutate_ai_entitlement(uuid, uuid, text, jsonb, text) to service_role;

-- Serialize each user's parser acquisition checks so concurrent requests
-- cannot all observe the same pre-insert counts.
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
  if p_user_id is null or p_minute_limit < 1 or p_daily_limit < 1 or p_concurrency_limit < 1 then
    return query select false, 'invalid_limits', null::uuid;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select count(*) into v_concurrent_count from ai_parser_usage
    where user_id = p_user_id and status = 'pending' and created_at > now() - interval '2 minutes';
  if v_concurrent_count >= p_concurrency_limit then return query select false, 'concurrency_limit', null::uuid; return; end if;
  select count(*) into v_minute_count from ai_parser_usage
    where user_id = p_user_id and created_at > now() - interval '1 minute';
  if v_minute_count >= p_minute_limit then return query select false, 'minute_limit', null::uuid; return; end if;
  select count(*) into v_daily_count from ai_parser_usage
    where user_id = p_user_id and created_at >= date_trunc('day', now() at time zone 'utc') at time zone 'utc';
  if v_daily_count >= p_daily_limit then return query select false, 'daily_limit', null::uuid; return; end if;
  insert into ai_parser_usage (user_id, status) values (p_user_id, 'pending') returning id into v_id;
  return query select true, null::text, v_id;
end;
$$;
revoke all on function ai_parser_try_acquire_slot(uuid, int, int, int) from public;
grant execute on function ai_parser_try_acquire_slot(uuid, int, int, int) to service_role;
