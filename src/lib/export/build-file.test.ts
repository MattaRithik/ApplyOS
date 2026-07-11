import { describe, expect, it } from "vitest";
import { buildCsv, buildXlsx } from "@/lib/export/build-file";
import ExcelJS from "exceljs";

describe("spreadsheet export hardening", () => {
  it("neutralizes formula-prefixed CSV cells", () => {
    const csv = buildCsv([{ name: "=HYPERLINK(\"https://attacker.example\")", safe: "ordinary" }]);
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("ordinary");
  });

  it("stores formula-prefixed XLSX values as inert strings", async () => {
    const buffer = await buildXlsx([{ name: "Applications", rows: [{ company: "+cmd|' /C calc'!A0" }] }]);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    expect(workbook.getWorksheet("Applications")?.getCell("A2").value).toBe("'+cmd|' /C calc'!A0");
  });
});
