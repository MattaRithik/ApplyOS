-- Latest state per signed-in browser tab; no page-view history or content.
create table if not exists public.user_presence (
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  email text,
  page text not null,
  visible boolean not null,
  closed boolean not null default false,
  last_seen_at timestamptz not null,
  last_active_at timestamptz not null,
  ip_address inet,
  location text,
  user_agent text,
  primary key (user_id, session_id)
);
create index if not exists idx_user_presence_last_seen on public.user_presence(last_seen_at desc);
alter table public.user_presence enable row level security;
-- Even the tracked user cannot read/write the table directly. The API
-- authenticates heartbeats and restricts reads to APP_OWNER_EMAIL.
revoke all on public.user_presence from public, anon, authenticated;
grant select, insert, update, delete on public.user_presence to service_role;
