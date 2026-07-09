"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { cn } from "@/lib/utils";
import type { ApplicationWithResume } from "@/components/applications/types";

export function CompanyView({ applications }: { applications: ApplicationWithResume[] }) {
  const grouped = React.useMemo(() => {
    const map = new Map<string, ApplicationWithResume[]>();
    for (const a of applications) {
      const list = map.get(a.company_name) ?? [];
      list.push(a);
      map.set(a.company_name, list);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [applications]);

  const [expanded, setExpanded] = React.useState<Set<string>>(new Set(grouped.slice(0, 3).map(([c]) => c)));

  const toggle = (company: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(company)) next.delete(company);
      else next.add(company);
      return next;
    });

  return (
    <div className="space-y-3">
      {grouped.map(([company, apps]) => {
        const isOpen = expanded.has(company);
        return (
          <GlassPanel key={company} className="overflow-hidden">
            <button
              onClick={() => toggle(company)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{company}</span>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {apps.length}
                </span>
              </div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
            </button>
            {isOpen && (
              <div className="divide-y divide-border/50 border-t border-border/50">
                {apps.map((a) => (
                  <Link
                    key={a.id}
                    href={`/applications/${a.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-accent/40"
                  >
                    <span className="truncate">{a.job_title}</span>
                    <StatusBadge status={a.status} />
                  </Link>
                ))}
              </div>
            )}
          </GlassPanel>
        );
      })}
    </div>
  );
}
