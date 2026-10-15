import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { createAppDatabase } from "@/test/database";

const owner = "11111111-1111-4111-8111-111111111111";
const user = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
const session = "44444444-4444-4444-8444-444444444444";
let db: Awaited<ReturnType<typeof createAppDatabase>>;

beforeAll(async () => {
  db = await createAppDatabase();
  await db.exec(`insert into auth.users(id,email) values
    ('${owner}','owner@example.com'), ('${user}','user@example.com'), ('${other}','other@example.com');
    insert into app_user_roles(user_id,role) values ('${owner}','owner');
    select admin_set_workspace_access('${owner}','${user}',true);`);
}, 30000);
beforeEach(async () => {
  await db.exec(
    "reset role; truncate user_presence, user_presence_history, user_page_visits restart identity",
  );
});
afterAll(async () => {
  await db?.close();
});

async function open(userId = user, sessionId = session, page = "blocked", closed = false) {
  await db.exec("set role service_role");
  await db.query(
    `insert into user_presence(user_id,session_id,page,visible,closed,last_seen_at,last_active_at)
    values ($1,$2,$3,true,$4,now(),null)
    on conflict (user_id,session_id) do update set
      page=excluded.page, closed=excluded.closed, last_seen_at=excluded.last_seen_at`,
    [userId, sessionId, page, closed],
  );
}

describe("blocked screen activity", () => {
  it("persists a passive open in the owner feed without inventing interaction or repeat events", async () => {
    await open();
    await open(); // Retried first report uses the same presence key.
    for (let i = 0; i < 100; i++) {
      await db.exec(
        "update user_presence set last_seen_at=last_seen_at + interval '15 seconds', visible=not visible",
      );
    }
    await open(user, session, "blocked", true);
    expect(
      (await db.query(`select user_id,page,status from meaningful_activity('${owner}')`)).rows,
    ).toEqual([{ user_id: user, page: "blocked", status: "Opened blocked screen" }]);
    expect((await db.query("select last_active_at from user_presence")).rows).toEqual([
      { last_active_at: null },
    ]);
    expect((await db.query("select * from user_page_visits")).rows).toEqual([]);
  });

  it("records a reload/new tab and a transition into the blocked screen", async () => {
    await open(user, session, "dashboard");
    expect((await db.query("select * from user_presence_history")).rows).toHaveLength(0);
    await open();
    await open(user, other);
    expect((await db.query(`select * from meaningful_activity('${owner}')`)).rows).toHaveLength(2);
  });

  it("ignores closed-only reports, unrestricted users and the owner", async () => {
    await open(user, session, "blocked", true);
    await open(other);
    await open(owner);
    expect((await db.query("select * from user_presence_history")).rows).toHaveLength(0);
  });

  it.each(["anon", "authenticated"])("keeps %s from reading or forging telemetry", async (role) => {
    await open();
    await db.exec(
      `reset role; select set_config('request.jwt.claim.sub','${user}',false); set role ${role}`,
    );
    await expect(db.exec("select * from user_presence_history")).rejects.toThrow();
    await expect(db.exec(`select * from meaningful_activity('${owner}')`)).rejects.toThrow();
    await expect(
      db.exec(`insert into user_presence_history(user_id,page,status,recorded_at)
      values ('${other}','blocked','Opened blocked screen',now())`),
    ).rejects.toThrow();
  });

  it("can reapply the migration without duplicating the trigger or losing records", async () => {
    await open();
    await db.exec("reset role");
    await db.exec(
      await readFile("supabase/migrations/20261015120000_blocked_screen_activity.sql", "utf8"),
    );
    await open();
    expect((await db.query("select * from user_presence_history")).rows).toHaveLength(1);
  });
});
