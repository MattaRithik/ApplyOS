"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { TimelineSlotPicker } from "@/components/timelines/timeline-slot-picker";
import { SavedTimelinesList } from "@/components/timelines/saved-timelines-list";
import {
  reopenOnboarding,
  updateUserCategory,
  upsertInternationalStudentProfile,
} from "@/lib/actions/profile";
import { cn } from "@/lib/utils";
import type { InternationalStudentProfile, UserCategory, UserTimeline } from "@/lib/types/database";

const CATEGORY_OPTIONS: { value: UserCategory; label: string }[] = [
  { value: "us_citizen_or_permanent_resident", label: "U.S. citizen or permanent resident" },
  { value: "international_student_us", label: "International student in the United States" },
  { value: "other_temporary_authorization", label: "Other temporary work authorization" },
  { value: "prefer_not_to_answer", label: "Prefer not to answer" },
];

export function ProfileTimelineSettings({
  userCategory,
  internationalProfile,
  allTimelines,
}: {
  userCategory: UserCategory | null;
  internationalProfile: InternationalStudentProfile | null;
  allTimelines: UserTimeline[];
}) {
  const router = useRouter();
  const [category, setCategory] = React.useState<UserCategory | null>(userCategory);
  const [savingCategory, setSavingCategory] = React.useState(false);
  const [graduationDate, setGraduationDate] = React.useState(internationalProfile?.expected_graduation_date ?? "");
  const [savingGraduation, setSavingGraduation] = React.useState(false);
  const [reopening, setReopening] = React.useState(false);

  const isInternational = category === "international_student_us";

  const slotMap: Partial<Record<1 | 2 | 3, UserTimeline>> = {};
  for (const t of allTimelines) {
    if (t.is_pinned && t.dashboard_slot) slotMap[t.dashboard_slot] = t;
  }

  const handleSaveCategory = async () => {
    if (!category) return;
    setSavingCategory(true);
    try {
      await updateUserCategory(category);
      toast.success("Category updated.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSaveGraduation = async () => {
    setSavingGraduation(true);
    try {
      await upsertInternationalStudentProfile({
        expected_graduation_date: graduationDate || null,
      });
      toast.success("Graduation date saved.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save");
    } finally {
      setSavingGraduation(false);
    }
  };

  const handleRerunOnboarding = async () => {
    setReopening(true);
    try {
      await reopenOnboarding();
      toast.success("Onboarding will reopen from your dashboard.");
      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't reopen onboarding");
    } finally {
      setReopening(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <GlassPanel className="space-y-3 p-5">
        <div>
          <h3 className="text-sm font-semibold">Work-authorization category</h3>
          <p className="text-xs text-muted-foreground">
            Used only for relevant job-search context, such as sponsorship-related application tracking.
          </p>
        </div>
        <RadioGroup value={category ?? ""} onValueChange={(v) => v && setCategory(v as UserCategory)}>
          {CATEGORY_OPTIONS.map((opt) => (
            <Label
              key={opt.value}
              htmlFor={`settings-category-${opt.value}`}
              className={cn(
                "flex cursor-pointer items-center gap-2.5 rounded-lg border p-2.5 text-sm transition-colors",
                category === opt.value ? "border-primary bg-primary/5" : "border-border/50 hover:bg-accent/40"
              )}
            >
              <RadioGroupItem value={opt.value} id={`settings-category-${opt.value}`} />
              {opt.label}
            </Label>
          ))}
        </RadioGroup>
        <Button size="sm" onClick={handleSaveCategory} disabled={savingCategory || category === userCategory}>
          {savingCategory ? "Saving…" : "Save category"}
        </Button>
      </GlassPanel>

      {isInternational && (
        <GlassPanel className="space-y-4 p-5">
          <div>
            <h3 className="text-sm font-semibold">Graduation countdown</h3>
            <p className="text-xs text-muted-foreground">
              This is the only student-specific date ApplyOS needs. It powers the countdown on your dashboard.
            </p>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Expected graduation date</Label>
            <Input type="date" value={graduationDate} onChange={(event) => setGraduationDate(event.target.value)} />
          </div>
          <Button size="sm" onClick={handleSaveGraduation} disabled={savingGraduation}>
            {savingGraduation ? "Saving…" : "Save graduation date"}
          </Button>
        </GlassPanel>
      )}

      <GlassPanel className="space-y-4 p-5">
        <div>
          <h3 className="text-sm font-semibold">Dashboard timelines</h3>
          <p className="text-xs text-muted-foreground">Up to 3 countdown cards appear on your dashboard.</p>
        </div>

        {isInternational && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Slot 1 · Graduation (automatic)</p>
            <p className="rounded-lg border border-border/50 p-2.5 text-xs text-muted-foreground">
              Your expected graduation date appears on the dashboard automatically once it is set.
            </p>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            Slot {isInternational ? "2" : "1"} · Timeline
          </p>
          <TimelineSlotPicker
            slot={isInternational ? 2 : 1}
            isInternational={isInternational}
            internationalProfile={internationalProfile}
            current={slotMap[isInternational ? 2 : 1] ?? null}
            onSaved={() => router.refresh()}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Slot 3 · Custom countdown</p>
          <TimelineSlotPicker
            slot={3}
            isInternational={isInternational}
            internationalProfile={internationalProfile}
            current={slotMap[3] ?? null}
            onSaved={() => router.refresh()}
          />
        </div>

        <SavedTimelinesList timelines={allTimelines} />
      </GlassPanel>

      <GlassPanel className="flex items-center justify-between gap-3 p-5">
        <div>
          <h3 className="text-sm font-semibold">Onboarding</h3>
          <p className="text-xs text-muted-foreground">Rerun the welcome flow — your saved answers stay intact.</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleRerunOnboarding} disabled={reopening}>
          <RotateCcw className="h-3.5 w-3.5" /> Rerun onboarding
        </Button>
      </GlassPanel>
    </div>
  );
}
