"use client";

import * as React from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ApplicationForm, type ApplicationFormValues } from "@/components/applications/application-form";
import { updateApplication } from "@/app/(app)/applications/actions";
import type { ApplicationWithResume } from "@/components/applications/types";

export function EditApplicationDialog({
  application,
  resumeOptions,
  onSaved,
}: {
  application: ApplicationWithResume;
  resumeOptions: { id: string; display_name: string }[];
  onSaved: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [values, setValues] = React.useState<ApplicationFormValues>(() => ({
    company_name: application.company_name,
    job_title: application.job_title,
    job_url: application.job_url,
    job_description: application.job_description,
    location: application.location,
    work_mode: application.work_mode,
    employment_type: application.employment_type,
    salary_min: application.salary_min,
    salary_max: application.salary_max,
    salary_currency: application.salary_currency,
    visa_sponsorship_notes: application.visa_sponsorship_notes,
    date_applied: application.date_applied,
    status: application.status,
    priority_score: application.priority_score,
    resume_id: application.resume_id,
    cover_letter_used: application.cover_letter_used,
    referral_person: application.referral_person,
    recruiter_name: application.recruiter_name,
    hr_email: application.hr_email,
    recruiter_linkedin_url: application.recruiter_linkedin_url,
    hiring_manager_linkedin_url: application.hiring_manager_linkedin_url,
    notes: application.notes,
    follow_up_date: application.follow_up_date,
    source: application.source,
    keywords: application.keywords,
    required_skills: application.required_skills,
    preferred_skills: application.preferred_skills,
  }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateApplication(application.id, values);
      toast.success("Application updated.");
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" /> Edit
      </Button>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>Edit application</DialogTitle>
        </DialogHeader>
        <ApplicationForm values={values} onChange={setValues} resumeOptions={resumeOptions} compact />
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
