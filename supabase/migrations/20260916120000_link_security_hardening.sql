-- Preserve existing Job Drops data while tightening direct database access.
-- The UI feature flag is deliberately not an authorization boundary.
begin;

-- This RLS helper must not double as an RPC for probing other users' membership.
create or replace function public.is_link_thread_participant(p_thread_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select p_user_id = auth.uid() and exists (
    select 1 from public.link_thread_participants
    where thread_id = p_thread_id and user_id = p_user_id
  );
$$;
revoke all on function public.is_link_thread_participant(uuid, uuid) from public, anon;
grant execute on function public.is_link_thread_participant(uuid, uuid) to authenticated;

-- A status's denormalized thread_id must match the actual message's thread.
-- Previously a participant could attach their own thread_id to a message from
-- a different thread. Reads also hide any pre-existing inconsistent rows.
drop policy if exists "link_message_statuses_select_participant" on public.link_message_statuses;
create policy "link_message_statuses_select_participant" on public.link_message_statuses for select to authenticated using (
  public.is_link_thread_participant(thread_id, auth.uid())
  and exists (
    select 1 from public.link_messages m
    where m.id = link_message_statuses.message_id and m.thread_id = link_message_statuses.thread_id
  )
);

drop policy if exists "link_message_statuses_insert_own" on public.link_message_statuses;
create policy "link_message_statuses_insert_own" on public.link_message_statuses for insert to authenticated with check (
  user_id = auth.uid()
  and public.is_link_thread_participant(thread_id, auth.uid())
  and exists (
    select 1 from public.link_messages m
    where m.id = link_message_statuses.message_id and m.thread_id = link_message_statuses.thread_id
  )
);

drop policy if exists "link_message_statuses_update_own" on public.link_message_statuses;
create policy "link_message_statuses_update_own" on public.link_message_statuses for update to authenticated using (
  user_id = auth.uid()
  and public.is_link_thread_participant(thread_id, auth.uid())
  and exists (
    select 1 from public.link_messages m
    where m.id = link_message_statuses.message_id and m.thread_id = link_message_statuses.thread_id
  )
) with check (
  user_id = auth.uid()
  and public.is_link_thread_participant(thread_id, auth.uid())
  and exists (
    select 1 from public.link_messages m
    where m.id = link_message_statuses.message_id and m.thread_id = link_message_statuses.thread_id
  )
);

-- Browser validation can be bypassed through PostgREST. Constrain new messages
-- at the database boundary too; existing messages are retained unchanged.
drop policy if exists "link_messages_insert_participant" on public.link_messages;
create policy "link_messages_insert_participant" on public.link_messages for insert to authenticated with check (
  sender_id = auth.uid()
  and public.is_link_thread_participant(thread_id, auth.uid())
  and char_length(url) <= 2048
  and url ~* '^https?://[^[:space:]/?#]+'
  and url !~ '[[:cntrl:]]'
  and (caption is null or char_length(caption) <= 2000)
);

commit;
