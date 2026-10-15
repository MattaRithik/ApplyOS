import "server-only";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { readAllRows } from "@/lib/supabase/pagination";
import { buildXlsx, type ExportRow } from "./build-file";

// Explicit allowlist: no auth credentials, service configuration, other users'
// shared messages, or administrator audit content is included.
const OWNED_TABLES = [
  "applications",
  "companies",
  "contacts",
  "outreach",
  "interview_rounds",
  "follow_ups",
  "notes",
  "email_templates",
  "resumes",
  "application_status_history",
  "parsed_job_details",
  "international_student_profiles",
  "user_timelines",
  "exports",
  "ai_parser_usage",
  "ai_parser_cache",
  "ai_parser_entitlements",
  "user_presence_history",
  "user_page_visits",
  "download_activity",
  "user_presence",
] as const;

export interface ExportResume {
  id: string;
  original_file_name: string;
  storage_key: string;
  status: string;
  file_size: number | null;
}

export interface AccountSnapshot {
  createdAt: string;
  records: Record<string, ExportRow[]>;
  resumes: ExportResume[];
}

/** Privileged reads always receive the ID from validated auth, never input. */
export async function collectAccountData(db: SupabaseClient, user: User): Promise<AccountSnapshot> {
  const records: Record<string, ExportRow[]> = {};
  const resumes: ExportResume[] = [];
  const profile = await readAllRows<ExportRow>(
    db.from("profiles").select("*").eq("id", user.id).order("id"),
  );
  records.profiles = profile;
  for (let offset = 0; offset < OWNED_TABLES.length; offset += 4) {
    await Promise.all(
      OWNED_TABLES.slice(offset, offset + 4).map(async (table) => {
        const rows = await readAllRows<ExportRow>(
          db
            .from(table)
            .select("*")
            .eq("user_id", user.id)
            .order(
              table === "user_presence"
                ? "session_id"
                : table === "ai_parser_entitlements"
                  ? "user_id"
                  : "id",
            ),
        );
        if (table === "resumes") resumes.push(...(rows as unknown as ExportResume[]));
        records[table] = rows.map((row) => {
          return Object.fromEntries(Object.entries(row).filter(([key]) => key !== "storage_key"));
        });
      }),
    );
  }

  async function readChildren(table: string, column: string, ids: string[]) {
    const rows: ExportRow[] = [];
    for (let offset = 0; offset < ids.length; offset += 100) {
      let query = db
        .from(table)
        .select("*")
        .in(column, ids.slice(offset, offset + 100))
        .order(column);
      if (table === "application_contacts") query = query.order("contact_id");
      rows.push(...(await readAllRows<ExportRow>(query)));
    }
    return rows;
  }
  const [contacts, attempts] = await Promise.all([
    readChildren(
      "application_contacts",
      "application_id",
      records.applications.map((row) => String(row.id)),
    ),
    readChildren(
      "ai_parser_attempt_details",
      "usage_id",
      records.ai_parser_usage.map((row) => String(row.id)),
    ),
  ]);
  records.application_contacts = contacts;
  records.ai_parser_attempt_details = attempts;
  records.account = [
    {
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at,
      email_confirmed_at: user.email_confirmed_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
    },
  ];
  return { createdAt: new Date().toISOString(), records, resumes };
}

/** Large cells are split into traceable parts instead of silently truncated. */
export async function buildAccountWorkbook(snapshot: AccountSnapshot): Promise<Buffer> {
  const longText: ExportRow[] = [];
  const sheets = Object.entries(snapshot.records)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, rows]) => ({
      name,
      rows: rows.map((row, rowIndex) =>
        Object.fromEntries(
          Object.entries(row).map(([column, value]) => {
            const text =
              typeof value === "string"
                ? value
                : value && typeof value === "object"
                  ? JSON.stringify(value)
                  : null;
            if (!text || text.length <= 30_000) return [column, value];
            for (let start = 0; start < text.length; start += 30_000) {
              longText.push({
                sheet: name,
                record_id: row.id ?? row.usage_id ?? rowIndex + 1,
                column,
                part: start / 30_000 + 1,
                text: text.slice(start, start + 30_000),
              });
            }
            return [
              column,
              "Full value is split into numbered parts in the Long text sheet and preserved in records.json.",
            ];
          }),
        ),
      ),
    }));
  if (longText.length) sheets.push({ name: "Long text", rows: longText });
  return buildXlsx(sheets);
}
