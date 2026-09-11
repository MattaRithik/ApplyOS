import { Send, Reply, XCircle } from "lucide-react";
import type { JobDropsSummary } from "@/lib/data/job-drops";

export function JobDropsStatsRow({ summary }: { summary: JobDropsSummary }) {
  const totalApplied = summary.my.applied + summary.partner.applied;
  const totalNotApplied = summary.my.notApplied + summary.partner.notApplied;

  return (
    <dl aria-label="Job Drops totals" className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:pt-1.5">
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <Send aria-hidden="true" className="h-3.5 w-3.5 text-[var(--blue-accent)]" />
          Posted
        </dt>
        <dd className="font-semibold tabular-nums">{summary.totalPosted}</dd>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <Reply aria-hidden="true" className="h-3.5 w-3.5 text-[var(--emerald-accent)]" />
          Applied
        </dt>
        <dd className="font-semibold tabular-nums">{totalApplied}</dd>
      </div>
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        <dt className="flex items-center gap-1.5 text-muted-foreground">
          <XCircle aria-hidden="true" className="h-3.5 w-3.5 text-[var(--amber-accent)]" />
          Not Applied
        </dt>
        <dd className="font-semibold tabular-nums">{totalNotApplied}</dd>
      </div>
    </dl>
  );
}
