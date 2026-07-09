import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildCsv, buildXlsx } from "@/lib/export/build-file";
import { fetchEntityRows, EXPORT_ENTITIES } from "@/lib/export/fetch-entity";
import type { ExportEntity, ExportFormat } from "@/lib/types/database";

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const entity = searchParams.get("entity") as ExportEntity | null;
  const format = (searchParams.get("format") as ExportFormat | null) ?? "xlsx";
  const statusFilter = searchParams.get("status");

  if (!entity) {
    return NextResponse.json({ error: "entity is required" }, { status: 400 });
  }

  let filename = `applyos-${entity}-${new Date().toISOString().slice(0, 10)}`;
  let fileBuffer: Buffer | string;
  let rowCount = 0;

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
    },
  });
}
