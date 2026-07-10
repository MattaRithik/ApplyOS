"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CategoryStep } from "@/components/onboarding/steps/category-step";
import { EducationStep, EMPTY_EDUCATION_STATE, type EducationFormState } from "@/components/onboarding/steps/education-step";
import { TimelinesStep } from "@/components/onboarding/steps/timelines-step";
import { ConfirmationStep } from "@/components/onboarding/steps/confirmation-step";
import { completeOnboarding, skipOnboarding, updateUserCategory, upsertInternationalStudentProfile } from "@/lib/actions/profile";
import type { UserCategory } from "@/lib/types/database";

type StepKey = "category" | "education" | "timelines" | "confirmation";

export function OnboardingFlow({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [category, setCategory] = React.useState<UserCategory | null>(null);
  const [education, setEducation] = React.useState<EducationFormState>(EMPTY_EDUCATION_STATE);
  const [stepIndex, setStepIndex] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [prevOpen, setPrevOpen] = React.useState(open);

  const isInternational = category === "international_student_us";
  const steps: StepKey[] = isInternational
    ? ["category", "education", "confirmation"]
    : ["category", "timelines", "confirmation"];
  const currentStep = steps[stepIndex];

  // Reset to the first step whenever the dialog transitions to open —
  // adjusted during render (React's recommended pattern for this) rather
  // than in an effect, so it takes effect before the first paint instead
  // of causing an extra render pass.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setStepIndex(0);
  }

  const closeAndRefresh = () => {
    onOpenChange(false);
    router.refresh();
  };

  const handleSkip = async () => {
    setSubmitting(true);
    try {
      await skipOnboarding();
      toast.success("You can finish this anytime from Settings.");
      closeAndRefresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't skip onboarding");
    } finally {
      setSubmitting(false);
    }
  };

  const handleBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const handleContinue = async () => {
    setSubmitting(true);
    try {
      if (currentStep === "category") {
        if (!category) {
          toast.error("Pick an option to continue.");
          return;
        }
        await updateUserCategory(category);
      } else if (currentStep === "education") {
        await upsertInternationalStudentProfile({
          expected_graduation_date: education.expected_graduation_date || null,
        });
      } else if (currentStep === "confirmation") {
        await completeOnboarding();
        toast.success("Welcome to ApplyOS.");
        closeAndRefresh();
        return;
      }

      setStepIndex((i) => Math.min(steps.length - 1, i + 1));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save — try again");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent showCloseButton={false} className="max-w-lg sm:max-w-lg">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Step {stepIndex + 1} of {steps.length}
          </p>
          <Button variant="ghost" size="sm" onClick={handleSkip} disabled={submitting} className="text-xs text-muted-foreground">
            Skip for now
          </Button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto scrollbar-thin pr-1">
          {currentStep === "category" && <CategoryStep value={category} onChange={setCategory} />}
          {currentStep === "education" && (
            <EducationStep
              value={education}
              onChange={(patch) => setEducation((s) => ({ ...s, ...patch }))}
            />
          )}
          {currentStep === "timelines" && (
            <TimelinesStep onTimelineSaved={() => {}} />
          )}
          {currentStep === "confirmation" && (
            <ConfirmationStep
              category={category}
              education={education}
              isInternational={isInternational}
              onEditStep={(i) => setStepIndex(i)}
            />
          )}
        </div>

        <div className="-mx-4 -mb-4 flex items-center justify-between gap-2 rounded-b-xl border-t border-border/50 bg-muted/50 p-4">
          <Button variant="outline" size="sm" onClick={handleBack} disabled={stepIndex === 0 || submitting} className="gap-1.5">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </Button>
          <Button size="sm" onClick={handleContinue} disabled={submitting} className="gap-1.5">
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {currentStep === "confirmation" ? "Finish" : "Continue"}
            {currentStep !== "confirmation" && !submitting && <ArrowRight className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
