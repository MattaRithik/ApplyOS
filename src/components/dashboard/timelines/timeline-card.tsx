"use client";

import * as React from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/shared/glass-panel";
import { TIMELINE_ICON_OPTIONS, TIMELINE_CATEGORY_OPTIONS, CATEGORY_DEFAULT_ICON, type TimelineIconKey } from "@/lib/timelines/icons";
import { getCountdownLabel, getProgressPercent, formatTargetDate, parseDateOnly, resolveRollingTargetDate } from "@/lib/utils/timeline-date";
import { cn } from "@/lib/utils";
import type { RollingRule, TimelineCategory } from "@/lib/types/database";

export interface TimelineCardData {
  id: string;
  title: string;
  icon: string | null;
  category: TimelineCategory;
  targetDateISO: string | null;
  /** When set, the true target date is resolved client-side from the browser's local "today" instead of trusting `targetDateISO` — see the ResolvedTimeline comment in src/lib/timelines/resolve.ts. */
  rollingRule: RollingRule | null;
  sourceLabel: string;
  supportingText: string | null;
  warningText: string | null;
  isMissingData: boolean;
  createdAtISO: string;
  dashboardSlot: 1 | 2 | 3;
}

/** Recomputed every render from `targetDateISO` using the browser's local clock — never a value cached at fetch time. */
function useToday() {
  const [today, setToday] = React.useState(() => new Date());

  React.useEffect(() => {
    const id = setInterval(() => {
      setToday((prev) => {
        const now = new Date();
        return now.toDateString() === prev.toDateString() ? prev : now;
      });
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  return today;
}

export function TimelineCard({ data, onEdit }: { data: TimelineCardData; onEdit: () => void }) {
  const today = useToday();
  const iconKey = (data.icon && data.icon in TIMELINE_ICON_OPTIONS ? data.icon : CATEGORY_DEFAULT_ICON[data.category]) as TimelineIconKey;
  const Icon = TIMELINE_ICON_OPTIONS[iconKey];
  const categoryLabel = TIMELINE_CATEGORY_OPTIONS.find((c) => c.value === data.category)?.label ?? data.category;

  const targetDate = data.rollingRule
    ? resolveRollingTargetDate(data.rollingRule, today)
    : data.targetDateISO
      ? parseDateOnly(data.targetDateISO)
      : null;
  const countdown = targetDate ? getCountdownLabel(targetDate, today) : null;
  const progressPercent = targetDate ? getProgressPercent(parseDateOnly(data.createdAtISO.slice(0, 10)), targetDate, today) : 0;

  return (
    <GlassPanel hoverLift className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--blue-accent)]/15 text-[var(--blue-accent)]">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data.title}</p>
            <p className="truncate text-[11px] text-muted-foreground">{data.sourceLabel}</p>
          </div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={onEdit} aria-label={`Edit ${data.title}`}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      </div>

      {data.isMissingData || !targetDate || !countdown ? (
        <div className="rounded-lg border border-dashed border-border/60 p-3 text-center">
          <p className="text-xs text-muted-foreground">Add the source date to see a countdown.</p>
        </div>
      ) : (
        <>
          <div>
            <p
              className={cn(
                "text-xl font-semibold tabular-nums tracking-tight",
                countdown.isOverdue && "text-destructive"
              )}
            >
              {countdown.primary}
            </p>
            {countdown.extended && <p className="text-xs text-muted-foreground">{countdown.extended}</p>}
          </div>
          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${progressPercent}% of the way to ${data.title}`}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn("h-full rounded-full transition-all", countdown.isOverdue ? "bg-destructive" : "bg-primary")}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">{formatTargetDate(targetDate)}</p>
        </>
      )}

      {data.supportingText && <p className="text-[11px] leading-relaxed text-muted-foreground">{data.supportingText}</p>}
      {data.warningText && (
        <p className="text-[11px] leading-relaxed text-[var(--amber-accent)]">{data.warningText}</p>
      )}

      <Badge variant="secondary" className="w-fit text-[10px]">{categoryLabel}</Badge>
    </GlassPanel>
  );
}
