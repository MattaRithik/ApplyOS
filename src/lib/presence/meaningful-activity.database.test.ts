import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
const db = new PGlite();
const user = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const owner = "00000000-0000-4000-8000-000000000003";
const session = "00000000-0000-4000-8000-000000000004";
const migration = "supabase/migrations/20261008190000_meaningful_activity.sql";

beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    create table public.app_user_roles(user_id uuid, role text, revoked_at timestamptz);
    insert into auth.users values ('${user}'), ('${other}'), ('${owner}');
    insert into app_user_roles values ('${owner}', 'owner', null);
    grant usage on schema public, auth to anon, authenticated, service_role;
    grant select on app_user_roles to service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated;`);
  for (const table of ["applications", "companies", "contacts", "outreach", "interview_rounds", "follow_ups", "email_templates", "exports"]) {
    await db.exec(`create table public.${table}(user_id uuid references auth.users(id) on delete cascade, status text, notes text, updated_at timestamptz)`);
  }
  await db.exec(`create table public.ai_parser_usage(id uuid primary key, user_id uuid, status text, created_at timestamptz);
    grant select on ai_parser_usage to service_role;`);
  for (const file of ["20260930090000_owner_presence.sql", "20261001090000_presence_history.sql", "20261002160000_page_usage.sql", "20261007150000_download_activity.sql", "20261008190000_meaningful_activity.sql"]) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
  await db.exec(await readFile(migration, "utf8"));
}, 30000);
beforeEach(async () => {
  await db.exec("reset role; truncate user_presence, user_presence_history, user_page_visits, ai_parser_usage, download_activity restart identity; set request.jwt.claim.sub='';");
});
afterAll(async () => db.close());

describe("meaningful activity tracking", () => {
  it("does not create visits or history from hundreds of background reports", async () => {
    await db.exec(`set role service_role;
      insert into user_presence(user_id, session_id, page, visible, last_seen_at, last_active_at)
      values ('${user}', '${session}', 'applications', false, '2026-10-08T12:00:00Z', '2026-10-07T12:00:00Z');`);
    for (let i = 0; i < 200; i++) {
      await db.exec("update user_presence set last_seen_at=last_seen_at + interval '60 seconds'");
    }
    expect((await db.query("select * from user_page_visits")).rows).toHaveLength(0);
    expect((await db.query("select * from user_presence_history")).rows).toHaveLength(0);
  });

  it("opening a focused tab is not interaction, and idle polls do not create new windows", async () => {
    await db.exec(`set role service_role;
      insert into user_presence(user_id, session_id, page, visible, last_seen_at, last_active_at)
      values ('${user}', '${session}', 'applications', true, '2026-10-08T12:00:00Z', null);
      update user_presence set last_seen_at='2026-10-08T12:00:15Z';`);
    expect((await db.query("select * from user_page_visits")).rows).toHaveLength(0);
    await db.exec(`update user_presence set last_seen_at='2026-10-08T12:00:20Z', last_active_at='2026-10-08T12:00:20Z';`);
    for (let i = 0; i < 100; i++) {
      await db.exec("update user_presence set last_seen_at=last_seen_at + interval '15 seconds'");
    }
    expect((await db.query("select active_seconds from user_page_visits")).rows).toEqual([{ active_seconds: 60 }]);
    expect((await db.query("select * from user_presence_history")).rows).toHaveLength(0);
    expect((await db.query(`select visits from page_usage_summary('2026-10-08', '${owner}')`)).rows).toEqual([{ visits: 1 }]);
  });

  it("only creates another window after genuine input, not after background timer throttling", async () => {
    await db.exec(`set role service_role;
      insert into user_presence(user_id, session_id, page, visible, last_seen_at, last_active_at)
      values ('${user}', '${session}', 'applications', true, '2026-10-08T12:00:00Z', '2026-10-08T12:00:00Z');
      update user_presence set last_seen_at='2026-10-08T12:00:15Z';
      update user_presence set last_seen_at='2026-10-08T12:00:30Z', visible=false;
      update user_presence set last_seen_at='2026-10-08T12:01:30Z';
      update user_presence set last_seen_at='2026-10-08T12:02:30Z';
      update user_presence set last_seen_at='2026-10-08T12:03:30Z', visible=true;`);
    expect((await db.query("select * from user_page_visits")).rows).toHaveLength(1);
    await db.exec(`update user_presence set last_seen_at='2026-10-08T12:03:35Z', last_active_at='2026-10-08T12:03:35Z';
      update user_presence set last_seen_at='2026-10-08T12:03:50Z';
      insert into user_page_visits(user_id,session_id,page,started_at,last_report_at)
      values ('${user}', '${other}', 'applications', '2026-10-08T13:00:00Z', '2026-10-08T13:00:00Z');`);
    expect((await db.query(`select visits from page_usage_summary('2026-10-08', '${owner}')`)).rows).toEqual([{ visits: 2 }]);
    expect((await db.query("select * from user_presence_history")).rows).toHaveLength(0);
  });

  it("shows each saved action, completed parse and resume request once; hides heartbeat reports and failed parses", async () => {
    await db.exec(`insert into user_presence_history(user_id,session_id,page,status,recorded_at) values
      ('${user}','${session}','applications','Background','2026-10-08T17:00:00Z'),
      ('${user}','${session}','applications','Active','2026-10-08T17:01:00Z'),
      ('${user}',null,'applications','Application added','2026-10-08T16:00:00Z'),
      ('${user}',null,'applications','Application status changed','2026-10-08T16:30:00Z'),
      ('${owner}',null,'applications','Application updated','2026-10-08T17:05:00Z');
      insert into ai_parser_usage values
      ('${user}','${user}','success','2026-10-08T16:05:00Z'),
      ('${other}','${user}','cache_hit','2026-10-08T16:10:00Z'),
      ('${session}','${user}','failed','2026-10-08T17:10:00Z'),
      ('${owner}','${owner}','success','2026-10-08T17:20:00Z');
      insert into download_activity(user_id,kind,file_name,created_at) values
      ('${user}','resume','Private filename.pdf','2026-10-08T16:20:00Z');
      set role service_role;`);
    const rows = (await db.query<{ status: string }>(`select * from meaningful_activity('${owner}')`)).rows;
    expect(rows.map(row => row.status)).toEqual([
      "Application status changed", "Resume download requested", "Application parsed", "Application parsed", "Application added",
    ]);
    expect(JSON.stringify(rows)).not.toContain("Private filename");
  });

  it("keeps cursor pagination stable for actions sharing a timestamp", async () => {
    for (let i = 0; i < 15; i++) {
      await db.exec(`insert into user_presence_history(user_id,page,status,recorded_at)
        values ('${user}','applications','Application updated','2026-10-08T16:36:00Z')`);
    }
    await db.exec("set role service_role");
    const first = (await db.query<{ id: string; recorded_at: string }>(`select * from meaningful_activity('${owner}', null, null, 10)`)).rows;
    const last = first.at(-1)!;
    const second = (await db.query<{ id: string }>(`select * from meaningful_activity($1, $2, $3, 10)`, [owner, last.recorded_at, last.id])).rows;
    expect(first).toHaveLength(10);
    expect(second).toHaveLength(5);
    expect(new Set([...first, ...second].map(row => row.id)).size).toBe(15);
  });

  it.each(["anon", "authenticated"])("denies %s access to the combined feed", async (role) => {
    await db.exec(`set role ${role}`);
    await expect(db.exec(`select * from meaningful_activity('${owner}')`)).rejects.toMatchObject({ code: "42501" });
    await db.exec("reset role");
  });
});
