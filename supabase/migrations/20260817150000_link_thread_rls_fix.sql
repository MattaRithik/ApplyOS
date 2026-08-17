-- =====================================================================
-- Job Drops — fix "infinite recursion detected in policy for relation
-- link_thread_participants" (Postgres error 42P17).
--
-- The original link_thread_participants_select_member policy checked
-- membership by querying link_thread_participants from inside its own
-- USING clause. Any query touching that table — directly, or indirectly
-- via link_threads/link_messages/link_message_statuses' own policies,
-- all of which also check membership through link_thread_participants —
-- re-triggered the same policy on the inner query, which Postgres
-- correctly refuses to resolve. Confirmed against a live throwaway test:
-- every affected select/insert failed with 42P17, and the JS client
-- surfaces that as an empty { data: null, error } with no visible crash,
-- which is why the page just silently rendered as "no thread".
--
-- Fix: a SECURITY DEFINER function that checks membership as the
-- function owner (which bypasses RLS, since table owners aren't subject
-- to their own table's policies) instead of as the querying role. This
-- is the standard Postgres/Supabase pattern for self-referencing
-- "group membership" policies.
-- =====================================================================

create or replace function is_link_thread_participant(p_thread_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from link_thread_participants
    where thread_id = p_thread_id and user_id = p_user_id
  );
$$;

revoke all on function is_link_thread_participant(uuid, uuid) from public;
grant execute on function is_link_thread_participant(uuid, uuid) to authenticated;

drop policy if exists "link_threads_select_participant" on link_threads;
create policy "link_threads_select_participant" on link_threads for select using (
  is_link_thread_participant(link_threads.id, auth.uid())
);

drop policy if exists "link_thread_participants_select_member" on link_thread_participants;
create policy "link_thread_participants_select_member" on link_thread_participants for select using (
  is_link_thread_participant(link_thread_participants.thread_id, auth.uid())
);

drop policy if exists "link_messages_select_participant" on link_messages;
create policy "link_messages_select_participant" on link_messages for select using (
  is_link_thread_participant(link_messages.thread_id, auth.uid())
);

drop policy if exists "link_messages_insert_participant" on link_messages;
create policy "link_messages_insert_participant" on link_messages for insert with check (
  sender_id = auth.uid() and is_link_thread_participant(link_messages.thread_id, auth.uid())
);

drop policy if exists "link_message_statuses_select_participant" on link_message_statuses;
create policy "link_message_statuses_select_participant" on link_message_statuses for select using (
  is_link_thread_participant(link_message_statuses.thread_id, auth.uid())
);

drop policy if exists "link_message_statuses_insert_own" on link_message_statuses;
create policy "link_message_statuses_insert_own" on link_message_statuses for insert with check (
  user_id = auth.uid() and is_link_thread_participant(link_message_statuses.thread_id, auth.uid())
);

drop policy if exists "link_message_statuses_update_own" on link_message_statuses;
create policy "link_message_statuses_update_own" on link_message_statuses for update using (
  user_id = auth.uid() and is_link_thread_participant(link_message_statuses.thread_id, auth.uid())
);
