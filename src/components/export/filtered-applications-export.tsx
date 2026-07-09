"use client";

import * as React from "react";
import { Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { GlassPanel } from "@/components/shared/glass-panel";
import { APPLICATION_STATUSES } from "@/lib/types/database";

export function FilteredApplicationsExport() {
  const [status, setStatus] = React.useState<string>(APPLICATION_STATUSES[0].value);

  return (
    <GlassPanel className="flex flex-wrap items-center justify-between gap-4 p-5">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--cyan-accent)]/15 text-[var(--cyan-accent)]">
          <Filter className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold">Filtered export</p>
          <p className="text-xs text-muted-foreground">Export applications by status only.</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Select value={status} onValueChange={(v) => setStatus(v ?? status)}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {APPLICATION_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          className="gap-1.5"
          render={<a href={`/api/export?entity=applications&format=xlsx&status=${status}`} />}
        >
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
      </div>
    </GlassPanel>
  );
}
