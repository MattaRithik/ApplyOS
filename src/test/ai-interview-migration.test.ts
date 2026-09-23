import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("adds AI Interview to both existing enums without altering saved statuses, and can run twice", async () => {
  const db = new PGlite();
  try {
    await db.exec("create type application_status as enum ('applied','oa_assessment','first_round'); create type interview_round_type as enum ('oa_assessment','first_round'); create table applications (status application_status); insert into applications values ('applied');");
    const sql = readFileSync("supabase/migrations/20260922000100_ai_interview.sql", "utf8");
    await db.exec(sql);
    await db.exec(sql);
    await db.exec("insert into applications values ('ai_interview');");
    expect((await db.query("select status from applications")).rows).toEqual([{ status: "applied" }, { status: "ai_interview" }]);
    expect((await db.query("select 'ai_interview'::interview_round_type as round")).rows).toEqual([{ round: "ai_interview" }]);
  } finally { await db.close(); }
});
