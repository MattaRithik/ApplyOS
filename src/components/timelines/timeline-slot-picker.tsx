"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { CustomTimelineForm, type CustomTimelineFormValue } from "@/components/timelines/custom-timeline-form";
import { SYSTEM_TIMELINE_DEFINITIONS, isSystemTimelineAvailable, resolveTimeline } from "@/lib/timelines/resolve";
import { TIMELINE_ICON_OPTIONS, CATEGORY_DEFAULT_ICON, type TimelineIconKey } from "@/lib/timelines/icons";
import { formatTargetDate, getCountdownLabel } from "@/lib/utils/timeline-date";
import { createCustomTimeline, pinTimelineToSlot, selectSystemTimeline, updateCustomTimeline } from "@/lib/actions/timelines";
import type { InternationalStudentProfile, TimelineType, UserTimeline } from "@/lib/types/database";

const CUSTOM_VALUE = "__custom__";

interface TimelineSlotPickerProps {
  slot: 1 | 2 | 3;
  isInternational: boolean;
  /** Partial is fine — onboarding passes unsaved local form state, Settings/dashboard pass the real saved profile. */
  internationalProfile: Partial<InternationalStudentProfile> | null;
  current: UserTimeline | null;
  onSaved: () => void;
}

export function TimelineSlotPicker({ slot, isInternational, internationalProfile, current, onSaved }: TimelineSlotPickerProps) {
  const [editing, setEditing] = React.useState(!current);
  const [choice, setChoice] = React.useState<string>(current?.timeline_type === "custom" ? CUSTOM_VALUE : current?.timeline_type ?? "");
  const [saving, setSaving] = React.useState(false);

  const availableSystemOptions = SYSTEM_TIMELINE_DEFINITIONS.filter(
    (d) =>
      (!d.requiresInternationalProfile || isInternational) &&
      isSystemTimelineAvailable(d.type, internationalProfile as InternationalStudentProfile | null)
  );

  const handleSelectSystem = async (type: TimelineType) => {
    setSaving(true);
    try {
      await selectSystemTimeline(type, slot as 2 | 3);
      toast.success("Dashboard timeline updated.");
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save this timeline");
    } finally {
      setSaving(false);
    }
  };

  const editingExistingCustom = current?.timeline_type === "custom";

  const handleSubmitCustom = async (value: CustomTimelineFormValue) => {
    setSaving(true);
    try {
      if (editingExistingCustom && current) {
        await updateCustomTimeline(current.id, value);
        toast.success("Countdown updated.");
      } else {
        const created = await createCustomTimeline(value);
        await pinTimelineToSlot(created.id as string, slot);
        toast.success("Custom countdown saved.");
      }
      setEditing(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save this countdown");
    } finally {
      setSaving(false);
    }
  };

  if (!editing && current) {
    const resolved = resolveTimeline(current, internationalProfile as InternationalStudentProfile | null);
    const iconKey = (resolved.icon && resolved.icon in TIMELINE_ICON_OPTIONS ? resolved.icon : CATEGORY_DEFAULT_ICON[resolved.category]) as TimelineIconKey;
    const Icon = TIMELINE_ICON_OPTIONS[iconKey];
    const countdown = resolved.targetDate ? getCountdownLabel(resolved.targetDate) : null;
    return (
      <GlassPanel className="flex items-center justify-between gap-3 p-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--blue-accent)]/15 text-[var(--blue-accent)]">
            <Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{resolved.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {countdown ? countdown.primary : "Add the source date to see a countdown"}
              {resolved.targetDate ? ` · ${formatTargetDate(resolved.targetDate)}` : ""}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" /> Replace
        </Button>
      </GlassPanel>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/50 p-3.5">
      <Select
        items={[
          ...availableSystemOptions.map((d) => ({ value: d.type, label: d.label })),
          { value: CUSTOM_VALUE, label: "Custom deadline…" },
        ]}
        value={choice}
        onValueChange={(v) => {
          const next = v ?? "";
          setChoice(next);
          if (next && next !== CUSTOM_VALUE) handleSelectSystem(next as TimelineType);
        }}
      >
        <SelectTrigger><SelectValue placeholder="Choose a timeline…" /></SelectTrigger>
        <SelectContent>
          {availableSystemOptions.map((d) => (
            <SelectItem key={d.type} value={d.type}>{d.label}</SelectItem>
          ))}
          <SelectItem value={CUSTOM_VALUE}>Custom deadline…</SelectItem>
        </SelectContent>
      </Select>

      {availableSystemOptions.length === 0 && isInternational && (
        <p className="text-xs text-muted-foreground">
          More timeline types will appear here once you add your I-20 or OPT dates.
        </p>
      )}

      {choice === CUSTOM_VALUE && (
        <CustomTimelineForm
          initialValue={
            editingExistingCustom && current
              ? {
                  title: current.title,
                  description: current.description ?? "",
                  category: current.category,
                  target_date: current.target_date ?? "",
                  icon: current.icon,
                }
              : undefined
          }
          submitLabel={editingExistingCustom ? "Save changes" : undefined}
          onSubmit={handleSubmitCustom}
          onCancel={current ? () => setEditing(false) : undefined}
          saving={saving}
        />
      )}

      {current && choice !== CUSTOM_VALUE && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={() => setEditing(false)} disabled={saving}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  );
}
