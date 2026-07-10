"use client";

import * as React from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { cn } from "@/lib/utils";
import type { ApplicationWithResume } from "@/components/applications/types";

export function CalendarView({ applications }: { applications: ApplicationWithResume[] }) {
  const [month, setMonth] = React.useState(new Date());

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [month]);

  const byDate = React.useMemo(() => {
    const map = new Map<string, { app: ApplicationWithResume; kind: "applied" | "follow_up" }[]>();
    for (const a of applications) {
      if (a.date_applied) {
        const list = map.get(a.date_applied) ?? [];
        list.push({ app: a, kind: "applied" });
        map.set(a.date_applied, list);
      }
      if (a.follow_up_date) {
        const list = map.get(a.follow_up_date) ?? [];
        list.push({ app: a, kind: "follow_up" });
        map.set(a.follow_up_date, list);
      }
    }
    return map;
  }, [applications]);

  return (
    <GlassPanel className="p-4">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{format(month, "MMMM yyyy")}</h3>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => subMonths(m, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="text-xs" onClick={() => setMonth(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="icon-sm" onClick={() => setMonth((m) => addMonths(m, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-medium text-muted-foreground sm:gap-1 sm:text-[11px]">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div key={d} className="py-1.5">
            <span className="sm:hidden">{d.slice(0, 1)}</span>
            <span className="hidden sm:inline">{d}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const events = byDate.get(key) ?? [];
          const maxEvents = 2;
          return (
            <div
              key={key}
              className={cn(
                "min-h-[56px] rounded-lg border border-border/40 p-1 text-left align-top sm:min-h-[86px] sm:p-1.5",
                !isSameMonth(day, month) && "opacity-40",
                isToday(day) && "border-[var(--cyan-accent)]/60 bg-[var(--cyan-accent)]/5"
              )}
            >
              <span className="text-[10px] text-muted-foreground sm:text-[11px]">{format(day, "d")}</span>
              <div className="mt-1 space-y-1">
                {events.slice(0, maxEvents).map((e, i) => (
                  <Link
                    key={i}
                    href={`/applications/${e.app.id}`}
                    className={cn(
                      "block truncate rounded px-1 py-0.5 text-[9px] font-medium sm:text-[10px]",
                      e.kind === "applied"
                        ? "bg-[var(--blue-accent)]/15 text-[var(--blue-accent)]"
                        : "bg-[var(--amber-accent)]/15 text-[var(--amber-accent)]"
                    )}
                    title={`${e.app.job_title} · ${e.app.company_name}`}
                  >
                    {e.kind === "follow_up" ? "↻ " : ""}
                    {e.app.company_name}
                  </Link>
                ))}
                {events.length > maxEvents && (
                  <span className="block text-[9px] text-muted-foreground sm:text-[10px]">+{events.length - maxEvents} more</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
}
