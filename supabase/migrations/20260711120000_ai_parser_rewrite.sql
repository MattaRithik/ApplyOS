-- =====================================================================
-- ApplyOS — AI Parser Rewrite (OpenAI gpt-5-nano/gpt-5-mini)
--
-- Supersedes the old Hugging Face job_parse_cache table with two new
-- tables scoped to the OpenAI-backed parser: ai_parser_usage (cost/usage
-- tracking, one row per parse attempt) and ai_parser_cache (result cache
-- keyed by user + description hash + schema/prompt version).
--
-- Server-write-only by design: both new tables get a SELECT-only RLS
-- policy for `authenticated`. All INSERT/UPDATE happen through
-- createServiceRoleClient() (src/lib/supabase/server.ts), which bypasses
-- RLS entirely — there is deliberately no insert/update/delete policy for
-- `authenticated` on either table.
-- =====================================================================

-- Intentionally do not drop the legacy job_parse_cache table here. It may
-- contain user data on an existing deployment. The application no longer
-- reads it; operators can archive/remove it later only after a verified
-- backup and retention decision.

-- ---------------------------------------------------------------------
-- ai_parser_usage — one row per parse attempt (pending -> success/failed/
-- cache_hit), used for cost tracking, rate limiting, and the Settings
-- "AI Parser Usage" tab. Rows are inserted by the rate-limit RPC below
-- and then finalized (tokens/cost/latency/status) by the API route via
-- the service-role client.
-- ---------------------------------------------------------------------

create table if not exists ai_parser_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  user_email_snapshot text,
  request_id text,
  provider text not null default 'openai',
  model text,
  fallback_used boolean not null default false,
  initial_model text,
  final_model text,
  status text not null default 'pending',
  cache_hit boolean not null default false,
  input_characters integer,
  input_tokens integer,
  output_tokens integer,
  total_tokens integer,
  cached_input_tokens integer,
  reasoning_tokens integer,
  provider_request_count integer not null default 0,
  estimated_input_cost_usd numeric(14, 8),
  estimated_cached_input_cost_usd numeric(14, 8),
  estimated_output_cost_usd numeric(14, 8),
  estimated_total_cost_usd numeric(14, 8),
  latency_ms integer,
  error_category text,
  parser_schema_version text,
  prompt_version text,
  description_hash text,
  created_at timestamptz not null default now()
);

create index if not exists idx_ai_parser_usage_user_created on ai_parser_usage(user_id, created_at);

-- ---------------------------------------------------------------------
-- ai_parser_cache — result cache keyed by user + description hash +
-- schema/prompt version, so re-pasting an identical posting (or bumping
-- the prompt/schema version) never silently serves a stale-shaped result.
-- ---------------------------------------------------------------------

create table if not exists ai_parser_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  description_hash text not null,
  result jsonb not null,
  model text,
  parser_schema_version text not null,
  prompt_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz
);

create unique index if not exists uniq_ai_parser_cache on ai_parser_cache(user_id, description_hash, parser_schema_version, prompt_version);

-- ---------------------------------------------------------------------
-- Atomic rate-limit RPC.
--
-- Runs as SECURITY DEFINER so it can be invoked via the service-role
-- client and still enforce limits atomically in one transaction
-- (concurrency/minute/daily checks + the `pending` row insert). Only
-- ever called server-side (src/lib/ai-parser/rate-limit.ts) via
-- supabase.rpc(...) using the service-role client — never exposed to
-- browser clients.
--
-- Tradeoff: minute/daily counts include ALL rows in the window
-- regardless of final status (including abandoned 'pending' rows that
-- never got finalized, e.g. a crashed request). For a single-user
-- rollout with modest limits this is an acceptable simplification —
-- an abandoned request just consumes one slot in whatever window it was
-- created in, self-healing once that window rolls over. A future
-- multi-user version should either sweep stale 'pending' rows or exclude
-- them from the minute/daily counts explicitly.
-- ---------------------------------------------------------------------

create or replace function ai_parser_try_acquire_slot(
  p_user_id uuid,
  p_minute_limit int,
  p_daily_limit int,
  p_concurrency_limit int
) returns table(ok boolean, reason text, usage_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_minute_count int;
  v_daily_count int;
  v_concurrent_count int;
  v_id uuid;
begin
  select count(*) into v_concurrent_count from ai_parser_usage
    where user_id = p_user_id and status = 'pending' and created_at > now() - interval '2 minutes';
  if v_concurrent_count >= p_concurrency_limit then
    return query select false, 'concurrency_limit', null::uuid;
    return;
  end if;

  select count(*) into v_minute_count from ai_parser_usage
    where user_id = p_user_id and created_at > now() - interval '1 minute';
  if v_minute_count >= p_minute_limit then
    return query select false, 'minute_limit', null::uuid;
    return;
  end if;

  select count(*) into v_daily_count from ai_parser_usage
    where user_id = p_user_id and created_at > date_trunc('day', now());
  if v_daily_count >= p_daily_limit then
    return query select false, 'daily_limit', null::uuid;
    return;
  end if;

  insert into ai_parser_usage (user_id, status) values (p_user_id, 'pending') returning id into v_id;
  return query select true, null::text, v_id;
end;
$$;

-- Only the service role should ever call this function (it's invoked via
-- supabase.rpc(...) from server-only code using the service-role key).
revoke all on function ai_parser_try_acquire_slot(uuid, int, int, int) from public;
grant execute on function ai_parser_try_acquire_slot(uuid, int, int, int) to service_role;

-- ---------------------------------------------------------------------
-- RLS — select-own only. No insert/update/delete policy for
-- `authenticated`: all writes go through the service-role client, which
-- bypasses RLS entirely by design.
-- ---------------------------------------------------------------------

alter table ai_parser_usage enable row level security;
alter table ai_parser_cache enable row level security;

drop policy if exists "ai_parser_usage_select_own" on ai_parser_usage;
create policy "ai_parser_usage_select_own" on ai_parser_usage for select using (auth.uid() = user_id);

drop policy if exists "ai_parser_cache_select_own" on ai_parser_cache;
create policy "ai_parser_cache_select_own" on ai_parser_cache for select using (auth.uid() = user_id);
