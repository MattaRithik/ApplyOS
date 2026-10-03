-- Prospective estimates only: do not fabricate durations for retained reports.
create table public.user_page_visits (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  page text not null,
  started_at timestamptz not null,
  last_report_at timestamptz not null,
  visible_seconds double precision not null default 0,
  active_seconds double precision not null default 0,
  check (active_seconds >= 0 and visible_seconds >= active_seconds)
);
create index on public.user_page_visits(user_id, started_at desc);
create index on public.user_page_visits(user_id, session_id, id desc);
alter table public.user_page_visits enable row level security;
revoke all on public.user_page_visits from public, anon, authenticated;
grant select, insert, update on public.user_page_visits to service_role;
grant usage, select on sequence public.user_page_visits_id_seq to service_role;

create function public.record_page_usage() returns trigger
language plpgsql set search_path = '' as $$
declare
  previous_visit bigint;
  gap_seconds double precision;
  visible_delta double precision := 0;
  active_delta double precision := 0;
begin
  if exists (select 1 from public.app_user_roles where user_id = new.user_id
    and role in ('owner', 'admin') and revoked_at is null) then return new; end if;
  select id into previous_visit from public.user_page_visits
    where user_id = new.user_id and session_id = new.session_id order by id desc limit 1;
  if tg_op = 'UPDATE' then
    gap_seconds := extract(epoch from new.last_seen_at - old.last_seen_at);
    -- Only count observed contiguous intervals; never count a disconnected gap.
    if previous_visit is not null and gap_seconds > 0 and gap_seconds < 45 and not old.closed then
      if old.visible then
        visible_delta := gap_seconds;
        active_delta := greatest(0, extract(epoch from least(new.last_seen_at, old.last_active_at + interval '60 seconds') - old.last_seen_at));
      end if;
      update public.user_page_visits set
        last_report_at = new.last_seen_at,
        visible_seconds = visible_seconds + visible_delta,
        active_seconds = active_seconds + active_delta
      where id = previous_visit;
    end if;
    if previous_visit is not null and new.page = old.page and not old.closed and gap_seconds >= 0 and gap_seconds < 45 then
      return new;
    end if;
  end if;
  if not new.closed then
    insert into public.user_page_visits(user_id, session_id, page, started_at, last_report_at)
    values (new.user_id, new.session_id, new.page, new.last_seen_at, new.last_seen_at);
  end if;
  return new;
end;
$$;
revoke all on function public.record_page_usage() from public, anon, authenticated;
create trigger record_page_usage after insert or update on public.user_presence
for each row execute function public.record_page_usage();

-- Feature actions contain action labels only, never row contents or entered text.
alter table public.user_presence_history alter column session_id drop not null;
create function public.record_feature_action() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  actor uuid;
  feature text := tg_argv[0];
  label text := tg_argv[1];
  action_label text;
begin
  if tg_op = 'DELETE' then actor := old.user_id; else actor := new.user_id; end if;
  -- Also skip cascades during account deletion and privileged maintenance writes.
  if auth.uid() is distinct from actor then return null; end if;
  if not exists (select 1 from auth.users where id = actor) then return null; end if;
  if exists (select 1 from public.app_user_roles where user_id = actor
    and role in ('owner', 'admin') and revoked_at is null) then return null; end if;
  if tg_op = 'UPDATE' and (to_jsonb(new) - 'updated_at') = (to_jsonb(old) - 'updated_at') then return null; end if;
  action_label := label || case tg_op when 'INSERT' then ' added' when 'UPDATE' then ' updated' else ' deleted' end;
  if tg_table_name = 'exports' then action_label := 'Export generated'; end if;
  if tg_table_name = 'applications' and tg_op = 'UPDATE' then
    if new.status is distinct from old.status then action_label := 'Application status changed'; end if;
  end if;
  insert into public.user_presence_history(user_id, page, status, recorded_at)
    values(actor, feature, action_label, clock_timestamp());
  return null;
end;
$$;
revoke all on function public.record_feature_action() from public, anon, authenticated;
create trigger record_feature_action after insert or update or delete on public.applications
for each row execute function public.record_feature_action('applications', 'Application');
create trigger record_feature_action after insert or update or delete on public.companies
for each row execute function public.record_feature_action('companies', 'Company');
create trigger record_feature_action after insert or update or delete on public.contacts
for each row execute function public.record_feature_action('contacts', 'Contact');
create trigger record_feature_action after insert or update or delete on public.outreach
for each row execute function public.record_feature_action('outreach', 'Outreach record');
create trigger record_feature_action after insert or update or delete on public.interview_rounds
for each row execute function public.record_feature_action('interviews', 'Interview');
create trigger record_feature_action after insert or update or delete on public.follow_ups
for each row execute function public.record_feature_action('follow-ups', 'Follow-up');
create trigger record_feature_action after insert or update or delete on public.email_templates
for each row execute function public.record_feature_action('templates', 'Template');
create trigger record_feature_action after insert on public.exports
for each row execute function public.record_feature_action('export', 'Export');

create function public.page_usage_summary(since_at timestamptz, excluded_user uuid)
returns table(user_id uuid, page text, visits bigint, visible_seconds double precision, active_seconds double precision)
language sql stable set search_path = '' as $$
  select v.user_id, v.page, count(*), sum(v.visible_seconds), sum(v.active_seconds)
  from public.user_page_visits v
  where v.started_at >= since_at and v.user_id <> excluded_user
  group by v.user_id, v.page order by sum(v.active_seconds) desc;
$$;
revoke all on function public.page_usage_summary(timestamptz, uuid) from public, anon, authenticated;
grant execute on function public.page_usage_summary(timestamptz, uuid) to service_role;
