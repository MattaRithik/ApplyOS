/** Read saved results without narrowing them to today's schema or dropping unknown fields. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function unwrapParsedReport(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) return { result: value };
  if (!isRecord(value.result)) return value;
  const { result, ...rest } = value;
  return { ...result, ...Object.fromEntries(Object.entries(rest).filter(([key]) => !(key in result))) };
}

export function fieldLabel(key: string): string {
  return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_.]/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export function displayParsedValue(value: unknown): string {
  if (value == null || value === "") return "Not mentioned";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(displayParsedValue).join("\n") : "None listed";
  if (isRecord(value)) return JSON.stringify(value, null, 2);
  return String(value).replace(/^(not_mentioned|unknown)$/, (v) => v === "unknown" ? "Unknown" : "Not mentioned");
}

export interface ReportField { path: string; label: string; value: unknown }
export interface ReportSection { key: string; label: string; fields: ReportField[] }
const LABELS: Record<string, string> = {
  identity: "Company & role", location: "Location & work arrangement", employment: "Employment",
  priorityMatch: "Target-role match & priority",
  compensation: "Compensation", skills: "Skills & keywords", experienceEducation: "Experience & education",
  roleContent: "Responsibilities & job details", immigration: "Sponsorship & work authorization",
  quantRelevance: "AI relevance scores", metadata: "Warnings & extraction notes",
  provenance: "Field sources & evidence", parseMeta: "Parsing information",
};

export function buildReportSections(input: unknown): ReportSection[] {
  const report = unwrapParsedReport(input);
  const flatten = (value: unknown, path: string, label: string): ReportField[] => {
    if (isRecord(value) && Object.keys(value).length) {
      return Object.entries(value).flatMap(([key, child]) => flatten(child, `${path}.${key}`, `${label} · ${fieldLabel(key)}`));
    }
    return [{ path, label, value }];
  };
  return Object.entries(report).map(([key, value]) => ({
    key, label: LABELS[key] ?? fieldLabel(key),
    fields: isRecord(value) && Object.keys(value).length
      ? Object.entries(value).flatMap(([field, child]) => flatten(child, `${key}.${field}`, fieldLabel(field)))
      : [{ path: key, label: LABELS[key] ?? fieldLabel(key), value }],
  }));
}
