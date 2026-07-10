"use client";

import { TimelineSlotPicker } from "@/components/timelines/timeline-slot-picker";

export function TimelinesStep({ onTimelineSaved }: { onTimelineSaved: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Add a dashboard countdown</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Optional — track an interview, application deadline, or personal milestone.
        </p>
      </div>

      <TimelineSlotPicker
        slot={1}
        isInternational={false}
        internationalProfile={null}
        current={null}
        onSaved={onTimelineSaved}
      />
    </div>
  );
}
