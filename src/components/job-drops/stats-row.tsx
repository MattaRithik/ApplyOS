import { StatTile } from "@/components/dashboard/stat-tile";
import type { JobDropsSummary } from "@/lib/data/job-drops";

export function JobDropsStatsRow({ summary }: { summary: JobDropsSummary }) {
  const totalApplied = summary.my.applied + summary.partner.applied;
  const totalNotApplied = summary.my.notApplied + summary.partner.notApplied;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {summary.myName} &amp; {summary.partnerName}
      </p>
      <div className="grid grid-cols-3 gap-3">
        <StatTile compact label="Posted" value={summary.totalPosted} iconName="send" accent="blue" />
        <StatTile compact label="Applied" value={totalApplied} iconName="reply" accent="emerald" />
        <StatTile compact label="Not Applied" value={totalNotApplied} iconName="xCircle" accent="amber" />
      </div>
    </div>
  );
}
