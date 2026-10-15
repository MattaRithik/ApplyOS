import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { buildAccountWorkbook } from "./account-data";

describe("complete account workbook", () => {
  it("preserves long fields in numbered parts without executable spreadsheet formulas", async () => {
    const text = "Long description ".repeat(4000);
    const result = await buildAccountWorkbook({
      createdAt: "2026-10-13",
      resumes: [],
      records: { applications: [{ id: "a", company_name: "=1+1", job_description: text }] },
    });
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(result as unknown as ExcelJS.Buffer);
    const applications = workbook.getWorksheet("applications")!;
    expect(applications.getCell("B2").value).toBe("'=1+1");
    const parts: string[] = [];
    workbook.getWorksheet("Long text")!.eachRow((row, index) => {
      if (index > 1) parts.push(String(row.getCell(5).value));
    });
    expect(parts.join("")).toBe(text);
    expect(parts.every((part) => part.length <= 30000)).toBe(true);
  });
});
