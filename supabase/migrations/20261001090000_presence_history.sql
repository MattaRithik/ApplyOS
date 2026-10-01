-- Keep reported page/status transitions indefinitely, until account deletion.
create table if not exists public.user_presence_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  email text,
  page text not null,
  status text not null,
  recorded_at timestamptz not null
);
create index if not exists idx_presence_history_user on public.user_presence_history(user_id, id desc);
alter table public.user_presence_history enable row level security;
revoke all on public.user_presence_history from public, anon, authenticated;
grant select, insert on public.user_presence_history to service_role;
grant usage, select on sequence public.user_presence_history_id_seq to service_role;

create or replace function public.record_presence_history() returns trigger
language plpgsql set search_path = '' as $$
declare
  new_status text;
  old_status text;
begin
  new_status := case when new.closed then 'Closed' when not new.visible then 'Background'
    when new.last_seen_at - new.last_active_at >= interval '60 seconds' then 'Idle' else 'Active' end;
  if tg_op = 'UPDATE' then
    old_status := case when old.closed then 'Closed' when not old.visible then 'Background'
      when old.last_seen_at - old.last_active_at >= interval '60 seconds' then 'Idle' else 'Active' end;
    if new.page = old.page and new_status = old_status
      and new.last_seen_at - old.last_seen_at < interval '45 seconds' then
      return new;
    end if;
  end if;
  insert into public.user_presence_history(user_id, session_id, email, page, status, recorded_at)
    values(new.user_id, new.session_id, new.email, new.page, new_status, new.last_seen_at);
  return new;
end;
$$;
revoke all on function public.record_presence_history() from public, anon, authenticated;
drop trigger if exists record_presence_history on public.user_presence;
create trigger record_presence_history after insert or update on public.user_presence
for each row execute function public.record_presence_history();

-- Preserve the last known report of sessions that survived the previous cutoff.
insert into public.user_presence_history(user_id, session_id, email, page, status, recorded_at)
select p.user_id, p.session_id, p.email, p.page, 'Retained report', p.last_seen_at
from public.user_presence p
where not exists (select 1 from public.user_presence_history h where h.user_id = p.user_id and h.session_id = p.session_id);
