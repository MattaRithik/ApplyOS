"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { Briefcase, Send, CalendarClock, User, Building2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FollowUpItem } from "@/lib/data/follow-ups";

const CONTEXT_ICON: Record<FollowUpItem["context"], React.ElementType> = {
  application: Briefcase,
  cold_email: Send,
  interview: CalendarClock,
  contact: User,
};

const CONTEXT_LABEL: Record<FollowUpItem["context"], string> = {
  application: "Application",
  cold_email: "Cold Email",
  interview: "Interview",
  contact: "Contact",
};

function FollowUpRow({ item }: { item: FollowUpItem }) {
  const Icon = CONTEXT_ICON[item.context];
  const today = new Date().toISOString().slice(0, 10);
  const overdue = item.dueDate < today;
  return (
    <Link href={item.link}>
      <div className="flex items-center gap-3 rounded-xl border border-border/40 p-3 transition hover:bg-accent/40">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--cyan-accent)]/15 text-[var(--cyan-accent)]">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{item.title}</p>
          {item.subtitle && <p className="truncate text-xs text-muted-foreground">{item.subtitle}</p>}
        </div>
        <Badge variant="secondary" className="text-[10px]">{CONTEXT_LABEL[item.context]}</Badge>
        <span className={cn("text-xs font-medium tabular-nums", overdue ? "text-destructive" : "text-muted-foreground")}>
          {format(new Date(item.dueDate), "MMM d")}
        </span>
      </div>
    </Link>
  );
}

export function FollowUpCenterClient({ items }: { items: FollowUpItem[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const dueToday = items.filter((i) => i.dueDate === today);
  const overdue = items.filter((i) => i.dueDate < today);
  const upcoming = items.filter((i) => i.dueDate > today);

  const companyGroups = new Map<string, FollowUpItem[]>();
  items.forEach((i) => {
    const key = i.companyName ?? "Unknown";
    companyGroups.set(key, [...(companyGroups.get(key) ?? []), i]);
  });
  const byCompany = [...companyGroups.entries()].sort((a, b) => b[1].length - a[1].length);

  const byContext = new Map<FollowUpItem["context"], FollowUpItem[]>();
  items.forEach((i) => {
    byContext.set(i.context, [...(byContext.get(i.context) ?? []), i]);
  });

  return (
    <Tabs defaultValue="today">
      <TabsList>
        <TabsTrigger value="today">Due Today ({dueToday.length})</TabsTrigger>
        <TabsTrigger value="overdue">Overdue ({overdue.length})</TabsTrigger>
        <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
        <TabsTrigger value="company">By Company</TabsTrigger>
        <TabsTrigger value="type">By Type</TabsTrigger>
      </TabsList>

      <TabsContent value="today" className="mt-4 space-y-2">
        {dueToday.length === 0 ? <EmptyRow text="Nothing due today." /> : dueToday.map((i) => <FollowUpRow key={i.id} item={i} />)}
      </TabsContent>
      <TabsContent value="overdue" className="mt-4 space-y-2">
        {overdue.length === 0 ? <EmptyRow text="No overdue follow-ups." /> : overdue.map((i) => <FollowUpRow key={i.id} item={i} />)}
      </TabsContent>
      <TabsContent value="upcoming" className="mt-4 space-y-2">
        {upcoming.length === 0 ? <EmptyRow text="Nothing upcoming." /> : upcoming.slice(0, 30).map((i) => <FollowUpRow key={i.id} item={i} />)}
      </TabsContent>
      <TabsContent value="company" className="mt-4 space-y-3">
        {byCompany.length === 0 ? (
          <EmptyRow text="No follow-ups yet." />
        ) : (
          byCompany.map(([company, group]) => (
            <GlassPanel key={company} className="p-4">
              <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                <Building2 className="h-3.5 w-3.5" /> {company} ({group.length})
              </h3>
              <div className="space-y-2">
                {group.map((i) => <FollowUpRow key={i.id} item={i} />)}
              </div>
            </GlassPanel>
          ))
        )}
      </TabsContent>
      <TabsContent value="type" className="mt-4 space-y-3">
        {[...byContext.entries()].map(([context, group]) => (
          <GlassPanel key={context} className="p-4">
            <h3 className="mb-2 text-xs font-semibold text-muted-foreground">{CONTEXT_LABEL[context]} ({group.length})</h3>
            <div className="space-y-2">
              {group.map((i) => <FollowUpRow key={i.id} item={i} />)}
            </div>
          </GlassPanel>
        ))}
      </TabsContent>
    </Tabs>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}
