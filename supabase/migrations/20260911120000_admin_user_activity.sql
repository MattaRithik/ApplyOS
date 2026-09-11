-- Posting context is separate from billing/rate-limit rows so a failed
-- context write cannot prevent usage finalization. Only server code reads
-- or writes these records, after checking the owner session for reads.
create table if not exists ai_parser_attempt_details (
  usage_id uuid primary key references ai_parser_usage(id) on delete cascade,
  job_description text not null,
  job_url text,
  parsed_result jsonb
);

alter table ai_parser_attempt_details enable row level security;
revoke all on table ai_parser_attempt_details from anon, authenticated;
grant select, insert, update, delete on table ai_parser_attempt_details to service_role;

create index if not exists idx_applications_user_created
  on applications(user_id, created_at desc, id desc);
