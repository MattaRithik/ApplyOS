"use client";

import * as React from "react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { ParsedFieldsReview } from "@/components/applications/parser/parsed-fields-review";
import type { ParsedJobDetails } from "@/lib/types/database";

export function SavedParsedDetails({ reports, loadFailed }: { reports: ParsedJobDetails[]; loadFailed: boolean }) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const selectId = React.useId();
  const report = reports.find((row) => row.id === selectedId) ?? reports[0];
  if (loadFailed) return <GlassPanel className="p-5"><h2 className="font-semibold">Parsed job details</h2><p role="alert" className="mt-2 text-sm text-muted-foreground">Saved parsing results could not be loaded. Refresh the page to try again.</p></GlassPanel>;
  if (!report) return <GlassPanel className="p-5"><h2 className="font-semibold">Parsed job details</h2><p className="mt-2 text-sm text-muted-foreground">No saved parsing result for this application. Parse a posting in Edit → AI Parser, then save your changes to keep the full report here.</p></GlassPanel>;
  const legacy = !report.full_result;
  const legacyFields = Object.fromEntries(Object.entries(report).filter(([key]) => !["id", "user_id", "application_id", "full_result"].includes(key)));
  return (
    <GlassPanel className="space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 className="text-lg font-semibold">Parsed job details</h2><p className="mt-1 text-sm text-muted-foreground">The complete saved extraction, including fields that were not copied to your application form.</p></div>
        <div className="min-w-0 max-w-full space-y-1">
          <label htmlFor={selectId} className="block text-xs text-muted-foreground">Saved parse</label>
          <select id={selectId} value={report.id} onChange={(e) => setSelectedId(e.target.value)} className="max-w-full rounded-lg border border-input bg-background px-3 py-2 text-sm">
            {reports.map((row, i) => <option key={row.id} value={row.id}>{i === 0 ? "Latest · " : ""}{row.created_at.replace("T", " ").slice(0, 19)} UTC</option>)}
          </select>
        </div>
      </div>
      {legacy && <p className="rounded-lg border border-border p-3 text-xs text-muted-foreground">This older parse does not contain a full extraction snapshot. All details stored for it are shown below.</p>}
      <ParsedFieldsReview key={report.id} result={report.full_result ?? { savedDetails: legacyFields }} />
      {report.raw_job_description && <details className="border-t border-border/50 pt-3 text-sm"><summary className="cursor-pointer font-medium">Saved job description</summary><p className="mt-3 whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">{report.raw_job_description}</p></details>}
    </GlassPanel>
  );
}
