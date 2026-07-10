"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { TIMELINE_CATEGORY_OPTIONS, TIMELINE_ICON_OPTIONS, type TimelineIconKey } from "@/lib/timelines/icons";
import { cn } from "@/lib/utils";
import type { TimelineCategory } from "@/lib/types/database";
import type { CustomTimelineInput } from "@/lib/actions/timelines";

export type CustomTimelineFormValue = CustomTimelineInput;

const EMPTY_VALUE: CustomTimelineFormValue = {
  title: "",
  description: "",
  category: "other",
  target_date: "",
  icon: null,
};

export function CustomTimelineForm({
  initialValue,
  onSubmit,
  onCancel,
  submitLabel = "Save countdown",
  saving = false,
}: {
  initialValue?: Partial<CustomTimelineFormValue>;
  onSubmit: (value: CustomTimelineFormValue) => void;
  onCancel?: () => void;
  submitLabel?: string;
  saving?: boolean;
}) {
  const [value, setValue] = React.useState<CustomTimelineFormValue>({ ...EMPTY_VALUE, ...initialValue });

  const canSubmit = value.title.trim().length > 0 && !!value.target_date;

  return (
    <div className="space-y-3">
      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Title *</Label>
        <Input
          value={value.title}
          onChange={(e) => setValue((v) => ({ ...v, title: e.target.value }))}
          placeholder="e.g. Graduation ceremony, Career fair, FRM exam"
        />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Target date *</Label>
          <Input
            type="date"
            value={value.target_date}
            onChange={(e) => setValue((v) => ({ ...v, target_date: e.target.value }))}
          />
        </div>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Category</Label>
          <Select
            items={TIMELINE_CATEGORY_OPTIONS}
            value={value.category}
            onValueChange={(v) => setValue((s) => ({ ...s, category: (v ?? "other") as TimelineCategory }))}
          >
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMELINE_CATEGORY_OPTIONS.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Description (optional)</Label>
        <Textarea
          rows={2}
          value={value.description ?? ""}
          onChange={(e) => setValue((v) => ({ ...v, description: e.target.value }))}
          placeholder="Any extra context for this deadline"
        />
      </div>
      <div>
        <Label className="mb-1.5 block text-xs text-muted-foreground">Icon (optional)</Label>
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(TIMELINE_ICON_OPTIONS) as TimelineIconKey[]).map((key) => {
            const Icon = TIMELINE_ICON_OPTIONS[key];
            const selected = value.icon === key;
            return (
              <button
                type="button"
                key={key}
                aria-label={key}
                aria-pressed={selected}
                onClick={() => setValue((v) => ({ ...v, icon: selected ? null : key }))}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-lg border transition-colors",
                  selected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border/50 text-muted-foreground hover:bg-accent/40"
                )}
              >
                <Icon className="h-4 w-4" />
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2 pt-1">
        {onCancel && (
          <Button variant="outline" size="sm" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
        <Button size="sm" onClick={() => onSubmit(value)} disabled={!canSubmit || saving}>
          {saving ? "Saving…" : submitLabel}
        </Button>
      </div>
    </div>
  );
}
