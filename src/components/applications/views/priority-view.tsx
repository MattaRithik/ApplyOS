"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { ApplicationWithResume } from "@/components/applications/types";

export function PriorityView({ applications }: { applications: ApplicationWithResume[] }) {
  const sorted = [...applications].sort((a, b) => b.priority_score - a.priority_score);

  return (
    <div className="space-y-2">
      {sorted.map((a, i) => (
        <GlassPanel key={a.id} hoverLift className="flex items-center gap-4 p-3.5">
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
              i < 3 ? "bg-[var(--amber-accent)]/20 text-[var(--amber-accent)]" : "bg-muted text-muted-foreground"
            )}
          >
            {i < 3 ? <Flame className="h-4 w-4" /> : i + 1}
          </span>
          <Link href={`/applications/${a.id}`} className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium hover:text-primary hover:underline">{a.job_title}</p>
            <p className="truncate text-xs text-muted-foreground">{a.company_name}</p>
          </Link>
          <StatusBadge status={a.status} className="hidden sm:inline-flex" />
          <div className="flex w-32 items-center gap-2">
            <Progress value={a.priority_score} className="h-1.5" />
            <span className="w-7 text-right text-xs tabular-nums text-muted-foreground">{a.priority_score}</span>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
