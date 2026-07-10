"use client";

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { UserCategory } from "@/lib/types/database";

const OPTIONS: { value: UserCategory; label: string; hint: string }[] = [
  {
    value: "us_citizen_or_permanent_resident",
    label: "U.S. citizen or permanent resident",
    hint: "No work-authorization questions needed.",
  },
  {
    value: "international_student_us",
    label: "International student in the United States",
    hint: "Adds a graduation countdown and relevant job-search context.",
  },
  {
    value: "other_temporary_authorization",
    label: "Other temporary work authorization",
    hint: "e.g. H-1B, TN, DACA, or another status.",
  },
  {
    value: "prefer_not_to_answer",
    label: "Prefer not to answer",
    hint: "You can change this anytime in Settings.",
  },
];

export function CategoryStep({
  value,
  onChange,
}: {
  value: UserCategory | null;
  onChange: (value: UserCategory) => void;
}) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Welcome to ApplyOS</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          What best describes your current work-authorization situation? This helps ApplyOS show you relevant
          features — you can change it anytime.
        </p>
      </div>
      <RadioGroup value={value ?? ""} onValueChange={(v) => v && onChange(v as UserCategory)}>
        {OPTIONS.map((opt) => (
          <Label
            key={opt.value}
            htmlFor={`category-${opt.value}`}
            className={cn(
              "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
              value === opt.value ? "border-primary bg-primary/5" : "border-border/50 hover:bg-accent/40"
            )}
          >
            <RadioGroupItem value={opt.value} id={`category-${opt.value}`} className="mt-0.5" />
            <span>
              <span className="block text-sm font-medium">{opt.label}</span>
              <span className="block text-xs text-muted-foreground">{opt.hint}</span>
            </span>
          </Label>
        ))}
      </RadioGroup>
    </div>
  );
}
