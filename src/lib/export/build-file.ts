import ExcelJS from "exceljs";
import Papa from "papaparse";

export type ExportRow = Record<string, unknown>;

/** Prevent CSV/Excel formula execution when user-controlled cells are opened. */
function neutralizeSpreadsheetFormula(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

function normalize(row: ExportRow): ExportRow {
  const out: ExportRow = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) out[key] = "";
    else if (Array.isArray(value)) out[key] = value.join(", ");
    else if (typeof value === "object") out[key] = JSON.stringify(value);
    else if (typeof value === "string") out[key] = neutralizeSpreadsheetFormula(value);
    else out[key] = value;
  }
  return out;
}

export function buildCsv(rows: ExportRow[]): string {
  const normalized = rows.map(normalize);
  return Papa.unparse(normalized);
}

export async function buildXlsx(sheets: { name: string; rows: ExportRow[] }[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ApplyOS";
  workbook.created = new Date();

  for (const sheet of sheets) {
    const normalized = sheet.rows.map(normalize);
    const worksheet = workbook.addWorksheet(sheet.name.slice(0, 31) || "Sheet");
    if (normalized.length === 0) continue;

    const columns = Object.keys(normalized[0]);
    worksheet.columns = columns.map((key) => ({ header: key, key, width: 22 }));
    worksheet.getRow(1).font = { bold: true };
    normalized.forEach((row) => worksheet.addRow(row));
    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  }

  if (workbook.worksheets.length === 0) workbook.addWorksheet("Sheet1");

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
}
