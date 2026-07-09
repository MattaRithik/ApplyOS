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
  Mail,
  Link2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { APPLICATION_STATUSES, type ApplicationStatus, type InterviewRound, type Note, type ApplicationStatusHistory } from "@/lib/types/database";
import { deleteApplication, updateApplicationStatus } from "@/app/(app)/applications/actions";
import { EditApplicationDialog } from "@/components/applications/detail/edit-application-dialog";
import { InterviewRoundsSection } from "@/components/applications/detail/interview-rounds-section";
import { NotesPanel } from "@/components/shared/notes-panel";
import { StatusHistorySection } from "@/components/applications/detail/status-history-section";
import type { ApplicationWithResume } from "@/components/applications/types";

interface Props {
  application: ApplicationWithResume;
  resumeOptions: { id: string; display_name: string }[];
  interviewRounds: InterviewRound[];
  statusHistory: ApplicationStatusHistory[];
  notes: Note[];
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

  const handleDelete = async () => {
    try {
      await deleteApplication(application.id);
      toast.success("Application deleted.");
      router.push("/applications");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const salary =
    application.salary_min || application.salary_max
      ? `${application.salary_currency ?? "USD"} ${application.salary_min?.toLocaleString() ?? "?"} – ${application.salary_max?.toLocaleString() ?? "?"}`
      : null;

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
              {application.job_url && (
                <a href={application.job_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
                  <ExternalLink className="h-4 w-4" />
                </a>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Building2 className="h-3.5 w-3.5" /> {application.company_name}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={status} onValueChange={(v) => handleStatusChange((v ?? status) as ApplicationStatus)}>
              <SelectTrigger className="h-8 w-[190px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {APPLICATION_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <EditApplicationDialog application={application} resumeOptions={resumeOptions} onSaved={() => router.refresh()} />
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this application?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This removes the application and its interview rounds, notes, and status history. This can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4">
          <InfoRow icon={MapPin} label="Location" value={[application.location, application.work_mode].filter(Boolean).join(" · ")} />
          <InfoRow icon={FileText} label="Resume" value={application.resume?.display_name} />
          <InfoRow icon={DollarSign} label="Salary" value={salary} />
          <InfoRow icon={User} label="Referral" value={application.referral_person} />
          <InfoRow icon={User} label="Recruiter" value={application.recruiter_name} />
          <InfoRow icon={Mail} label="HR email" value={application.hr_email} />
          <InfoRow
            icon={Link2}
            label="Recruiter LinkedIn"
            value={application.recruiter_linkedin_url && (
              <a href={application.recruiter_linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                View profile
              </a>
            )}
          />
          <InfoRow
            icon={Link2}
            label="Hiring manager"
            value={application.hiring_manager_linkedin_url && (
              <a href={application.hiring_manager_linkedin_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                View profile
              </a>
            )}
          />
          <InfoRow icon={FileText} label="Date applied" value={application.date_applied && format(new Date(application.date_applied), "MMM d, yyyy")} />
          <InfoRow icon={FileText} label="Follow-up" value={application.follow_up_date && format(new Date(application.follow_up_date), "MMM d, yyyy")} />
          <InfoRow icon={FileText} label="Priority" value={`${application.priority_score}/100`} />
          <InfoRow icon={FileText} label="Visa notes" value={application.visa_sponsorship_notes} />
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
        <div className="space-y-5">
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
