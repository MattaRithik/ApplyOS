import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { buildCsv, buildXlsx } from "@/lib/export/build-file";
import { fetchEntityRows, EXPORT_ENTITIES } from "@/lib/export/fetch-entity";
import type { ExportEntity, ExportFormat } from "@/lib/types/database";
import { APPLICATION_STATUSES } from "@/lib/types/database";

const exportEntitySchema = z.enum([
  "applications",
  "companies",
  "contacts",
  "outreach",
  "interviews",
  "follow_ups",
  "resumes",
  "international_profile",
  "full_backup",
]);
const exportFormatSchema = z.enum(["xlsx", "csv"]);
const applicationStatusSchema = z.enum(APPLICATION_STATUSES.map((status) => status.value));

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const entityResult = exportEntitySchema.safeParse(searchParams.get("entity"));
  const formatResult = exportFormatSchema.safeParse(searchParams.get("format") ?? "xlsx");
  const rawStatus = searchParams.get("status");
  const statusResult = rawStatus === null ? null : applicationStatusSchema.safeParse(rawStatus);
  if (!entityResult.success || !formatResult.success || (statusResult && !statusResult.success)) {
    return NextResponse.json({ error: "Invalid export parameters." }, { status: 400 });
  }
  const entity: ExportEntity = entityResult.data;
  const format: ExportFormat = formatResult.data;
  const statusFilter = statusResult?.data ?? null;
  if (statusFilter && entity !== "applications") {
    return NextResponse.json({ error: "Status filtering is only supported for applications." }, { status: 400 });
  }

  let filename = `applyos-${entity}-${new Date().toISOString().slice(0, 10)}`;
  let fileBuffer: Buffer | string;
  let rowCount = 0;

  try {
    if (entity === "full_backup") {
      const sheets = await Promise.all(
        EXPORT_ENTITIES.map(async (e) => ({
          name: e.label,
          rows: await fetchEntityRows(supabase, user.id, e.value),
        }))
      );
      rowCount = sheets.reduce((sum, s) => sum + s.rows.length, 0);
      fileBuffer = await buildXlsx(sheets);
      filename = `applyos-full-backup-${new Date().toISOString().slice(0, 10)}`;
    } else {
      let rows = await fetchEntityRows(supabase, user.id, entity);
      if (statusFilter && entity === "applications") {
        rows = rows.filter((r) => (r as { status?: string }).status === statusFilter);
        filename += `-${statusFilter}`;
      }
      rowCount = rows.length;
      fileBuffer = format === "csv" ? buildCsv(rows) : await buildXlsx([{ name: entity, rows }]);
    }
  } catch {
    return NextResponse.json({ error: "Failed to build the export." }, { status: 500 });
  }

  await supabase.from("exports").insert({
    user_id: user.id,
    entity,
    format: entity === "full_backup" ? "xlsx" : format,
    filters: statusFilter ? { status: statusFilter } : {},
    row_count: rowCount,
  });

  const extension = entity === "full_backup" ? "xlsx" : format;
  const contentType =
    extension === "csv"
      ? "text/csv; charset=utf-8"
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return new NextResponse(fileBuffer as BodyInit, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}.${extension}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
