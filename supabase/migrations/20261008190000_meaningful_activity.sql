-- Heartbeats maintain the live connection; they are not activity events.
alter table public.user_presence alter column last_active_at drop not null;
drop trigger if exists record_presence_history on public.user_presence;

create or replace function public.record_page_usage() returns trigger
language plpgsql set search_path = '' as $$
declare
  previous_visit public.user_page_visits%rowtype;
  gap_seconds double precision;
  visible_delta double precision := 0;
  active_delta double precision := 0;
  new_interaction boolean := false;
begin
  if exists (select 1 from public.app_user_roles where user_id = new.user_id
    and role in ('owner', 'admin') and revoked_at is null) then return new; end if;
  select * into previous_visit from public.user_page_visits
    where user_id = new.user_id and session_id = new.session_id order by id desc limit 1;
  if tg_op = 'UPDATE' then
    gap_seconds := extract(epoch from new.last_seen_at - old.last_seen_at);
    new_interaction := new.last_active_at is not null and
      (old.last_active_at is null or new.last_active_at > old.last_active_at + interval '2 seconds');
    -- Continue measuring observed foreground intervals without creating rows.
    if previous_visit.id is not null and gap_seconds > 0 and gap_seconds < 45 and not old.closed then
      if old.visible and old.last_active_at is not null then
        visible_delta := gap_seconds;
        active_delta := greatest(0, extract(epoch from least(new.last_seen_at,
          old.last_active_at + interval '60 seconds') - old.last_seen_at));
      end if;
      if visible_delta > 0 then
        update public.user_page_visits set last_report_at = new.last_seen_at,
          visible_seconds = visible_seconds + visible_delta,
          active_seconds = active_seconds + active_delta
        where id = previous_visit.id;
      end if;
    end if;
    if previous_visit.id is not null and new.page = old.page and not old.closed
      and gap_seconds >= 0 and gap_seconds < 45
      and (not new_interaction or new.last_active_at - old.last_active_at < interval '60 seconds') then
      return new;
    end if;
  else
    new_interaction := new.last_active_at is not null;
  end if;

  -- Never create a visit from a background/idle poll or a reconnect with no input.
  if new.closed or not new.visible or new.last_active_at is null
    or new.last_seen_at - new.last_active_at >= interval '60 seconds' then return new; end if;
  if tg_op = 'UPDATE' and not new_interaction then
    -- A navigation immediately following input belongs to the genuine click.
    if new.page = old.page or new.last_seen_at - new.last_active_at >= interval '15 seconds' then return new; end if;
  end if;
  insert into public.user_page_visits(user_id, session_id, page, started_at, last_report_at)
    values (new.user_id, new.session_id, new.page,
      greatest(new.last_active_at, coalesce(previous_visit.last_report_at, new.last_active_at)), new.last_seen_at);
  return new;
end;
$$;
revoke all on function public.record_page_usage() from public, anon, authenticated;

-- Hide historical zero-duration background rows; preserve retained records.
create or replace function public.page_usage_summary(since_at timestamptz, excluded_user uuid)
returns table(user_id uuid, page text, visits bigint, visible_seconds double precision, active_seconds double precision)
language sql stable set search_path = '' as $$
  select v.user_id, v.page, count(*), sum(v.visible_seconds), sum(v.active_seconds)
  from public.user_page_visits v
  where v.started_at >= since_at and v.user_id <> excluded_user and v.active_seconds > 0
  group by v.user_id, v.page order by sum(v.active_seconds) desc;
$$;
revoke all on function public.page_usage_summary(timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.page_usage_summary(timestamptz, uuid) to service_role;

create index if not exists presence_saved_actions_time on public.user_presence_history(recorded_at desc, id desc)
  where session_id is null;

-- One chronological feed of successful actions, without application or parse contents.
create or replace function public.meaningful_activity(
  excluded_user uuid, before_at timestamptz default null, before_key text default null, page_size integer default 101
)
returns table(id text, user_id uuid, page text, status text, recorded_at timestamptz)
language sql stable set search_path = '' as $$
  with events as (
    select 'action:' || h.id::text as id, h.user_id, h.page, h.status, h.recorded_at
      from public.user_presence_history h where h.session_id is null
    union all
    select 'parse:' || p.id::text, p.user_id, 'applications', 'Application parsed', p.created_at
      from public.ai_parser_usage p where p.status in ('success', 'cache_hit')
    union all
    -- Exports already have one committed "Export generated" action above.
    select 'download:' || d.id::text, d.user_id, 'resumes', 'Resume download requested', d.created_at
      from public.download_activity d where d.kind = 'resume'
  )
  select e.id, e.user_id, e.page, e.status, e.recorded_at from events e
  where excluded_user is not null and e.user_id <> excluded_user
    and not exists (select 1 from public.app_user_roles r where r.user_id = e.user_id
      and r.role in ('owner', 'admin') and r.revoked_at is null)
    and (before_at is null or e.recorded_at < before_at or (e.recorded_at = before_at and e.id < before_key))
  order by e.recorded_at desc, e.id desc limit greatest(1, least(page_size, 101));
$$;
revoke all on function public.meaningful_activity(uuid, timestamptz, text, integer) from public, anon, authenticated;
grant execute on function public.meaningful_activity(uuid, timestamptz, text, integer) to service_role;
