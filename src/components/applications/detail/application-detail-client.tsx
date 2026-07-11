"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  ExternalLink,
  MapPin,
  Trash2,
  DollarSign,
  FileText,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { APPLICATION_STATUSES, type ApplicationStatus, type InterviewRound, type Note, type ApplicationStatusHistory } from "@/lib/types/database";
import { deleteApplication, updateApplicationStatus } from "@/app/(app)/applications/actions";
import { EditApplicationDialog } from "@/components/applications/detail/edit-application-dialog";
import { InterviewRoundsSection } from "@/components/applications/detail/interview-rounds-section";
import { HrContactsCard } from "@/components/applications/detail/hr-contacts-card";
import { VisaSponsorshipBadge } from "@/components/shared/visa-sponsorship-badge";
import { NotesPanel } from "@/components/shared/notes-panel";
import { StatusHistorySection } from "@/components/applications/detail/status-history-section";
import type { ApplicationWithResume, HrContactDraft } from "@/components/applications/types";
import { safeHttpUrl } from "@/lib/utils/url";

interface Props {
  application: ApplicationWithResume;
  resumeOptions: { id: string; display_name: string }[];
  interviewRounds: InterviewRound[];
  statusHistory: ApplicationStatusHistory[];
  notes: Note[];
  hrContacts: HrContactDraft[];
  aiParserEnabled: boolean;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2.5 text-sm">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}

export function ApplicationDetailClient({
  application,
  resumeOptions,
  interviewRounds,
  statusHistory,
  notes,
  hrContacts,
  aiParserEnabled,
}: Props) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [status, setStatus] = React.useState<ApplicationStatus>(application.status);

  const handleStatusChange = async (value: ApplicationStatus) => {
    setStatus(value);
    try {
      await updateApplicationStatus(application.id, value);
      toast.success("Status updated.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
      setStatus(application.status);
    }
  };

  const handleDeleted = () => {
    toast.success("Application deleted.");
    router.push("/applications");
  };

  const salary =
    application.salary_min || application.salary_max
      ? `${application.salary_currency ?? "USD"} ${application.salary_min?.toLocaleString() ?? "?"} – ${application.salary_max?.toLocaleString() ?? "?"}`
      : null;

  const referral = [application.referral_person, application.referral_email, application.referral_phone]
    .filter(Boolean)
    .join(" · ");
  const jobUrl = safeHttpUrl(application.job_url);

  return (
    <div className="space-y-5 py-6">
      <Link href="/applications" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to applications
      </Link>

      <GlassPanel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{application.job_title}</h1>
              {jobUrl && (
                <a href={jobUrl} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> {application.company_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              items={APPLICATION_STATUSES}
              value={status}
              onValueChange={(v) => handleStatusChange((v ?? status) as ApplicationStatus)}
            >
              <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPLICATION_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <EditApplicationDialog
              application={application}
              resumeOptions={resumeOptions}
              initialHrContacts={hrContacts}
              aiParserEnabled={aiParserEnabled}
              onSaved={() => router.refresh()}
            />
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <ConfirmDeleteDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title="Delete this application?"
              itemName={`${application.job_title} at ${application.company_name}`}
              warningText="This removes the application and its interview rounds, notes, and status history. This can't be undone."
              confirmLabel="Delete Application"
              onConfirm={() => deleteApplication(application.id)}
              onSuccess={handleDeleted}
            />
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <InfoRow icon={MapPin} label="Location" value={[application.location, application.work_mode].filter(Boolean).join(" · ")} />
          <InfoRow icon={FileText} label="Resume" value={application.resume?.display_name} />
          <InfoRow icon={DollarSign} label="Salary" value={salary} />
          <InfoRow icon={User} label="Referral" value={referral || null} />
          <InfoRow icon={FileText} label="Date applied" value={application.date_applied && format(new Date(application.date_applied), "MMM d, yyyy")} />
          <InfoRow icon={FileText} label="Follow-up" value={application.follow_up_date && format(new Date(application.follow_up_date), "MMM d, yyyy")} />
          <InfoRow icon={FileText} label="Priority" value={`${application.priority_score}/100`} />
          <InfoRow
            icon={FileText}
            label="Visa sponsorship"
            value={<VisaSponsorshipBadge status={application.visa_sponsorship_status} />}
          />
        </div>

        {application.notes && (
          <div className="mt-4 rounded-lg border border-border/40 bg-muted/30 p-3 text-sm whitespace-pre-wrap">
            {application.notes}
          </div>
        )}

        {application.job_description && (
          <details className="mt-4 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Job description</summary>
            <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{application.job_description}</p>
          </details>
        )}
      </GlassPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <InterviewRoundsSection applicationId={application.id} rounds={interviewRounds} />
        <HrContactsCard contacts={hrContacts} />
        <div className="space-y-5 lg:col-span-2">
          <NotesPanel
            entityType="application"
            entityId={application.id}
            notes={notes}
            revalidate={`/applications/${application.id}`}
          />
          <StatusHistorySection history={statusHistory} />
        </div>
      </div>
    </div>
  );
}
