"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { getTimelineIcon } from "@/lib/timelines/icons";
import { deleteTimeline, pinTimelineToSlot } from "@/lib/actions/timelines";
import type { UserTimeline } from "@/lib/types/database";

/** Custom countdowns the user saved but didn't pin to one of the 3 dashboard slots. */
export function SavedTimelinesList({ timelines }: { timelines: UserTimeline[] }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);
  const [pinningId, setPinningId] = React.useState<string | null>(null);

  const unpinned = timelines.filter((t) => !t.is_pinned);
  const deletingTimeline = unpinned.find((t) => t.id === deletingId) ?? null;

  if (unpinned.length === 0) return null;

  const handlePin = async (id: string, slot: 1 | 2 | 3) => {
    setPinningId(id);
    try {
      await pinTimelineToSlot(id, slot);
      toast.success(`Pinned to slot ${slot}.`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't pin this timeline");
    } finally {
      setPinningId(null);
    }
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Other saved countdowns</p>
      <div className="space-y-1.5">
        {unpinned.map((t) => {
          const Icon = getTimelineIcon(t.icon, t.category);
          return (
            <div key={t.id} className="flex items-center justify-between gap-2 rounded-lg border border-border/50 p-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{t.title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                {([1, 2, 3] as const).map((slot) => (
                  <Button
                    key={slot}
                    variant="outline"
                    size="icon-xs"
                    disabled={pinningId === t.id}
                    onClick={() => handlePin(t.id, slot)}
                    aria-label={`Pin to slot ${slot}`}
                    title={`Pin to slot ${slot}`}
                  >
                    {slot}
                  </Button>
                ))}
                <Button variant="ghost" size="icon-xs" onClick={() => setDeletingId(t.id)} aria-label={`Delete ${t.title}`}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <ConfirmDeleteDialog
        open={deletingId !== null}
        onOpenChange={(o) => setDeletingId(o ? deletingId : null)}
        title="Delete this countdown?"
        itemName={deletingTimeline?.title}
        confirmLabel="Delete Countdown"
        onConfirm={() => deleteTimeline(deletingId!)}
        onSuccess={() => {
          toast.success("Countdown deleted.");
          router.refresh();
        }}
      />
    </div>
  );
}
