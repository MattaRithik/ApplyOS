-- Public-release resource guards. Apply after existing migrations.
-- Existing accounts, applications, and file metadata are preserved.
begin;

alter table public.ai_parser_usage add column if not exists reserved_cost_usd numeric(14,8) not null default 0;

-- Aggregate in Postgres so PostgREST's row limit cannot undercount spending.
create or replace function public.ai_parser_cost_total(p_user_id uuid, p_since timestamptz default null)
returns numeric language sql stable set search_path = '' as $$
  select coalesce(sum(u.estimated_total_cost_usd), 0)
  from public.ai_parser_usage u
  where u.user_id = p_user_id and (p_since is null or u.created_at >= p_since);
$$;
revoke all on function public.ai_parser_cost_total(uuid, timestamptz) from public, anon, authenticated;
grant execute on function public.ai_parser_cost_total(uuid, timestamptz) to service_role;

-- Both budget decisions and pending reservations happen under the same lock.
-- An attempt without final cost retains its reservation, including failed
-- provider calls whose actual charge could not be recovered.
create or replace function public.ai_parser_acquire_slot(
  p_user_id uuid, p_minute_limit integer, p_daily_limit integer, p_concurrency_limit integer,
  p_monthly_budget_usd numeric, p_global_monthly_budget_usd numeric, p_reserved_cost_usd numeric
) returns table(ok boolean, reason text, usage_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_month timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
  v_spent numeric;
  v_id uuid;
begin
  if p_user_id is null or p_minute_limit is null or p_minute_limit < 1
    or p_daily_limit is null or p_daily_limit < 1
    or p_concurrency_limit is null or p_concurrency_limit < 1
    or p_reserved_cost_usd is null or p_reserved_cost_usd <= 0
    or p_monthly_budget_usd < 0 or p_global_monthly_budget_usd is null or p_global_monthly_budget_usd < 0 then
    return query select false, 'invalid_limits', null::uuid; return;
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('applyos:parser-budget', 0));
  if not exists (select 1 from public.ai_parser_entitlements e where e.user_id = p_user_id
    and e.enabled and e.suspended_at is null and (e.expires_at is null or e.expires_at > now())) then
    return query select false, 'access_denied', null::uuid; return;
  end if;
  if (select count(*) from public.ai_parser_usage u where u.user_id = p_user_id
    and u.status = 'pending' and u.created_at > now() - interval '2 minutes') >= p_concurrency_limit then
    return query select false, 'concurrency_limit', null::uuid; return;
  end if;
  if (select count(*) from public.ai_parser_usage u where u.user_id = p_user_id
    and u.created_at > now() - interval '1 minute') >= p_minute_limit then
    return query select false, 'minute_limit', null::uuid; return;
  end if;
  if (select count(*) from public.ai_parser_usage u where u.user_id = p_user_id
    and u.created_at >= (date_trunc('day', now() at time zone 'UTC') at time zone 'UTC')) >= p_daily_limit then
    return query select false, 'daily_limit', null::uuid; return;
  end if;
  select coalesce(sum(coalesce(u.estimated_total_cost_usd, u.reserved_cost_usd)), 0) into v_spent
    from public.ai_parser_usage u where u.user_id = p_user_id and u.created_at >= v_month;
  if p_monthly_budget_usd is not null and v_spent + p_reserved_cost_usd > p_monthly_budget_usd then
    return query select false, 'monthly_budget', null::uuid; return;
  end if;
  select coalesce(sum(coalesce(u.estimated_total_cost_usd, u.reserved_cost_usd)), 0) into v_spent
    from public.ai_parser_usage u where u.created_at >= v_month;
  if v_spent + p_reserved_cost_usd > p_global_monthly_budget_usd then
    return query select false, 'global_budget', null::uuid; return;
  end if;
  insert into public.ai_parser_usage(user_id, status, reserved_cost_usd)
    values(p_user_id, 'pending', p_reserved_cost_usd) returning id into v_id;
  return query select true, null::text, v_id;
end;
$$;
revoke all on function public.ai_parser_acquire_slot(uuid, integer, integer, integer, numeric, numeric, numeric) from public, anon, authenticated;
grant execute on function public.ai_parser_acquire_slot(uuid, integer, integer, integer, numeric, numeric, numeric) to service_role;

create index if not exists ai_parser_usage_global_month on public.ai_parser_usage(created_at)
  include (estimated_total_cost_usd, reserved_cost_usd);

-- Serialize reservations per account. Archived files and unfinished uploads
-- still consume quota; archiving must not bypass the storage limit.
create or replace function public.enforce_resume_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_count bigint;
  v_bytes numeric;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('applyos:resume:' || new.user_id::text, 0));
  select count(*), coalesce(sum(r.file_size), 0) into v_count, v_bytes
    from public.resumes r where r.user_id = new.user_id;
  if v_count >= 50 or v_bytes + coalesce(new.file_size, 0) > 104857600 then
    raise exception 'Resume quota reached.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_resume_quota() from public, anon, authenticated;
drop trigger if exists enforce_resume_quota on public.resumes;
create trigger enforce_resume_quota before insert on public.resumes for each row execute function public.enforce_resume_quota();

-- Disable dormant Job Drops access at the database boundary as well as in
-- the app. Existing collaboration data remains available to maintenance.
revoke all on public.link_threads, public.link_thread_participants, public.link_messages, public.link_message_statuses from anon, authenticated;
revoke all on function public.is_link_thread_participant(uuid, uuid) from anon, authenticated;

commit;
