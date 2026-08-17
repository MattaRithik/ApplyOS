-- =====================================================================
-- Job Drops — enforce "at most one thread per person" at the database
-- level, and clean up any rows that violated that invariant before the
-- constraint existed.
--
-- addThreadPartner always checked for an existing membership before
-- creating a new thread, but that check and the insert weren't atomic —
-- clicking "Add" again before the page had re-rendered (or two tabs
-- racing) could create a second thread for the same person. Every
-- .maybeSingle() lookup on link_thread_participants (page.tsx,
-- addThreadPartner's own membership check, markJobDropsRead) then
-- errors when more than one row matches, which reads as "no thread"
-- even though a pairing exists — exactly the symptom of a link showing
-- up as already-paired in the invite list while its own thread never
-- renders.
-- =====================================================================

with ranked as (
  select thread_id, user_id,
         row_number() over (partition by user_id order by joined_at asc, thread_id asc) as rn
  from link_thread_participants
)
delete from link_thread_participants tp
using ranked r
where tp.thread_id = r.thread_id and tp.user_id = r.user_id and r.rn > 1;

-- Threads left with zero participants after the dedupe above are dead
-- weight; their messages/statuses cascade-delete with them.
delete from link_threads t
where not exists (select 1 from link_thread_participants tp where tp.thread_id = t.id);

alter table link_thread_participants drop constraint if exists link_thread_participants_user_id_key;
alter table link_thread_participants add constraint link_thread_participants_user_id_key unique (user_id);
