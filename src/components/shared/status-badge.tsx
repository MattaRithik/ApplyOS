import { cn } from "@/lib/utils";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types/database";

const STATUS_STYLES: Record<ApplicationStatus, string> = {
  saved: "bg-muted text-muted-foreground border-border",
  planning_to_apply: "bg-[var(--silver-accent)]/15 text-[var(--silver-accent)] border-[var(--silver-accent)]/30",
  applied: "bg-[var(--blue-accent)]/15 text-[var(--blue-accent)] border-[var(--blue-accent)]/30",
  referral_requested: "bg-[var(--cyan-accent)]/15 text-[var(--cyan-accent)] border-[var(--cyan-accent)]/30",
  hr_contacted: "bg-[var(--cyan-accent)]/15 text-[var(--cyan-accent)] border-[var(--cyan-accent)]/30",
  recruiter_screen: "bg-[var(--amber-accent)]/15 text-[var(--amber-accent)] border-[var(--amber-accent)]/30",
  oa_assessment: "bg-[var(--amber-accent)]/15 text-[var(--amber-accent)] border-[var(--amber-accent)]/30",
  first_round: "bg-[var(--amber-accent)]/20 text-[var(--amber-accent)] border-[var(--amber-accent)]/35",
  technical_round: "bg-[var(--amber-accent)]/20 text-[var(--amber-accent)] border-[var(--amber-accent)]/35",
  superday_final_round: "bg-[var(--emerald-accent)]/15 text-[var(--emerald-accent)] border-[var(--emerald-accent)]/30",
  offer: "bg-[var(--emerald-accent)]/25 text-[var(--emerald-accent)] border-[var(--emerald-accent)]/40 font-semibold",
  accepted: "bg-[var(--emerald-accent)]/30 text-[var(--emerald-accent)] border-[var(--emerald-accent)]/50 font-semibold",
  rejected: "bg-destructive/10 text-destructive border-destructive/30",
  withdrawn: "bg-muted text-muted-foreground border-border",
  ghosted: "bg-muted text-muted-foreground/70 border-border border-dashed",
};

export function StatusBadge({ status, className }: { status: ApplicationStatus; className?: string }) {
  const label = APPLICATION_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        STATUS_STYLES[status],
        className
      )}
    >
      {label}
    </span>
  );
}
