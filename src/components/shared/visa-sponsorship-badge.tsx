import { cn } from "@/lib/utils";
import { VISA_SPONSORSHIP_STATUSES, type VisaSponsorshipStatus } from "@/lib/types/database";

const VISA_STYLES: Record<VisaSponsorshipStatus, string> = {
  no_sponsorship: "bg-destructive/10 text-destructive border-destructive/30",
  opt_accepted: "bg-[var(--cyan-accent)]/15 text-[var(--cyan-accent)] border-[var(--cyan-accent)]/30",
  cpt_accepted: "bg-[var(--cyan-accent)]/15 text-[var(--cyan-accent)] border-[var(--cyan-accent)]/30",
  h1b_available: "bg-[var(--emerald-accent)]/20 text-[var(--emerald-accent)] border-[var(--emerald-accent)]/35 font-semibold",
  future_possible: "bg-[var(--amber-accent)]/15 text-[var(--amber-accent)] border-[var(--amber-accent)]/30",
  requires_existing_auth: "bg-muted text-muted-foreground border-border",
  not_mentioned: "bg-muted text-muted-foreground/70 border-border border-dashed",
};

export function VisaSponsorshipBadge({ status, className }: { status: VisaSponsorshipStatus; className?: string }) {
  const label = VISA_SPONSORSHIP_STATUSES.find((s) => s.value === status)?.label ?? status;
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
        VISA_STYLES[status],
        className
      )}
    >
      {label}
    </span>
  );
}
