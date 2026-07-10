"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import {
  Sparkles,
  Users,
  FileText,
  Mail,
  CalendarClock,
  ListChecks,
  Send,
  Building2,
  BarChart3,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";

/**
 * Server Components can't pass functions (like a Lucide icon component)
 * as props to a Client Component — React can only serialize plain data
 * across that boundary. So callers pass a string key instead, and the
 * actual icon component is looked up here, inside the client bundle.
 */
const icons = {
  sparkles: Sparkles,
  users: Users,
  fileText: FileText,
  mail: Mail,
  calendarClock: CalendarClock,
  listChecks: ListChecks,
  send: Send,
  building2: Building2,
  barChart3: BarChart3,
} satisfies Record<string, LucideIcon>;

export type EmptyStateIconName = keyof typeof icons;

interface EmptyStateProps {
  iconName: EmptyStateIconName;
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}

export function EmptyState({
  iconName,
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
}: EmptyStateProps) {
  const Icon = icons[iconName];

  return (
    <GlassPanel className="flex flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <motion.span
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="animate-float-slow flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--blue-accent)]/20 via-[var(--cyan-accent)]/20 to-[var(--emerald-accent)]/20 text-[var(--cyan-accent)]"
      >
        <Icon className="h-7 w-7" />
      </motion.span>
      <div className="max-w-sm space-y-1.5">
        <h3 className="text-base font-semibold tracking-tight">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {actionLabel && actionHref && (
        <Button render={<Link href={actionHref} />} className="mt-2 gap-2">
          {actionLabel}
        </Button>
      )}
      {actionLabel && !actionHref && onAction && (
        <Button onClick={onAction} className="mt-2 gap-2">
          {actionLabel}
        </Button>
      )}
    </GlassPanel>
  );
}
