"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarRange, Plus } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { TimelineCard, type TimelineCardData } from "@/components/dashboard/timelines/timeline-card";
import { TimelineSlotPicker } from "@/components/timelines/timeline-slot-picker";
import type { InternationalStudentProfile, UserTimeline } from "@/lib/types/database";

interface ImportantTimelinesSectionProps {
  cards: TimelineCardData[];
  slotTimelines: Partial<Record<1 | 2 | 3, UserTimeline>>;
  isInternational: boolean;
  internationalProfile: InternationalStudentProfile | null;
}

const OPEN_SLOT_PRIORITY: (1 | 2 | 3)[] = [3, 2, 1];

export function ImportantTimelinesSection({
  cards,
  slotTimelines,
  isInternational,
  internationalProfile,
}: ImportantTimelinesSectionProps) {
  const router = useRouter();
  const [editingSlot, setEditingSlot] = React.useState<1 | 2 | 3 | null>(null);

  const handleEdit = (card: TimelineCardData) => {
    if (card.dashboardSlot === 1 && isInternational) {
      router.push("/settings");
      return;
    }
    setEditingSlot(card.dashboardSlot);
  };

  const nextOpenSlot = OPEN_SLOT_PRIORITY.find((s) => !slotTimelines[s]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarRange className="h-4 w-4 text-[var(--blue-accent)]" /> Important Timelines
        </h2>
        {cards.length < 3 && nextOpenSlot && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditingSlot(nextOpenSlot)}>
            <Plus className="h-3.5 w-3.5" /> Add timeline
          </Button>
        )}
      </div>

      {cards.length === 0 ? (
        <GlassPanel className="p-5 text-center">
          <p className="text-sm text-muted-foreground">
            Pin up to 3 countdowns for graduation, interviews, or personal milestones.
          </p>
          <Button
            size="sm"
            className="mt-3 gap-1.5"
            onClick={() => setEditingSlot(nextOpenSlot ?? 3)}
          >
            <Plus className="h-3.5 w-3.5" /> Add your first timeline
          </Button>
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cards.map((card) => (
            <TimelineCard key={card.id} data={card} onEdit={() => handleEdit(card)} />
          ))}
        </div>
      )}

      <Dialog open={editingSlot !== null} onOpenChange={(o) => !o && setEditingSlot(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dashboard timeline</DialogTitle>
            <DialogDescription>Choose what appears in this slot. You can change it again anytime.</DialogDescription>
          </DialogHeader>
          {editingSlot && (
            <TimelineSlotPicker
              slot={editingSlot}
              isInternational={isInternational}
              internationalProfile={internationalProfile}
              current={slotTimelines[editingSlot] ?? null}
              onSaved={() => {
                setEditingSlot(null);
                router.refresh();
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
