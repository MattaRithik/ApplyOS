-- =====================================================================
-- Job Drops — let a sender delete their own link message, any time.
-- link_message_statuses cascades on delete (message_id references
-- link_messages on delete cascade), so both people's status rows for
-- that message are removed automatically.
-- =====================================================================

drop policy if exists "link_messages_delete_own" on link_messages;
create policy "link_messages_delete_own" on link_messages for delete using (
  sender_id = auth.uid()
);
