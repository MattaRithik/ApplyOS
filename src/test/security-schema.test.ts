import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const schema = readFileSync(resolve("supabase/schema.sql"), "utf8");
const parserMigration = readFileSync(resolve("supabase/migrations/20260711120000_ai_parser_rewrite.sql"), "utf8");
const adminMigration = readFileSync(resolve("supabase/migrations/20260712090000_admin_authorization.sql"), "utf8");
const hardening = readFileSync(resolve("supabase/migrations/20260712150000_security_hardening.sql"), "utf8");

describe("database security invariants", () => {
  it("enables RLS for every private table in the canonical schema", () => {
    const tables = [
      "profiles", "companies", "resumes", "applications", "application_status_history", "parsed_job_details",
      "ai_parser_usage", "ai_parser_cache", "contacts", "application_contacts", "email_templates", "outreach",
      "interview_rounds", "follow_ups", "notes", "exports", "international_student_profiles", "user_timelines",
      "app_user_roles", "ai_parser_entitlements", "admin_audit_log",
    ];
    for (const table of tables) expect(schema).toContain(`alter table ${table} enable row level security;`);
    expect(`${schema}\n${hardening}`).not.toMatch(/using\s*\(\s*true\s*\)/i);
  });

  it("keeps usage, cache, role, entitlement, and audit tables browser-write-denied", () => {
    expect(parserMigration.toLowerCase()).toContain("select-own only");
    expect(adminMigration).toContain("NO insert/update/delete");
    expect(adminMigration).toContain("RLS with zero policies denies all access");
    expect(hardening).toContain("revoke insert, delete, update on table resumes from authenticated");
  });

  it("makes user-data views honor caller RLS", () => {
    for (const view of ["v_follow_ups_overdue", "v_follow_ups_due_today", "v_outreach_stale"]) {
      expect(hardening).toContain(`alter view if exists ${view} set (security_invoker = true)`);
    }
  });

  it("does not destroy the legacy parser cache during an upgrade", () => {
    expect(parserMigration).not.toMatch(/^\s*drop table if exists job_parse_cache/im);
  });

  it("locks relationship ownership and service-only rate-limit RPCs", () => {
    expect(hardening).toContain("applications_insert_own");
    expect(hardening).toContain("application_contacts_insert");
    expect(hardening).toContain("notes_insert_own");
    expect(hardening).toContain("pg_advisory_xact_lock");
    expect(hardening).toContain("grant execute on function try_consume_api_rate_limit");
    expect(hardening).toContain("admin_mutate_ai_entitlement");
    expect(hardening).toContain("to service_role");
  });
});
