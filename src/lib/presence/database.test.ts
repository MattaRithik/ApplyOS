import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
const db = new PGlite();
beforeAll(async () => {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    grant usage on schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables to anon, authenticated;
    insert into auth.users values ('00000000-0000-4000-8000-000000000001');`);
  const migration = await readFile("supabase/migrations/20260930090000_owner_presence.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration);
  await db.exec(`set role service_role;
    insert into public.user_presence(user_id, session_id, page, visible, last_seen_at, last_active_at)
    values ('00000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000002', 'dashboard', true, now(), now());
    reset role;`);
}, 30000);
afterAll(async () => db.close());
describe("presence database isolation", () => {
  it.each(["anon", "authenticated"])("blocks all direct %s table operations", async (role) => {
    await db.exec(`set role ${role}`);
    for (const sql of ["select * from public.user_presence", "delete from public.user_presence", "update public.user_presence set visible = false",
      "insert into public.user_presence(user_id) values ('00000000-0000-4000-8000-000000000001')"]) {
      await expect(db.exec(sql)).rejects.toMatchObject({ code: "42501" });
    }
    await db.exec("reset role");
  });
  it("allows the server role to read and account deletion cascades", async () => {
    await db.exec("set role service_role");
    expect((await db.query("select * from public.user_presence")).rows).toHaveLength(1);
    await db.exec("reset role; delete from auth.users");
    expect((await db.query("select * from public.user_presence")).rows).toHaveLength(0);
  });
});
