import { readFile } from "node:fs/promises";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createAppDatabase } from "./database";

const userA = "10000000-0000-4000-8000-000000000001";
const userB = "10000000-0000-4000-8000-000000000002";
const companyA = "20000000-0000-4000-8000-000000000001";
const companyB = "20000000-0000-4000-8000-000000000002";
const appA = "30000000-0000-4000-8000-000000000001";
const appB = "30000000-0000-4000-8000-000000000002";
let db: PGlite;

beforeAll(async () => {
  db = await createAppDatabase();
  await db.exec(
    await readFile("supabase/migrations/20261011180000_public_release_guards.sql", "utf8"),
  );
}, 30_000);
afterAll(async () => {
  await db.close();
});
beforeEach(async () => {
  await db.exec(`reset role; truncate auth.users cascade;
    insert into auth.users(id,email) values ('${userA}','a@example.test'),('${userB}','b@example.test');
    insert into companies(id,user_id,name) values ('${companyA}','${userA}','Company A'),('${companyB}','${userB}','Company B');
    insert into applications(id,user_id,company_id,company_name,job_title) values
      ('${appA}','${userA}','${companyA}','Company A','Analyst'), ('${appB}','${userB}','${companyB}','Company B','Engineer');
    insert into ai_parser_entitlements(user_id,enabled) values ('${userA}',true),('${userB}',true);
    set request.jwt.claim.sub = '${userA}'; set role authenticated;`);
});

