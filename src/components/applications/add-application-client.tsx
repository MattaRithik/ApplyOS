"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { ApplicationForm, type ApplicationFormValues } from "@/components/applications/application-form";
import { AiParserLayout } from "@/components/applications/parser/ai-parser-layout";
import { AiParserPanel } from "@/components/applications/parser/ai-parser-panel";
import { createApplication, saveParsedJobDetails } from "@/app/(app)/applications/actions";
import { saveApplicationHrContacts } from "@/app/(app)/applications/contacts-actions";
import { applyParsedResultToForm, type AcceptableFieldKey } from "@/lib/ai-parser/apply-to-form";
import type { AiParserApiResponse, AiParserResult } from "@/lib/ai-parser/schema";

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
  visa_sponsorship_status: "not_mentioned",
  date_applied: "",
  status: "saved",
  priority_score: 50,
  resume_id: null,
  cover_letter_used: "",
  referral_person: "",
  referral_email: "",
  referral_phone: "",
  notes: "",
  follow_up_date: "",
  source: "",
  keywords: [],
  required_skills: [],
  preferred_skills: [],
  hrContacts: [],
};

export function AddApplicationClient({
  resumeOptions,
  aiParserEnabled,
}: {
  resumeOptions: { id: string; display_name: string }[];
  aiParserEnabled: boolean;
}) {
  const router = useRouter();
  const [values, setValues] = React.useState<ApplicationFormValues>(DEFAULT_VALUES);
  const [jobUrl, setJobUrl] = React.useState("");
  const [jobDescription, setJobDescription] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [lastParsed, setLastParsed] = React.useState<AiParserApiResponse | null>(null);

  const handleApplyExtractedFields = (result: AiParserResult, accepted: Set<AcceptableFieldKey>) => {
    setValues((prev) => applyParsedResultToForm({ ...prev, job_url: jobUrl, job_description: jobDescription }, result, accepted));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!values.company_name || !values.job_title) {
      toast.error("Company and job title are required.");
      return;
    }
    setSubmitting(true);
    try {
      const { hrContacts, ...applicationFields } = values;

      const app = await createApplication({
        ...applicationFields,
        job_url: values.job_url || jobUrl || null,
        job_description: values.job_description || jobDescription || null,
        salary_min: values.salary_min || null,
        salary_max: values.salary_max || null,
        date_applied: values.date_applied || null,
        follow_up_date: values.follow_up_date || null,
        resume_id: values.resume_id || null,
      });

      if (lastParsed) {
        await saveParsedJobDetails(app.id, jobUrl || null, jobDescription, lastParsed);
      }

      if (hrContacts.some((c) => c.name.trim())) {
        await saveApplicationHrContacts(app.id, app.company_id, app.company_name, hrContacts);
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
    <div>
      <GlassPanel className="p-5 sm:p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <ApplicationForm values={values} onChange={setValues} resumeOptions={resumeOptions} />
          <div className="flex items-center justify-end gap-2 border-t border-border/50 pt-4">
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : "Save Application"}
            </Button>
          </div>
        </form>
      </GlassPanel>

      {aiParserEnabled ? (
        <AiParserLayout
          title="AI Job Parser"
          subtitle="Paste a posting to extract fields"
          icon={
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--cyan-accent)] to-[var(--blue-accent)] text-white">
              <Sparkles className="h-4 w-4" />
            </span>
          }
        >
          <AiParserPanel
            jobUrl={jobUrl}
            jobDescription={jobDescription}
            aiParserEnabled={aiParserEnabled}
            currentValues={values}
            onJobUrlChange={setJobUrl}
            onJobDescriptionChange={setJobDescription}
            onParsed={setLastParsed}
            onApply={handleApplyExtractedFields}
          />
        </AiParserLayout>
      ) : null}
    </div>
  );
}
