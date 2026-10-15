import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createAppDatabase } from "@/test/database";

const owner = "11111111-1111-4111-8111-111111111111";
const user = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
let db: Awaited<ReturnType<typeof createAppDatabase>>;

beforeAll(async () => {
  db = await createAppDatabase();
  await db.exec(`insert into auth.users(id,email) values ('${owner}','owner@example.com'),('${user}','user@example.com'),('${other}','other@example.com');
    insert into app_user_roles(user_id,role) values ('${owner}','owner');
    insert into applications(user_id,company_name,job_title) values ('${user}','Example','Analyst'),('${other}','Other','Researcher');`);
}, 30000);
afterAll(async () => {
  await db?.close();
});

async function asUser() {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub','${user}',false);
    select set_config('request.jwt.claims','{"app_metadata":{"workspace_access":"full"}}',false);
    set role authenticated;`);
}

describe("export-only database enforcement", () => {
  it("retains normal own-record access and denies other accounts", async () => {
    await asUser();
    expect((await db.query("select company_name from applications")).rows).toEqual([
      { company_name: "Example" },
    ]);
  });

  it("checks current account metadata, not stale JWTs or user-editable metadata", async () => {
    await db.exec(`reset role; update auth.users set raw_app_meta_data='{"providers":["email"]}' where id='${user}';
      select admin_set_workspace_access('${owner}','${user}',true,'request-1');
      update auth.users set raw_user_meta_data='{"workspace_access":"full"}' where id='${user}';`);
    await asUser();
    expect((await db.query("select workspace_access_allowed() as allowed")).rows).toEqual([
      { allowed: false },
    ]);
    expect((await db.query("select id from applications")).rows).toEqual([]);
    expect((await db.query("select id from profiles")).rows).toEqual([]);
    expect(
      (await db.query("update applications set job_title='Bypass' returning id")).rows,
    ).toEqual([]);
    await expect(
      db.exec(
        `insert into applications(user_id,company_name,job_title) values ('${user}','No','No')`,
      ),
    ).rejects.toThrow();
    await expect(
      db.exec(`select admin_set_workspace_access('${owner}','${user}',false,null)`),
    ).rejects.toThrow();
  });

  it("preserves source records for a service-scoped download", async () => {
    await db.exec("reset role; set role service_role");
    expect(
      (await db.query(`select job_title from applications where user_id='${user}'`)).rows,
    ).toEqual([{ job_title: "Analyst" }]);
    await expect(
      db.exec(`insert into ai_parser_usage(user_id,status) values ('${user}','pending')`),
    ).rejects.toThrow();
  });

  it("restores access atomically with an audit record and preserves provider metadata", async () => {
    await db.exec(
      `reset role; select admin_set_workspace_access('${owner}','${user}',false,'request-2')`,
    );
    expect(
      (
        await db.query(
          `select raw_app_meta_data->'providers' as providers from auth.users where id='${user}'`,
        )
      ).rows,
    ).toEqual([{ providers: ["email"] }]);
    expect(
      (
        await db.query(
          `select action_type from admin_audit_log where request_id in ('request-1','request-2') order by request_id`,
        )
      ).rows,
    ).toEqual([{ action_type: "workspace_blocked" }, { action_type: "workspace_restored" }]);
    await asUser();
    expect((await db.query("select id from applications")).rows).toHaveLength(1);
  });

  it("rejects a non-owner actor, self-restriction, and restricting an owner", async () => {
    await db.exec("reset role");
    await expect(
      db.exec(`select admin_set_workspace_access('${other}','${user}',true,null)`),
    ).rejects.toThrow();
    await expect(
      db.exec(`select admin_set_workspace_access('${owner}','${owner}',true,null)`),
    ).rejects.toThrow();
    await db.exec(`insert into app_user_roles(user_id,role) values ('${other}','owner')`);
    await expect(
      db.exec(`select admin_set_workspace_access('${owner}','${other}',true,null)`),
    ).rejects.toThrow();
  });

  it("covers every public RLS table and can be reapplied without losing data", async () => {
    await db.exec(
      await readFile("supabase/migrations/20261013220000_workspace_export_only.sql", "utf8"),
    );
    const missing =
      await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and c.relrowsecurity
      and not exists(select 1 from pg_policy p where p.polrelid=c.oid and p.polname='workspace_access_required' and not p.polpermissive)`);
    expect(missing.rows).toEqual([]);
    expect((await db.query("select id from applications")).rows).toHaveLength(2);
  });
});
