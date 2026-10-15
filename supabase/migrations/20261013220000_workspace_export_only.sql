-- Export-only restrictions are read from current auth rows, never stale JWT claims
-- or user-editable metadata. Existing tokens lose direct database access too.
begin;

create or replace function public.workspace_access_allowed()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from auth.users u where u.id = (select auth.uid())
      and coalesce(u.raw_app_meta_data ->> 'workspace_access', 'full') <> 'export_only'
  )
$$;
revoke all on function public.workspace_access_allowed() from public, anon;
grant execute on function public.workspace_access_allowed() to authenticated, service_role;

-- Restrictive policies AND with all existing ownership policies. They do not
-- grant access, alter normal account ownership checks, or affect service-role
-- operations such as the narrowly scoped self-service download.
do $$
declare t record;
begin
  for t in select c.relname from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists workspace_access_required on public.%I', t.relname);
    execute format('create policy workspace_access_required on public.%I as restrictive for all to authenticated using ((select public.workspace_access_allowed())) with check ((select public.workspace_access_allowed()))', t.relname);
  end loop;
end $$;

-- Account access and its audit record commit together. Only service-role
-- callers can invoke this; the actor must still be a current owner.
create or replace function public.admin_set_workspace_access(
  p_actor_user_id uuid, p_target_user_id uuid, p_blocked boolean, p_request_id text default null
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_actor_user_id is null or p_target_user_id is null or p_blocked is null
    or p_actor_user_id = p_target_user_id then
    raise exception 'Invalid account access change.' using errcode = '22023';
  end if;
  if not exists (select 1 from public.app_user_roles r where r.user_id = p_actor_user_id
    and r.role = 'owner' and r.revoked_at is null) then
    raise exception 'Owner access required.' using errcode = '42501';
  end if;
  if exists (select 1 from public.app_user_roles r where r.user_id = p_target_user_id
    and r.role = 'owner' and r.revoked_at is null) then
    raise exception 'The owner account cannot be restricted.' using errcode = '42501';
  end if;
  update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('workspace_access', case when p_blocked then 'export_only' else 'full' end)
    where id = p_target_user_id;
  if not found then raise exception 'Account not found.' using errcode = 'P0002'; end if;
  insert into public.admin_audit_log(actor_user_id, target_user_id, action_type, request_id, metadata)
    values (p_actor_user_id, p_target_user_id,
      case when p_blocked then 'workspace_blocked' else 'workspace_restored' end,
      p_request_id, jsonb_build_object('workspaceAccess', case when p_blocked then 'export_only' else 'full' end));
end
$$;
revoke all on function public.admin_set_workspace_access(uuid, uuid, boolean, text) from public, anon, authenticated;
grant execute on function public.admin_set_workspace_access(uuid, uuid, boolean, text) to service_role;

-- Prevent new paid work or upload reservations even if a request was already
-- in flight when access changed. Existing records remain available for export.
create or replace function public.reject_blocked_account_work()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from auth.users u where u.id = new.user_id
    and u.raw_app_meta_data ->> 'workspace_access' = 'export_only') then
    raise exception 'Workspace access is blocked.' using errcode = '42501';
  end if;
  return new;
end
$$;
revoke all on function public.reject_blocked_account_work() from public, anon, authenticated;
drop trigger if exists reject_blocked_account_work on public.ai_parser_usage;
create trigger reject_blocked_account_work before insert on public.ai_parser_usage
  for each row execute function public.reject_blocked_account_work();
drop trigger if exists reject_blocked_account_work on public.resumes;
create trigger reject_blocked_account_work before insert on public.resumes
  for each row execute function public.reject_blocked_account_work();

commit;
