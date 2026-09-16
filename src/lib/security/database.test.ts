import { readFile } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// A disposable PostgreSQL engine: no production credentials or network access.
const db = new PGlite();
const userA = "00000000-0000-4000-8000-000000000001";
const userB = "00000000-0000-4000-8000-000000000002";
const userC = "00000000-0000-4000-8000-000000000003";
const threadA = "00000000-0000-4000-8000-000000000011";
const threadB = "00000000-0000-4000-8000-000000000012";
const messageA = "00000000-0000-4000-8000-000000000021";
const messageB = "00000000-0000-4000-8000-000000000022";
const migration = (name: string) => readFile(path.join(process.cwd(), "supabase/migrations", name), "utf8");

beforeAll(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to authenticated;
    grant execute on function auth.uid() to authenticated;
    alter default privileges in schema public grant all on tables to authenticated;
    create publication supabase_realtime;
    create function public.set_updated_at() returns trigger language plpgsql as
      $$ begin new.updated_at = now(); return new; end $$;
  `);
  for (const name of [
    "20260817120000_link_threads.sql", "20260817130000_link_thread_last_read.sql",
    "20260817140000_link_thread_dedupe_and_unique.sql", "20260817150000_link_thread_rls_fix.sql",
    "20260817160000_link_messages_delete_own.sql",
  ]) await db.exec(await migration(name));
  await db.exec(`
    insert into auth.users values ('${userA}'), ('${userB}'), ('${userC}');
    insert into link_threads (id, created_by) values ('${threadA}', '${userA}'), ('${threadB}', '${userC}');
    insert into link_thread_participants (thread_id, user_id)
      values ('${threadA}', '${userA}'), ('${threadA}', '${userB}'), ('${threadB}', '${userC}');
    insert into link_messages (id, thread_id, sender_id, url)
      values ('${messageA}', '${threadA}', '${userA}', 'https://example.com/a'),
             ('${messageB}', '${threadB}', '${userC}', 'https://example.com/b');
    -- Legacy corrupt row must be preserved physically but hidden from users.
    insert into link_message_statuses (message_id, thread_id, user_id, status)
      values ('${messageB}', '${threadA}', '${userB}', 'applied');
  `);
  const patch = await migration("20260916120000_link_security_hardening.sql");
  await db.exec(patch);
  await db.exec(patch); // Safe to reapply.
  await db.exec(`set role authenticated; set request.jwt.claim.sub = '${userA}';`);
}, 30_000);

afterAll(async () => { await db.close(); });

describe("database authorization with real RLS", () => {
  it("shows only the current user's thread and hides mismatched legacy statuses", async () => {
    expect((await db.query("select id from link_messages")).rows).toEqual([{ id: messageA }]);
    expect((await db.query("select * from link_message_statuses")).rows).toEqual([]);
    expect((await db.query("select user_id from link_thread_participants order by user_id")).rows)
      .toEqual([{ user_id: userA }, { user_id: userB }]);
  });

  it("does not expose other users' membership through the privileged helper", async () => {
    const result = await db.query("select is_link_thread_participant($1, $2) as member", [threadB, userC]);
    expect(result.rows).toEqual([{ member: false }]);
  });

  it("rejects a forged status for a message in another thread", async () => {
    await expect(db.query(`insert into link_message_statuses (message_id, thread_id, user_id, status)
      values ($1, $2, $3, 'applied')`, [messageB, threadA, userA])).rejects.toMatchObject({ code: "42501" });
  });

  it("allows own statuses and upserts but rejects moving them across threads", async () => {
    const upsert = `insert into link_message_statuses (message_id, thread_id, user_id, status)
      values ($1, $2, $3, $4) on conflict (message_id, user_id) do update
      set message_id = excluded.message_id, thread_id = excluded.thread_id,
          user_id = excluded.user_id, status = excluded.status`;
    await db.query(upsert, [messageA, threadA, userA, "applied"]);
    await db.query(upsert, [messageA, threadA, userA, "not_applicable"]);
    await expect(db.query("update link_message_statuses set message_id = $1 where user_id = $2", [messageB, userA]))
      .rejects.toMatchObject({ code: "42501" });
    expect((await db.query("select status from link_message_statuses where user_id = $1", [userA])).rows)
      .toEqual([{ status: "not_applicable" }]);
  });

  it("allows last-read updates but prevents joining arbitrary threads", async () => {
    await db.query("update link_thread_participants set last_read_at = now() where user_id = $1", [userA]);
    await expect(db.query("update link_thread_participants set thread_id = $1 where user_id = $2", [threadB, userA]))
      .rejects.toMatchObject({ code: "42501" });
  });

  it.each(["javascript:alert(1)", "data:text/html,evil", "https://example.com/\nmalicious"])("rejects unsafe URL %s", async (url) => {
    await expect(db.query("insert into link_messages (thread_id, sender_id, url) values ($1, $2, $3)", [threadA, userA, url]))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("still accepts ordinary HTTP(S) job links", async () => {
    await db.query("insert into link_messages (thread_id, sender_id, url) values ($1, $2, $3)", [threadA, userA, "https://example.com/jobs/123"]);
  });

  it("preserves existing data through migration", async () => {
    await db.exec("reset role");
    try {
      expect((await db.query("select message_id from link_message_statuses where user_id = $1", [userB])).rows)
        .toEqual([{ message_id: messageB }]);
    } finally { await db.exec("set role authenticated"); }
  });
});
