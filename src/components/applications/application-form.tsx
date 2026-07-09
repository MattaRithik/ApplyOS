"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { APPLICATION_STATUSES } from "@/lib/types/database";
import type { ApplicationInput } from "@/app/(app)/applications/actions";

export interface ApplicationFormValues extends ApplicationInput {
  keywords_text?: string;
  required_skills_text?: string;
  preferred_skills_text?: string;
}

interface ApplicationFormProps {
  values: ApplicationFormValues;
  onChange: (values: ApplicationFormValues) => void;
  resumeOptions: { id: string; display_name: string }[];
  compact?: boolean;
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

const NONE = "__none__";

export function ApplicationForm({ values, onChange, resumeOptions, compact }: ApplicationFormProps) {
  const set = <K extends keyof ApplicationFormValues>(key: K, val: ApplicationFormValues[K]) =>
    onChange({ ...values, [key]: val });

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company *">
          <Input
            value={values.company_name}
            onChange={(e) => set("company_name", e.target.value)}
            placeholder="Acme Corp"
            required
          />
        </Field>
        <Field label="Job title *">
          <Input
            value={values.job_title}
            onChange={(e) => set("job_title", e.target.value)}
            placeholder="Software Engineer"
            required
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Job URL">
          <Input
            value={values.job_url ?? ""}
            onChange={(e) => set("job_url", e.target.value)}
            placeholder="https://…"
          />
        </Field>
        <Field label="Source / job board">
          <Input
            value={values.source ?? ""}
            onChange={(e) => set("source", e.target.value)}
            placeholder="LinkedIn, Indeed, Referral…"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Location">
          <Input
            value={values.location ?? ""}
            onChange={(e) => set("location", e.target.value)}
            placeholder="New York, NY"
          />
        </Field>
        <Field label="Work mode">
          <Select value={values.work_mode ?? NONE} onValueChange={(v) => set("work_mode", v === NONE ? null : v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="onsite">Onsite</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Employment type">
          <Select
            value={values.employment_type ?? NONE}
            onValueChange={(v) => set("employment_type", v === NONE ? null : v)}
          >
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              <SelectItem value="full_time">Full-time</SelectItem>
              <SelectItem value="part_time">Part-time</SelectItem>
              <SelectItem value="internship">Internship</SelectItem>
              <SelectItem value="contract">Contract</SelectItem>
              <SelectItem value="temporary">Temporary</SelectItem>
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Salary min">
          <Input
            type="number"
            value={values.salary_min ?? ""}
            onChange={(e) => set("salary_min", e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
        <Field label="Salary max">
          <Input
            type="number"
            value={values.salary_max ?? ""}
            onChange={(e) => set("salary_max", e.target.value ? Number(e.target.value) : null)}
          />
        </Field>
        <Field label="Currency">
          <Input value={values.salary_currency ?? "USD"} onChange={(e) => set("salary_currency", e.target.value)} />
        </Field>
      </div>

      <Field label="Visa sponsorship / OPT / CPT / H1B notes">
        <Textarea
          rows={2}
          value={values.visa_sponsorship_notes ?? ""}
          onChange={(e) => set("visa_sponsorship_notes", e.target.value)}
          placeholder="e.g. Sponsors H1B, OPT-friendly…"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Date applied">
          <Input
            type="date"
            value={values.date_applied ?? ""}
            onChange={(e) => set("date_applied", e.target.value)}
          />
        </Field>
        <Field label="Status">
          <Select value={values.status ?? "saved"} onValueChange={(v) => set("status", (v ?? "saved") as ApplicationFormValues["status"])}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {APPLICATION_STATUSES.map((s) => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Follow-up date">
          <Input
            type="date"
            value={values.follow_up_date ?? ""}
            onChange={(e) => set("follow_up_date", e.target.value)}
          />
        </Field>
      </div>

      <Field label={`Priority score: ${values.priority_score ?? 0}`}>
        <Slider
          value={[values.priority_score ?? 0]}
          onValueChange={(v) => set("priority_score", Array.isArray(v) ? v[0] : v)}
          max={100}
          step={5}
        />
      </Field>

      <Field label="Resume used">
        <Select value={values.resume_id ?? NONE} onValueChange={(v) => set("resume_id", v === NONE ? null : v)}>
          <SelectTrigger><SelectValue placeholder="Select resume" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>—</SelectItem>
            {resumeOptions.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Referral person">
          <Input value={values.referral_person ?? ""} onChange={(e) => set("referral_person", e.target.value)} />
        </Field>
        <Field label="Recruiter / HR contact name">
          <Input value={values.recruiter_name ?? ""} onChange={(e) => set("recruiter_name", e.target.value)} />
        </Field>
        <Field label="HR email">
          <Input value={values.hr_email ?? ""} onChange={(e) => set("hr_email", e.target.value)} />
        </Field>
        <Field label="Recruiter LinkedIn">
          <Input value={values.recruiter_linkedin_url ?? ""} onChange={(e) => set("recruiter_linkedin_url", e.target.value)} />
        </Field>
        <Field label="Hiring manager LinkedIn" className="sm:col-span-2">
          <Input
            value={values.hiring_manager_linkedin_url ?? ""}
            onChange={(e) => set("hiring_manager_linkedin_url", e.target.value)}
          />
        </Field>
      </div>

      <Field label="Cover letter used (notes / link)">
        <Textarea
          rows={2}
          value={values.cover_letter_used ?? ""}
          onChange={(e) => set("cover_letter_used", e.target.value)}
        />
      </Field>

      <Field label="Notes">
        <Textarea rows={3} value={values.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
      </Field>

      <Field label="Job description">
        <Textarea
          rows={6}
          value={values.job_description ?? ""}
          onChange={(e) => set("job_description", e.target.value)}
          placeholder="Paste the full job description…"
        />
      </Field>
    </div>
  );
}
