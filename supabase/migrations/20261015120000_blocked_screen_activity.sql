-- A restricted account opening its screen is useful activity even without input.
-- Record the first report atomically with presence, not every heartbeat/focus event.
create or replace function public.record_blocked_screen_open() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.page <> 'blocked' or new.closed then return new; end if;
  if tg_op = 'UPDATE' then
    if old.page = 'blocked' and not old.closed then return new; end if;
  end if;
  if not exists (select 1 from auth.users u where u.id = new.user_id
    and u.raw_app_meta_data ->> 'workspace_access' = 'export_only') then return new; end if;
  if exists (select 1 from public.app_user_roles r where r.user_id = new.user_id
    and r.role in ('owner', 'admin') and r.revoked_at is null) then return new; end if;

  -- A null session_id includes this event in the existing meaningful_activity feed.
  -- The presence row's (user_id, session_id) key deduplicates retries atomically.
  insert into public.user_presence_history(user_id, page, status, recorded_at)
    values (new.user_id, 'blocked', 'Opened blocked screen', new.last_seen_at);
  return new;
end;
$$;
revoke all on function public.record_blocked_screen_open() from public, anon, authenticated;
drop trigger if exists record_blocked_screen_open on public.user_presence;
create trigger record_blocked_screen_open after insert or update on public.user_presence
for each row execute function public.record_blocked_screen_open();
