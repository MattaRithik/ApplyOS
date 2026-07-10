"use client";

import { motion } from "framer-motion";
import {
  Briefcase,
  Flame,
  XCircle,
  Trophy,
  CalendarClock,
  ListChecks,
  Send,
  Reply,
  TrendingUp,
  Timer,
  Percent,
  Ghost,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "@/components/shared/glass-panel";

/**
 * Server Components can't pass functions (like a Lucide icon component)
 * as props to a Client Component — React can only serialize plain data
 * across that boundary. So callers pass a string key instead, and the
 * actual icon component is looked up here, inside the client bundle.
 */
const icons = {
  briefcase: Briefcase,
  flame: Flame,
  xCircle: XCircle,
  trophy: Trophy,
  calendarClock: CalendarClock,
  listChecks: ListChecks,
  send: Send,
  reply: Reply,
  trendingUp: TrendingUp,
  timer: Timer,
  percent: Percent,
  ghost: Ghost,
} satisfies Record<string, LucideIcon>;

export type StatTileIconName = keyof typeof icons;

interface StatTileProps {
  label: string;
  value: string | number;
  iconName: StatTileIconName;
  accent?: "blue" | "cyan" | "emerald" | "amber" | "silver";
  hint?: string;
  delay?: number;
  compact?: boolean;
}

const accentClasses: Record<NonNullable<StatTileProps["accent"]>, string> = {
  blue: "from-[var(--blue-accent)]/25 to-[var(--blue-accent)]/5 text-[var(--blue-accent)]",
  cyan: "from-[var(--cyan-accent)]/25 to-[var(--cyan-accent)]/5 text-[var(--cyan-accent)]",
  emerald: "from-[var(--emerald-accent)]/25 to-[var(--emerald-accent)]/5 text-[var(--emerald-accent)]",
  amber: "from-[var(--amber-accent)]/25 to-[var(--amber-accent)]/5 text-[var(--amber-accent)]",
  silver: "from-[var(--silver-accent)]/25 to-[var(--silver-accent)]/5 text-[var(--silver-accent)]",
};

export function StatTile({ label, value, iconName, accent = "blue", hint, delay = 0, compact = false }: StatTileProps) {
  const Icon = icons[iconName];

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      <GlassPanel hoverLift className={cn(compact ? "h-full p-3" : "flex items-center gap-4 p-4")}>
        <div className={cn(compact && "flex items-center gap-2.5")}>
          <span
            className={cn(
              "flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br",
              compact ? "h-9 w-9" : "h-11 w-11",
              accentClasses[accent]
            )}
          >
            <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
          </span>
          {compact && <p className="text-lg font-semibold tracking-tight tabular-nums">{value}</p>}
        </div>
        <div className={cn("min-w-0", compact && "mt-2")}>
          {!compact && <p className="text-xl font-semibold tracking-tight tabular-nums">{value}</p>}
          <p className={cn("text-muted-foreground", compact ? "text-[11px] leading-tight" : "truncate text-xs")}>{label}</p>
          {hint && <p className={cn("text-[11px] text-muted-foreground/70", !compact && "truncate")}>{hint}</p>}
        </div>
      </GlassPanel>
    </motion.div>
  );
}
