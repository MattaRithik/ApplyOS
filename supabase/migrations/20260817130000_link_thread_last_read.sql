-- =====================================================================
-- Job Drops — per-user "last read" tracking, so the sidebar can show an
-- unread-message badge.
--
-- A plain `auth.uid() = user_id` update policy on
-- link_thread_participants would be enough for row-level access, but it
-- would also let a caller rewrite their own row's thread_id — silently
-- "joining" any thread whose UUID they can guess or learn. So, same
-- rationale as the resumes table (20260712150000_security_hardening.sql):
-- revoke the broad UPDATE grant and re-grant it for last_read_at only.
-- =====================================================================

alter table link_thread_participants add column if not exists last_read_at timestamptz;

drop policy if exists "link_thread_participants_update_own" on link_thread_participants;
create policy "link_thread_participants_update_own" on link_thread_participants for update using (
  auth.uid() = user_id
) with check (
  auth.uid() = user_id
);

revoke update on table link_thread_participants from authenticated;
grant update (last_read_at) on table link_thread_participants to authenticated;
