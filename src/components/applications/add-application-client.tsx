"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { FloatingDrawer } from "@/components/shared/floating-drawer";
import { ApplicationForm, type ApplicationFormValues } from "@/components/applications/application-form";
import { ParserDrawerContent } from "@/components/applications/parser/parser-drawer-content";
import { createApplication, saveParsedJobDetails } from "@/app/(app)/applications/actions";
import { applyParsedFieldsToForm } from "@/lib/parser/apply-to-form";
import type { ParsedJobResult } from "@/lib/parser/types";

const DEFAULT_VALUES: ApplicationFormValues = {
  company_name: "",
  job_title: "",
  job_url: "",
  job_description: "",
  location: "",
  work_mode: null,
  employment_type: null,
  salary_min: null,
  salary_max: null,
  salary_currency: "USD",
  visa_sponsorship_notes: "",
  date_applied: "",
  status: "saved",
  priority_score: 50,
  resume_id: null,
  cover_letter_used: "",
  referral_person: "",
  recruiter_name: "",
  hr_email: "",
  recruiter_linkedin_url: "",
  hiring_manager_linkedin_url: "",
  notes: "",
  follow_up_date: "",
  source: "",
  keywords: [],
  required_skills: [],
  preferred_skills: [],
};

export function AddApplicationClient({
  resumeOptions,
}: {
  resumeOptions: { id: string; display_name: string }[];
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<ApplicationFormValues>(DEFAULT_VALUES);
  const [jobUrl, setJobUrl] = React.useState("");
  const [jobDescription, setJobDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [mobileParserOpen, setMobileParserOpen] = React.useState(false);
  const [lastParsed, setLastParsed] = React.useState<ParsedJobResult | null>(null);

  const handleApplyParsedFields = (parsed: ParsedJobResult, accepted: Set<keyof ParsedJobResult>) => {
    setValues((prev) => applyParsedFieldsToForm({ ...prev, job_url: jobUrl, job_description: jobDescription }, parsed, accepted));
    setLastParsed(parsed);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.company_name || !values.job_title) {
      toast.error("Company and job title are required.");
      return;
    }
    setSubmitting(true);
    try {
      const app = await createApplication({
        ...values,
        job_url: values.job_url || jobUrl || null,
        job_description: values.job_description || jobDescription || null,
        salary_min: values.salary_min || null,
        salary_max: values.salary_max || null,
        date_applied: values.date_applied || null,
        follow_up_date: values.follow_up_date || null,
        resume_id: values.resume_id || null,
      });

      if (lastParsed) {
        await saveParsedJobDetails(app.id, jobUrl || null, jobDescription, lastParsed as never);
      }

      toast.success("Application added.");
      router.push(`/applications/${app.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create application");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <GlassPanel className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <ApplicationForm values={values} onChange={setValues} resumeOptions={resumeOptions} />
          <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-4">
            <Button
              type="button"
              variant="outline"
              className="lg:hidden gap-2"
              onClick={() => setMobileParserOpen(true)}
            >
              <Sparkles className="h-4 w-4" /> Open Parser
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save Application"}
            </Button>
          </div>
        </form>
      </GlassPanel>

      <FloatingDrawer
        title="AI Job Parser"
        subtitle="Paste a posting to auto-fill the form"
        mobileOpen={mobileParserOpen}
        onMobileOpenChange={setMobileParserOpen}
      >
        <ParserDrawerContent
          jobUrl={jobUrl}
          jobDescription={jobDescription}
          onJobUrlChange={setJobUrl}
          onJobDescriptionChange={setJobDescription}
          onApply={handleApplyParsedFields}
        />
      </FloatingDrawer>
    </div>
  );
}
