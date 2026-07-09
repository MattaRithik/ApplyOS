"use client";

import * as React from "react";
import Link from "next/link";
import { format, isPast } from "date-fns";
import { CalendarClock, Building2, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassPanel } from "@/components/shared/glass-panel";
import type { InterviewRound } from "@/lib/types/database";

export interface InterviewRow extends InterviewRound {
  application: { id: string; job_title: string; company_name: string } | null;
}

const RESULT_STYLES: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  passed: "bg-[var(--emerald-accent)]/15 text-[var(--emerald-accent)]",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-destructive/10 text-destructive",
};

function InterviewCard({ round }: { round: InterviewRow }) {
  return (
    <Link href={`/applications/${round.application?.id}`}>
      <GlassPanel hoverLift className="flex items-center gap-3 p-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--amber-accent)]/15 text-[var(--amber-accent)]">
          <CalendarClock className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {round.round_name} <span className="text-muted-foreground">· {round.application?.job_title}</span>
          </p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Building2 className="h-3 w-3" /> {round.application?.company_name}
            {round.interviewer_name && (
              <>
                <span>·</span>
                <User className="h-3 w-3" /> {round.interviewer_name}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${RESULT_STYLES[round.result]}`}>{round.result}</span>
          <span className="text-xs text-muted-foreground">
            {round.scheduled_at ? format(new Date(round.scheduled_at), "MMM d, h:mm a") : "TBD"}
          </span>
        </div>
      </GlassPanel>
    </Link>
  );
}

export function InterviewsList({ rounds }: { rounds: InterviewRow[] }) {
  const upcoming = rounds.filter((r) => r.scheduled_at && !isPast(new Date(r.scheduled_at)));
  const past = rounds.filter((r) => !r.scheduled_at || isPast(new Date(r.scheduled_at)));

  return (
    <Tabs defaultValue="upcoming">
      <TabsList>
        <TabsTrigger value="upcoming">Upcoming ({upcoming.length})</TabsTrigger>
        <TabsTrigger value="past">Past ({past.length})</TabsTrigger>
        <TabsTrigger value="all">All ({rounds.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="upcoming" className="mt-4 space-y-2">
        {upcoming.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No upcoming interviews.</p>
        ) : (
          upcoming.map((r) => <InterviewCard key={r.id} round={r} />)
        )}
      </TabsContent>
      <TabsContent value="past" className="mt-4 space-y-2">
        {past.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No past interviews.</p>
        ) : (
          past.map((r) => <InterviewCard key={r.id} round={r} />)
        )}
      </TabsContent>
      <TabsContent value="all" className="mt-4 space-y-2">
        {rounds.map((r) => <InterviewCard key={r.id} round={r} />)}
      </TabsContent>
    </Tabs>
  );
}
