"use client";

import { CheckCircle2, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import type { EducationFormState } from "@/components/onboarding/steps/education-step";
import type { UserCategory } from "@/lib/types/database";

const CATEGORY_LABELS: Record<UserCategory, string> = {
  us_citizen_or_permanent_resident: "U.S. citizen or permanent resident",
  international_student_us: "International student in the United States",
  other_temporary_authorization: "Other temporary work authorization",
  prefer_not_to_answer: "Prefer not to answer",
};

export function ConfirmationStep({
  category,
  education,
  isInternational,
  onEditStep,
}: {
  category: UserCategory | null;
  education: EducationFormState;
  isInternational: boolean;
  onEditStep: (stepIndex: number) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-5 w-5 text-[var(--emerald-accent)]" />
        <h2 className="text-lg font-semibold tracking-tight">You&apos;re all set</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Here&apos;s what you told us. You can edit any of this anytime from Settings → Profile &amp; Timeline
        Settings.
      </p>

      <GlassPanel className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Category</p>
            <p className="text-sm font-medium">{category ? CATEGORY_LABELS[category] : "Not set"}</p>
          </div>
          <Button variant="ghost" size="icon-sm" onClick={() => onEditStep(0)} aria-label="Edit category">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>

        {isInternational && (
          <div className="flex items-start justify-between gap-2 border-t border-border/40 pt-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Graduation countdown</p>
              <p className="text-sm font-medium">{education.expected_graduation_date || "Not set"}</p>
            </div>
            <Button variant="ghost" size="icon-sm" onClick={() => onEditStep(1)} aria-label="Edit program details">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </GlassPanel>
    </div>
  );
}