describe("full database setup and tenant isolation", () => {
  it("enables RLS on every public table", async () => {
    const result =
      await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
      where n.nspname='public' and c.relkind='r' and not c.relrowsecurity`);
    expect(result.rows).toEqual([]);
  });

  it("shows only own profiles, companies, applications, and status history", async () => {
    expect((await db.query("select id from profiles")).rows).toEqual([{ id: userA }]);
    expect((await db.query("select id from companies")).rows).toEqual([{ id: companyA }]);
    expect((await db.query("select id from applications")).rows).toEqual([{ id: appA }]);
    expect(
      (await db.query("select distinct user_id from application_status_history")).rows,
    ).toEqual([{ user_id: userA }]);
    expect(
      (
        await db.query("update applications set job_title='Forged' where id=$1 returning id", [
          appB,
        ])
      ).rows,
    ).toEqual([]);
  });

  it("rejects cross-owner company references and reassignment", async () => {
    await expect(
      db.query(
        "insert into applications(user_id,company_id,company_name,job_title) values($1,$2,'B','Forged')",
        [userA, companyB],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("update applications set company_id=$1 where id=$2", [companyB, appA]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("update applications set user_id=$1 where id=$2", [userB, appA]),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("blocks forged parsed details, interview rounds, and notes", async () => {
    await expect(
      db.query("insert into parsed_job_details(user_id,application_id) values($1,$2)", [
        userA,
        appB,
      ]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(
        "insert into interview_rounds(user_id,application_id,round_name,round_type) values($1,$2,'Forged','technical')",
        [userA, appB],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(
        "insert into notes(user_id,entity_type,entity_id,body) values($1,'application',$2,'Forged')",
        [userA, appB],
      ),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("denies browser access to administrative and telemetry tables", async () => {
    for (const table of ["app_user_roles", "admin_audit_log"]) {
      expect((await db.query(`select * from ${table}`)).rows).toEqual([]);
    }
    expect((await db.query("select user_id from ai_parser_entitlements")).rows).toEqual([
      { user_id: userA },
    ]);
    expect(
      (
        await db.query(
          "update ai_parser_entitlements set enabled=false where user_id=$1 returning user_id",
          [userA],
        )
      ).rows,
    ).toEqual([]);
    for (const table of [
      "ai_parser_attempt_details",
      "user_presence",
      "user_presence_history",
      "user_page_visits",
      "download_activity",
      "link_messages",
    ]) {
      await expect(db.query(`select * from ${table}`)).rejects.toMatchObject({ code: "42501" });
    }
    await expect(
      db.query("insert into app_user_roles(user_id,role) values($1,'owner')", [userA]),
    ).rejects.toMatchObject({ code: "42501" });
  });

  it("denies browser writes to parser usage and resume storage metadata", async () => {
    await expect(
      db.query("insert into ai_parser_usage(user_id,status) values($1,'success')", [userA]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query(
        "insert into resumes(user_id,display_name,original_file_name,storage_key) values($1,'Fake','fake.pdf','fake')",
        [userA],
      ),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(
      db.query("select * from ai_parser_acquire_slot($1,5,100,2,5,50,0.30)", [userA]),
    ).rejects.toMatchObject({ code: "42501" });
    await expect(db.query("select ai_parser_cost_total($1)", [userB])).rejects.toMatchObject({
      code: "42501",
    });
  });

  it("makes follow-up views respect caller RLS", async () => {
    await db.exec(`reset role; insert into follow_ups(user_id,title,due_date) values
      ('${userA}','A',current_date-1),('${userB}','B',current_date-1); set role authenticated;`);
    expect((await db.query("select title from v_follow_ups_overdue")).rows).toEqual([
      { title: "A" },
    ]);
  });
});

describe("public resource limits", () => {
  it("aggregates all spending beyond the API row limit", async () => {
    await db.exec(`reset role; insert into ai_parser_usage(user_id,status,estimated_total_cost_usd)
      select '${userA}','success',0.01 from generate_series(1,1500); set role service_role;`);
    expect(
      (await db.query<{ total: string }>("select ai_parser_cost_total($1) as total", [userA]))
        .rows[0].total,
    ).toBe("15.00000000");
    expect(
      Number(
        (await db.query<{ total: string }>("select ai_parser_cost_total($1) as total", [userB]))
          .rows[0].total,
      ),
    ).toBe(0);
  });

  it("reserves budget before a second pending request can spend it", async () => {
    await db.exec("set role service_role");
    const call = () =>
      db.query<{ ok: boolean; reason: string | null }>(
        "select * from ai_parser_acquire_slot($1,100,100,10,0.5,50,0.30)",
        [userA],
      );
    expect((await call()).rows[0].ok).toBe(true);
    expect((await call()).rows[0]).toMatchObject({ ok: false, reason: "monthly_budget" });
  });

  it("enforces a global budget across different users", async () => {
    await db.exec("set role service_role");
    expect(
      (
        await db.query<{ ok: boolean }>(
          "select * from ai_parser_acquire_slot($1,100,100,10,5,0.5,0.30)",
          [userA],
        )
      ).rows[0].ok,
    ).toBe(true);
    expect(
      (await db.query("select * from ai_parser_acquire_slot($1,100,100,10,5,0.5,0.30)", [userB]))
        .rows[0],
    ).toMatchObject({ ok: false, reason: "global_budget" });
  });

  it("rechecks revoked AI access within the reservation transaction", async () => {
    await db.exec(
      `reset role; update ai_parser_entitlements set enabled=false where user_id='${userA}'; set role service_role;`,
    );
    expect(
      (await db.query("select * from ai_parser_acquire_slot($1,100,100,10,5,50,0.30)", [userA]))
        .rows[0],
    ).toMatchObject({ ok: false, reason: "access_denied" });
  });

  it("limits total files even when archived", async () => {
    await db.exec(`reset role; insert into resumes(user_id,display_name,original_file_name,storage_key,file_size,is_archived)
      select '${userA}','File '||i,'file.pdf','key-'||i,1024,true from generate_series(1,50) i; set role service_role;`);
    await expect(
      db.query(
        "insert into resumes(user_id,display_name,original_file_name,storage_key,file_size) values($1,'Next','file.pdf','next',1024)",
        [userA],
      ),
    ).rejects.toMatchObject({ code: "P0001" });
  });

  it("limits reserved storage bytes and permits uploads after deleting files", async () => {
    await db.exec(`reset role; insert into resumes(user_id,display_name,original_file_name,storage_key,file_size)
      select '${userA}','File '||i,'file.pdf','key-'||i,10485760 from generate_series(1,10) i; set role service_role;`);
    const insert = () =>
      db.query(
        "insert into resumes(user_id,display_name,original_file_name,storage_key,file_size) values($1,'Next','file.pdf','next',1024)",
        [userA],
      );
    await expect(insert()).rejects.toMatchObject({ code: "P0001" });
    await db.query("delete from resumes where storage_key='key-1'");
    await expect(insert()).resolves.toBeDefined();
  });
});
