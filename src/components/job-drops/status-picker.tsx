"use client";

import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LINK_STATUSES, type LinkStatus } from "@/lib/types/database";
import { cn } from "@/lib/utils";

const STATUS_TEXT_STYLES: Record<LinkStatus, string> = {
  applied: "text-[var(--emerald-accent)]",
  not_applied: "text-[var(--amber-accent)]",
  not_applicable: "text-muted-foreground",
};

interface StatusPickerProps {
  label: string;
  value: LinkStatus | null;
  onChange?: (value: LinkStatus) => void;
  readOnly?: boolean;
}

export function StatusPicker({ label, value, onChange, readOnly }: StatusPickerProps) {
  if (readOnly) {
    return (
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-muted-foreground">{label}:</span>
        {value ? (
          <Badge variant="outline" className={cn(STATUS_TEXT_STYLES[value])}>
            {LINK_STATUSES.find((s) => s.value === value)?.label}
          </Badge>
        ) : (
          <span className="italic text-muted-foreground">no status yet</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <Select value={value ?? undefined} onValueChange={(v) => v && onChange?.(v as LinkStatus)}>
        <SelectTrigger size="sm">
          <SelectValue placeholder="Set status" />
        </SelectTrigger>
        <SelectContent>
          {LINK_STATUSES.map((s) => (
            <SelectItem key={s.value} value={s.value}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
