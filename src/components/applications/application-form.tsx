"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { GlassPanel } from "@/components/shared/glass-panel";
import { cn } from "@/lib/utils";
import {
  APPLICATION_STATUSES,
  WORK_MODES,
  EMPLOYMENT_TYPES,
  HR_CONTACT_RELATIONSHIP_TYPES,
  VISA_SPONSORSHIP_STATUSES,
} from "@/lib/types/database";
import type { ApplicationInput } from "@/app/(app)/applications/actions";
import { EMPTY_HR_CONTACT, type HrContactDraft } from "@/components/applications/types";
import { uploadResume } from "@/lib/supabase/resumes";

export interface ApplicationFormValues extends ApplicationInput {
  hrContacts: HrContactDraft[];
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
  const [uploadedResumes, setUploadedResumes] = React.useState<{ id: string; display_name: string }[]>([]);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const set = <K extends keyof ApplicationFormValues>(key: K, val: ApplicationFormValues[K]) =>
    onChange({ ...values, [key]: val });

  const allResumeOptions = [...resumeOptions, ...uploadedResumes];

  const handleUploadResume = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const resume = await uploadResume(file);
      setUploadedResumes((prev) => [...prev, { id: resume.id, display_name: resume.display_name }]);
      set("resume_id", resume.id);
      toast.success(`Uploaded "${resume.display_name}" and selected it.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const hrContacts = values.hrContacts;
  const updateHrContact = (index: number, patch: Partial<HrContactDraft>) => {
    const next = hrContacts.map((c, i) => (i === index ? { ...c, ...patch } : c));
    set("hrContacts", next);
  };
  const addHrContact = () => set("hrContacts", [...hrContacts, { ...EMPTY_HR_CONTACT }]);
  const removeHrContact = (index: number) => set("hrContacts", hrContacts.filter((_, i) => i !== index));

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Company *">
          <Input
            value={values.company_name}
            onChange={(e) => set("company_name", e.target.value)}
            placeholder="Jane Street"
            required
          />
        </Field>
        <Field label="Job title *">
          <Input
            value={values.job_title}
            onChange={(e) => set("job_title", e.target.value)}
            placeholder="Quantitative Researcher"
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
          <Select
            items={[{ value: NONE, label: "—" }, ...WORK_MODES]}
            value={values.work_mode ?? NONE}
            onValueChange={(v) => set("work_mode", v === NONE ? null : v)}
          >
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {WORK_MODES.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Employment type">
          <Select
            items={[{ value: NONE, label: "—" }, ...EMPLOYMENT_TYPES]}
            value={values.employment_type ?? NONE}
            onValueChange={(v) => set("employment_type", v === NONE ? null : v)}
          >
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {EMPLOYMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
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

      <Field label="Visa sponsorship">
        <RadioGroup
          value={values.visa_sponsorship_status ?? "not_mentioned"}
          onValueChange={(v) => set("visa_sponsorship_status", v as ApplicationFormValues["visa_sponsorship_status"])}
          className="grid grid-cols-1 gap-2 sm:grid-cols-2"
        >
          {VISA_SPONSORSHIP_STATUSES.map((opt) => {
            const checked = (values.visa_sponsorship_status ?? "not_mentioned") === opt.value;
            return (
              <label
                key={opt.value}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-all duration-200",
                  checked
                    ? "border-primary/50 bg-primary/10 text-foreground shadow-[0_0_0_1px_var(--primary)_inset]"
                    : "border-border/60 text-muted-foreground hover:border-border hover:bg-muted/40 hover:text-foreground"
                )}
              >
                <RadioGroupItem value={opt.value} />
                {opt.label}
              </label>
            );
          })}
        </RadioGroup>
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
          <Select
            items={APPLICATION_STATUSES}
            value={values.status ?? "saved"}
            onValueChange={(v) => set("status", (v ?? "saved") as ApplicationFormValues["status"])}
          >
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
        <div className="flex flex-wrap items-center gap-2">
          <Select
            items={[{ value: NONE, label: "—" }, ...allResumeOptions.map((r) => ({ value: r.id, label: r.display_name }))]}
            value={values.resume_id ?? NONE}
            onValueChange={(v) => set("resume_id", v === NONE ? null : v)}
          >
            <SelectTrigger className="min-w-[200px] flex-1">
              <SelectValue placeholder="Select resume" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>—</SelectItem>
              {allResumeOptions.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Uploading…" : "Upload new resume"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => handleUploadResume(e.target.files?.[0] ?? null)}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Upload a fresh PDF/DOC/DOCX right here — it&apos;s saved to your resume library and selected automatically.
        </p>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Referral person">
          <Input value={values.referral_person ?? ""} onChange={(e) => set("referral_person", e.target.value)} placeholder="Name" />
        </Field>
        <Field label="Referral email">
          <Input
            type="email"
            value={values.referral_email ?? ""}
            onChange={(e) => set("referral_email", e.target.value)}
            placeholder="name@company.com"
          />
        </Field>
        <Field label="Referral phone">
          <Input
            type="tel"
            value={values.referral_phone ?? ""}
            onChange={(e) => set("referral_phone", e.target.value)}
            placeholder="(555) 123-4567"
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">HR / Recruiter / Hiring Manager contacts</Label>
          <Button type="button" variant="outline" size="sm" className="h-7 gap-1 text-xs" onClick={addHrContact}>
            <Plus className="h-3 w-3" /> Add contact
          </Button>
        </div>
        {hrContacts.length === 0 ? (
          <p className="text-xs text-muted-foreground">No HR contacts added yet — you can add as many as this application needs.</p>
        ) : (
          <div className="space-y-3">
            {hrContacts.map((contact, index) => (
              <GlassPanel key={index} className="space-y-2.5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="grid flex-1 grid-cols-1 gap-2 sm:grid-cols-2">
                    <Input
                      value={contact.name}
                      onChange={(e) => updateHrContact(index, { name: e.target.value })}
                      placeholder="Name"
                      className="h-8 text-sm"
                    />
                    <Select
                      items={HR_CONTACT_RELATIONSHIP_TYPES}
                      value={contact.relationship_type}
                      onValueChange={(v) =>
                        updateHrContact(index, { relationship_type: (v ?? "recruiter") as HrContactDraft["relationship_type"] })
                      }
                    >
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {HR_CONTACT_RELATIONSHIP_TYPES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => removeHrContact(index)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Input
                    value={contact.role_title}
                    onChange={(e) => updateHrContact(index, { role_title: e.target.value })}
                    placeholder="Role / title"
                    className="h-8 text-sm"
                  />
                  <Input
                    type="email"
                    value={contact.email}
                    onChange={(e) => updateHrContact(index, { email: e.target.value })}
                    placeholder="Email"
                    className="h-8 text-sm"
                  />
                  <Input
                    type="tel"
                    value={contact.phone}
                    onChange={(e) => updateHrContact(index, { phone: e.target.value })}
                    placeholder="Phone"
                    className="h-8 text-sm"
                  />
                </div>
                <Input
                  value={contact.linkedin_url}
                  onChange={(e) => updateHrContact(index, { linkedin_url: e.target.value })}
                  placeholder="LinkedIn URL"
                  className="h-8 text-sm"
                />
              </GlassPanel>
            ))}
          </div>
        )}
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
