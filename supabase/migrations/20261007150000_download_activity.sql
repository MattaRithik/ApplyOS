-- Server-written download requests; never stores file contents or signed URLs.
create table if not exists public.download_activity (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('resume', 'export')),
  file_name text not null,
  created_at timestamptz not null default now()
);
create index if not exists download_activity_created on public.download_activity(created_at desc, id desc);
alter table public.download_activity enable row level security;
revoke all on public.download_activity from anon, authenticated;
grant select, insert on public.download_activity to service_role;
