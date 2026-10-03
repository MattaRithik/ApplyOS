import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const db = new PGlite();
const user = "00000000-0000-4000-8000-000000000001";
const admin = "00000000-0000-4000-8000-000000000003";
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
    create table public.app_user_roles(user_id uuid, role text, revoked_at timestamptz);
    insert into auth.users values ('${user}'), ('${admin}');
    insert into app_user_roles values ('${admin}', 'owner', null);
    grant usage on schema public, auth to service_role, authenticated;
    grant select on app_user_roles to service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated;`);
  for (const table of ["applications", "companies", "contacts", "outreach", "interview_rounds", "follow_ups", "email_templates", "exports"]) {
    await db.exec(`create table public.${table}(user_id uuid references auth.users(id) on delete cascade, status text, notes text, updated_at timestamptz)`);
  }
  for (const file of ["20260930090000_owner_presence.sql", "20261001090000_presence_history.sql", "20261002160000_page_usage.sql"]) {
    await db.exec(await readFile(`supabase/migrations/${file}`, "utf8"));
  }
}, 30000);
afterAll(async () => db.close());
describe("page usage and actions", () => {
  it("measures active and idle intervals, attributes navigation to the previous page, and excludes gaps", async () => {
    await db.exec(`set role service_role;
      insert into user_presence(user_id,session_id,page,visible,last_seen_at,last_active_at)
      values('${user}','${user}','applications',true,'2026-10-02T12:00:00Z','2026-10-02T12:00:00Z');
      update user_presence set last_seen_at='2026-10-02T12:00:30Z';
      update user_presence set last_seen_at='2026-10-02T12:01:00Z';
      update user_presence set last_seen_at='2026-10-02T12:01:15Z', page='export';`);
    expect((await db.query("select page, active_seconds, visible_seconds from user_page_visits order by id")).rows).toEqual([
      { page: "applications", active_seconds: 60, visible_seconds: 75 },
      { page: "export", active_seconds: 0, visible_seconds: 0 },
    ]);
    await db.exec(`update user_presence set last_seen_at='2026-10-02T12:01:30Z',visible=false;
      update user_presence set last_seen_at='2026-10-02T12:02:00Z';
      update user_presence set last_seen_at='2026-10-02T15:00:00Z',visible=true,last_active_at='2026-10-02T15:00:00Z';
      update user_presence set last_seen_at='2026-10-02T15:00:15Z',closed=true;
      update user_presence set last_seen_at='2026-10-02T15:00:30Z';`);
    expect((await db.query("select active_seconds, visible_seconds from user_page_visits where page='export' order by id")).rows).toEqual([
      { active_seconds: 0, visible_seconds: 15 }, { active_seconds: 15, visible_seconds: 15 },
    ]);
    const summary = await db.query(`select visits, active_seconds, visible_seconds from page_usage_summary('2026-10-01', '${admin}') where page='export'`);
    expect(summary.rows).toEqual([{ visits: 2, active_seconds: 15, visible_seconds: 30 }]);
    await db.exec("reset role");
  });
  it("records committed actions without content, skips no-op updates and excludes admin actions", async () => {
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${user}';
      insert into applications(user_id,status,notes) values('${user}','saved','private contents');
      update applications set status='applied';
      update applications set updated_at=now();
      insert into exports(user_id) values('${user}');
      delete from applications;
      reset role;`);
    const actions = await db.query("select page,status from user_presence_history where session_id is null order by id");
    expect(actions.rows).toEqual([
      { page: "applications", status: "Application added" },
      { page: "applications", status: "Application status changed" },
      { page: "export", status: "Export generated" },
      { page: "applications", status: "Application deleted" },
    ]);
    await db.exec(`set role authenticated; set request.jwt.claim.sub='${admin}';
      insert into applications(user_id,status) values('${admin}','saved'); reset role;
      set role service_role;
      insert into user_presence(user_id,session_id,page,visible,last_seen_at,last_active_at)
      values('${admin}','${admin}','applications',true,now(),now()); reset role;`);
    expect((await db.query(`select * from user_page_visits where user_id='${admin}'`)).rows).toHaveLength(0);
    expect((await db.query(`select * from user_presence_history where user_id='${admin}' and session_id is null`)).rows).toHaveLength(0);
  });
  it.each(["anon", "authenticated"])("denies %s direct usage reads, writes, and summary access", async (role) => {
    await db.exec(`set role ${role}`);
    for (const query of ["select * from user_page_visits", "delete from user_page_visits", `select * from page_usage_summary(now(),'${admin}')`]) {
      await expect(db.exec(query)).rejects.toMatchObject({ code: "42501" });
    }
    await db.exec("reset role");
  });
  it("removes usage when the account is deleted", async () => {
    await db.exec(`delete from auth.users where id='${user}'`);
    expect((await db.query(`select * from user_page_visits where user_id='${user}'`)).rows).toHaveLength(0);
  });
});
