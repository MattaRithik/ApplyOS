-- =====================================================================
-- ApplyOS — Together: a shared job-link thread between exactly two
-- accounts.
--
-- This is the first feature in the codebase where two *different*
-- `auth.users` rows deliberately read/write the same data — every other
-- table is scoped strictly to auth.uid() = user_id. Access is gated by
-- link_thread_participants membership instead.
--
-- link_threads / link_thread_participants are select-only for
-- `authenticated` — same deliberate omission of insert/update/delete
-- policies as admin_audit_log (20260712090000_admin_authorization.sql):
-- both rows are only ever created by the service-role client inside the
-- addThreadPartner server action (src/app/(app)/together/actions.ts),
-- which has already verified the caller isn't in a thread yet and looked
-- up the invited partner's profile by email.
--
-- link_message_statuses denormalizes thread_id (in addition to
-- message_id) so both the RLS check and the Postgres Changes realtime
-- filter can key on thread_id directly, without a join.
-- =====================================================================

create table if not exists link_threads (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists link_thread_participants (
  thread_id uuid not null references link_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

create index if not exists idx_link_thread_participants_user on link_thread_participants(user_id);

create table if not exists link_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references link_threads(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  url text not null,
  caption text,
  created_at timestamptz not null default now()
);

create index if not exists idx_link_messages_thread on link_messages(thread_id, created_at);

create table if not exists link_message_statuses (
  message_id uuid not null references link_messages(id) on delete cascade,
  thread_id uuid not null references link_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('applied', 'not_applied', 'not_applicable')),
  updated_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists idx_link_message_statuses_thread on link_message_statuses(thread_id);

drop trigger if exists trg_link_message_statuses_updated_at on link_message_statuses;
create trigger trg_link_message_statuses_updated_at before update on link_message_statuses
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------

alter table link_threads enable row level security;
alter table link_thread_participants enable row level security;
alter table link_messages enable row level security;
alter table link_message_statuses enable row level security;

drop policy if exists "link_threads_select_participant" on link_threads;
create policy "link_threads_select_participant" on link_threads for select using (
  exists (select 1 from link_thread_participants tp where tp.thread_id = link_threads.id and tp.user_id = auth.uid())
);

drop policy if exists "link_thread_participants_select_member" on link_thread_participants;
create policy "link_thread_participants_select_member" on link_thread_participants for select using (
  exists (
    select 1 from link_thread_participants tp2
    where tp2.thread_id = link_thread_participants.thread_id and tp2.user_id = auth.uid()
  )
);

drop policy if exists "link_messages_select_participant" on link_messages;
create policy "link_messages_select_participant" on link_messages for select using (
  exists (select 1 from link_thread_participants tp where tp.thread_id = link_messages.thread_id and tp.user_id = auth.uid())
);

drop policy if exists "link_messages_insert_participant" on link_messages;
create policy "link_messages_insert_participant" on link_messages for insert with check (
  sender_id = auth.uid()
  and exists (select 1 from link_thread_participants tp where tp.thread_id = link_messages.thread_id and tp.user_id = auth.uid())
);

drop policy if exists "link_message_statuses_select_participant" on link_message_statuses;
create policy "link_message_statuses_select_participant" on link_message_statuses for select using (
  exists (select 1 from link_thread_participants tp where tp.thread_id = link_message_statuses.thread_id and tp.user_id = auth.uid())
);

drop policy if exists "link_message_statuses_insert_own" on link_message_statuses;
create policy "link_message_statuses_insert_own" on link_message_statuses for insert with check (
  user_id = auth.uid()
  and exists (select 1 from link_thread_participants tp where tp.thread_id = link_message_statuses.thread_id and tp.user_id = auth.uid())
);

drop policy if exists "link_message_statuses_update_own" on link_message_statuses;
create policy "link_message_statuses_update_own" on link_message_statuses for update using (
  user_id = auth.uid()
  and exists (select 1 from link_thread_participants tp where tp.thread_id = link_message_statuses.thread_id and tp.user_id = auth.uid())
);

-- Deliberately no insert/update/delete policy of any kind for link_threads
-- or link_thread_participants + `authenticated`: those rows are only ever
-- written by the service-role client inside addThreadPartner.

-- ---------------------------------------------------------------------
-- Realtime — required for Postgres Changes subscriptions to fire.
-- Nothing else in this codebase has needed the publication yet.
-- ---------------------------------------------------------------------

do $$ begin
  alter publication supabase_realtime add table link_messages;
exception when duplicate_object then null; end $$;

do $$ begin
  alter publication supabase_realtime add table link_message_statuses;
exception when duplicate_object then null; end $$;
