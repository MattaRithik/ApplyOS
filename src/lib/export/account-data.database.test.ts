import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAppDatabase } from "@/test/database";
import { collectAccountData } from "./account-data";

let db: Awaited<ReturnType<typeof createAppDatabase>>;
const self = "61111111-1111-4111-8111-111111111111";
const other = "62222222-2222-4222-8222-222222222222";
beforeAll(async () => {
  db = await createAppDatabase();
  await db.exec(`insert into auth.users(id,email) values ('${self}','self@example.com'),('${other}','other@example.com');
    insert into applications(user_id,company_name,job_title) values ('${self}','Own company','Own job'),('${other}','Private other company','Other job');
    insert into ai_parser_entitlements(user_id,enabled) values ('${self}',true),('${other}',true);
    insert into resumes(user_id,display_name,original_file_name,storage_key,status) values
      ('${self}','Own resume','own.docx','users/${self}/resumes/example/files/own.docx','uploaded'),
      ('${other}','Private other resume','other.docx','users/${other}/resumes/example/files/other.docx','uploaded');
    insert into ai_parser_usage(id,user_id,status) values ('63333333-3333-4333-8333-333333333333','${self}','success'),('64444444-4444-4444-8444-444444444444','${other}','success');
    insert into ai_parser_attempt_details(usage_id,job_description) values ('63333333-3333-4333-8333-333333333333','Own posting'),('64444444-4444-4444-8444-444444444444','Other private posting');
    update auth.users set raw_app_meta_data='{"workspace_access":"export_only"}' where id='${self}';`);
}, 30000);
afterAll(async () => {
  await db?.close();
});

// Execute the collector's real REST-shaped queries against the full database
// schema. This catches nonexistent ordering columns as well as scope mistakes.
function privilegedClient(): SupabaseClient {
  return {
    from(table: string) {
      const filters: string[] = [];
      const values: unknown[] = [];
      const ordering: string[] = [];
      const identifier = (value: string) => {
        if (!/^\w+$/.test(value)) throw new Error("Invalid identifier");
        return `"${value}"`;
      };
      const query = {
        select: () => query,
        eq(column: string, value: unknown) {
          values.push(value);
          filters.push(`${identifier(column)}=$${values.length}`);
          return query;
        },
        in(column: string, options: unknown[]) {
          const params = options.map((value) => {
            values.push(value);
            return `$${values.length}`;
          });
          filters.push(`${identifier(column)} in (${params.join(",")})`);
          return query;
        },
        order(column: string) {
          ordering.push(identifier(column));
          return query;
        },
        async range(start: number, end: number) {
          try {
            const result = await db.query(
              `select * from ${identifier(table)} where ${filters.join(" and ")} order by ${ordering.join(",")} limit ${end - start + 1} offset ${start}`,
              values,
            );
            return { data: result.rows, error: null };
          } catch (error) {
            return { data: null, error };
          }
        },
      };
      return query;
    },
  } as unknown as SupabaseClient;
}

describe("privileged account data collection", () => {
  it("loads every supported table for a restricted account while excluding other users and storage keys", async () => {
    const snapshot = await collectAccountData(privilegedClient(), {
      id: self,
      email: "self@example.com",
      created_at: "2026-01-01",
    } as User);
    expect(snapshot.records.applications).toHaveLength(1);
    expect(snapshot.records.ai_parser_entitlements).toHaveLength(1);
    expect(snapshot.records.ai_parser_attempt_details).toMatchObject([
      { job_description: "Own posting" },
    ]);
    expect(snapshot.records.profiles).toMatchObject([{ id: self }]);
    expect(snapshot.resumes[0].storage_key).toContain(self);
    const records = JSON.stringify(snapshot.records);
    expect(records).not.toContain(other);
    expect(records).not.toContain("storage_key");
    expect(records).not.toContain("Other private posting");
    expect(Object.keys(snapshot.records)).toHaveLength(25);
  });
});
