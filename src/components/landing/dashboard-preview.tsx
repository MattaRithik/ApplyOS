import { Building2, Briefcase, CalendarClock, Trophy } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { VisaSponsorshipBadge } from "@/components/shared/visa-sponsorship-badge";
import { StatTile } from "@/components/dashboard/stat-tile";
import type { ApplicationStatus, VisaSponsorshipStatus } from "@/lib/types/database";

interface PreviewRow {
  company: string;
  role: string;
  status: ApplicationStatus;
  visa: VisaSponsorshipStatus;
}

const PREVIEW_ROWS: PreviewRow[] = [
  { company: "Jane Street", role: "Quantitative Researcher", status: "technical_round", visa: "opt_accepted" },
  { company: "Citadel Securities", role: "Quantitative Trader", status: "applied", visa: "future_possible" },
  { company: "Goldman Sachs", role: "Investment Analyst", status: "offer", visa: "h1b_available" },
  { company: "BlackRock", role: "Risk Analyst", status: "recruiter_screen", visa: "h1b_available" },
  { company: "JPMorgan", role: "Market Risk Analyst", status: "oa_assessment", visa: "requires_existing_auth" },
  { company: "Bloomberg", role: "Financial Data Engineer", status: "first_round", visa: "opt_accepted" },
];

/**
 * Static, illustrative dashboard preview — built from the same components
 * that render the real dashboard/applications table, not a screenshot. No
 * network calls, no real data; every row is a hand-picked finance/quant
 * example so it reads as "this is what ApplyOS looks like" rather than a
 * generic SaaS mockup.
 */
export function DashboardPreview() {
  return (
    <GlassPanel strong className="glow-cyan overflow-hidden p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--amber-accent)]/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-[var(--emerald-accent)]/60" />
        </div>
        <p className="text-[11px] font-medium text-muted-foreground">ApplyOS · Dashboard</p>
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatTile compact label="Applications" value={42} iconName="briefcase" accent="blue" delay={0} />
        <StatTile compact label="Interviews" value={5} iconName="calendarClock" accent="amber" delay={0.04} />
        <StatTile compact label="Offers" value={2} iconName="trophy" accent="emerald" delay={0.08} />
        <StatTile compact label="Reply Rate" value="38%" iconName="reply" accent="cyan" delay={0.12} />
      </div>

      <div className="mt-4 space-y-1.5">
        {PREVIEW_ROWS.map((row) => (
          <div
            key={row.company}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border/40 bg-background/40 px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--blue-accent)]/15 text-[var(--blue-accent)]">
                <Building2 className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{row.role}</p>
                <p className="truncate text-xs text-muted-foreground">{row.company}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <VisaSponsorshipBadge status={row.visa} />
              <StatusBadge status={row.status} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5"><Briefcase className="h-3 w-3" /> 6 active pipelines</span>
        <span className="flex items-center gap-1.5"><CalendarClock className="h-3 w-3" /> 2 interviews this week</span>
        <span className="flex items-center gap-1.5"><Trophy className="h-3 w-3" /> Best resume: 61% interview rate</span>
      </div>
    </GlassPanel>
  );
}
