import { describe, expect, it } from "vitest";
import { buildReportSections, displayParsedValue, unwrapParsedReport } from "./report";

describe("complete parsed report", () => {
  it("retains every field beyond the current schema, without a fixed field limit", () => {
    const fields = Object.fromEntries(Array.from({ length: 150 }, (_, i) => [`futureField${i}`, `Value ${i}`]));
    const sections = buildReportSections({ futureGroup: fields });
    expect(sections[0].fields).toHaveLength(150);
    expect(sections[0].fields[149]).toMatchObject({ path: "futureGroup.futureField149", value: "Value 149" });
  });
  it("unwraps saved snapshots and preserves separately stored provenance", () => {
    const provenance = { "identity.companyName": { evidence: "Example company", status: "explicit" } };
    const snapshot = { result: { identity: { companyName: "Example" } }, provenance };
    expect(unwrapParsedReport(snapshot)).toEqual({ identity: { companyName: "Example" }, provenance });
    expect(buildReportSections(snapshot).flatMap(s => s.fields).some(f => f.value === "Example company")).toBe(true);
  });
  it("keeps missing values, zero scores, false flags, and empty lists visible", () => {
    const fields = buildReportSections({ group: { missing: null, score: 0, flag: false, list: [] } })[0].fields;
    expect(fields.map(f => displayParsedValue(f.value))).toEqual(["Not mentioned", "0", "No", "None listed"]);
  });
  it("preserves nested future fields and all object-array evidence", () => {
    const evidence = [{ field: "compensation.salaryMinimum", note: "A complete exact quote" }, { field: "location.city", note: "London" }];
    const sections = buildReportSections({ custom: { nested: { additional: "retained" } }, metadata: { evidence } });
    expect(sections[0].fields[0]).toMatchObject({ path: "custom.nested.additional", value: "retained" });
    expect(displayParsedValue(sections[1].fields[0].value)).toContain("A complete exact quote");
    expect(displayParsedValue(sections[1].fields[0].value)).toContain("London");
  });
  it("does not truncate long descriptions or skill lists", () => {
    const value = "Long content ".repeat(1000);
    expect(displayParsedValue(value)).toBe(value);
    const skills = Array.from({ length: 100 }, (_, i) => `Skill ${i}`);
    expect(displayParsedValue(skills)).toContain("Skill 99");
  });
  it("supports flat legacy records without requiring today's AI schema", () => {
    const sections = buildReportSections({ parsed_company: "Legacy company", required_skills: ["SQL"], warnings: [] });
    expect(sections).toHaveLength(3);
    expect(sections[0].fields[0].value).toBe("Legacy company");
  });
});
