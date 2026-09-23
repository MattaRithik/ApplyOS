"use client";

import { compensationLabel } from "@/lib/utils/compensation-label";
import * as React from "react";
import { ChevronDown, Copy, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { buildReportSections, displayParsedValue, isRecord, unwrapParsedReport } from "@/lib/ai-parser/report";

const SOURCE_LABELS: Record<string, string> = {
  explicit: "Found in posting", normalized: "Formatted from posting", inferred: "AI inference",
  uncertain: "Needs review", missing: "Not mentioned",
};

export function ParsedFieldsReview({ result, safePaths }: { result: unknown; safePaths?: ReadonlySet<string> }) {
  const [search, setSearch] = React.useState("");
  const [expanded, setExpanded] = React.useState(new Set(["identity", "location", "compensation", "immigration", "priorityMatch"]));
  const sections = React.useMemo(() => buildReportSections(result), [result]);
  const report = unwrapParsedReport(result);
  const isStipend = isRecord(report.compensation) && typeof report.compensation.compensationText === "string" && compensationLabel(report.compensation.compensationText) === "Stipend";
  const provenance = isRecord(report.provenance) ? report.provenance : {};
  const query = search.trim().toLowerCase();
  const visible = sections.map((section) => ({ ...section, fields: section.fields.filter((field) =>
    !query || `${section.label} ${field.label} ${field.path} ${displayParsedValue(field.value)}`.toLowerCase().includes(query)
  ) })).filter((section) => section.fields.length);
  const count = sections.filter((s) => !["metadata", "provenance", "parseMeta"].includes(s.key)).reduce((n, s) => n + s.fields.length, 0);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{count} fields · all values available, including missing details</p>
        <div className="flex gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(new Set(sections.map((s) => s.key)))}>Expand all</Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(new Set())}>Collapse all</Button>
        </div>
      </div>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
        <Input className="h-10 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find a field or value…" aria-label="Search all parsed details" />
      </div>
      {visible.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">No matching details. Try another search.</p>}
      {visible.map((section) => {
        const open = !!query || expanded.has(section.key);
        return (
          <section key={section.key} className="overflow-hidden rounded-xl border border-border/60">
            <button type="button" className="flex w-full items-center justify-between gap-3 bg-muted/20 px-4 py-3 text-left" aria-expanded={open}
              onClick={() => setExpanded((current) => { const next = new Set(current); if (next.has(section.key)) next.delete(section.key); else next.add(section.key); return next; })}>
              <span className="text-sm font-medium">{section.label}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">{section.fields.length}<ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} /></span>
            </button>
            {open && <div className="divide-y divide-border/40">
              {section.key === "priorityMatch" && <p className="px-4 py-3 text-xs text-muted-foreground">Suggested follow-up priority based on your target roles. This is an AI estimate; you can adjust the application’s score.</p>}
              {section.key === "quantRelevance" && <p className="px-4 py-3 text-xs text-muted-foreground">These scores are AI opinions, not facts or requirements from the employer.</p>}
              {section.fields.map((field) => {
                const fieldSource = provenance[field.path];
                const source = isRecord(fieldSource) ? fieldSource : null;
                const fillsForm = safePaths?.has(field.path) || (safePaths?.has("__recruiterContact") && ["identity.recruiterName", "identity.recruiterEmail"].includes(field.path));
                return (
                  <div key={field.path} className="grid gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] sm:gap-4">
                    <div className="min-w-0"><p className="break-words text-xs font-medium text-muted-foreground">{isStipend && section.key === "compensation" ? field.label.replace(/^Salary/, "Stipend") : field.label}</p>
                      {fillsForm && <p className="mt-1 text-[11px] font-medium text-primary">Fills form</p>}
                      {source && typeof source.status === "string" && <p className="mt-1 text-[11px] text-muted-foreground">{SOURCE_LABELS[source.status] ?? source.status}</p>}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-start gap-2">
                        <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{displayParsedValue(field.value)}</p>
                        <Button type="button" variant="ghost" size="icon-xs" aria-label={`Copy ${field.label}`} onClick={() => navigator.clipboard.writeText(displayParsedValue(field.value)).then(() => toast.success("Copied.")).catch(() => toast.error("Unable to copy. Select the text to copy it manually."))}><Copy className="size-3" /></Button>
                      </div>
                      {source && typeof source.evidence === "string" && source.evidence && <details className="mt-2 text-xs text-muted-foreground"><summary className="cursor-pointer text-primary">View source text</summary><blockquote className="mt-2 whitespace-pre-wrap border-l-2 border-primary/30 pl-3 [overflow-wrap:anywhere]">{source.evidence}</blockquote></details>}
                    </div>
                  </div>
                );
              })}
            </div>}
          </section>
        );
      })}
      <details className="text-xs text-muted-foreground">
        <summary className="cursor-pointer py-2">Complete original result (JSON)</summary>
        <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-muted/30 p-3 [overflow-wrap:anywhere]">{JSON.stringify(result, null, 2)}</pre>
      </details>
    </div>
  );
}
