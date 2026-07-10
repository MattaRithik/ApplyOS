"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, FileText, Eye, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { GlassPanel } from "@/components/shared/glass-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { RenameResumeDialog } from "@/components/resumes/rename-resume-dialog";
import { getResumeDownloadUrl, deleteResume } from "@/lib/supabase/resumes";
import { updateResumeMetadata } from "@/app/(app)/resumes/actions";
import { formatFileSize } from "@/lib/utils/resume";
import type { Resume, ApplicationStatus } from "@/lib/types/database";

interface ApplicationRow {
  id: string;
  job_title: string;
  company_name: string;
  status: ApplicationStatus;
  date_applied: string | null;
}

export function ResumeDetailClient({ resume, applications }: { resume: Resume; applications: ApplicationRow[] }) {
  const router = useRouter();
  const [targetRole, setTargetRole] = React.useState(resume.target_role ?? "");
  const [versionNotes, setVersionNotes] = React.useState(resume.version_notes ?? "");
  const [matchScore, setMatchScore] = React.useState(resume.resume_match_score?.toString() ?? "");
  const [keywords, setKeywords] = React.useState((resume.missing_keywords ?? []).join(", "));
  const [saving, setSaving] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const handleSaveMeta = async () => {
    setSaving(true);
    try {
      await updateResumeMetadata(resume.id, {
        target_role: targetRole || null,
        version_notes: versionNotes || null,
        resume_match_score: matchScore ? Number(matchScore) : null,
        missing_keywords: keywords.split(",").map((k) => k.trim()).filter(Boolean),
      });
      toast.success("Resume details saved.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleView = async () => {
    try {
      const url = await getResumeDownloadUrl(resume.id);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't open resume");
    }
  };

  const handleDeleted = () => {
    toast.success("Resume deleted.");
    router.push("/resumes");
  };

  return (
    <div className="space-y-5 py-6">
      <Link href="/resumes" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to resumes
      </Link>

      <GlassPanel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--blue-accent)]/15 text-[var(--blue-accent)]">
              <FileText className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">{resume.display_name}</h1>
              <p className="text-xs uppercase text-muted-foreground">
                {resume.original_file_name} · .{resume.file_extension ?? "file"} · {formatFileSize(resume.file_size)}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={handleView}>
              <Eye className="h-3.5 w-3.5" /> View
            </Button>
            <RenameResumeDialog resume={resume} onRenamed={() => router.refresh()} />
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </Button>
            <ConfirmDeleteDialog
              open={deleteOpen}
              onOpenChange={setDeleteOpen}
              title="Delete resume?"
              itemName={resume.display_name}
              warningText="This permanently removes the file from storage. This can't be undone."
              linkedCount={applications.length}
              linkedLabel={(n) =>
                `This resume is currently linked to ${n} application${n === 1 ? "" : "s"}. Deleting it will remove access to the file from ${n === 1 ? "that application" : "those applications"} — their history is kept.`
              }
              confirmLabel="Delete Resume"
              onConfirm={() => deleteResume(resume.id)}
              onSuccess={handleDeleted}
            />
          </div>
        </div>
      </GlassPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel className="space-y-4 p-5">
          <h2 className="text-sm font-semibold">Version details</h2>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Target role</Label>
            <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. Backend SWE, Quant Analyst" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Version notes</Label>
            <Textarea rows={3} value={versionNotes} onChange={(e) => setVersionNotes(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Resume match score</Label>
              <Input type="number" min={0} max={100} value={matchScore} onChange={(e) => setMatchScore(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Missing keywords (comma-separated)</Label>
            <Textarea rows={2} value={keywords} onChange={(e) => setKeywords(e.target.value)} />
          </div>
          <Button onClick={handleSaveMeta} disabled={saving} size="sm">
            {saving ? "Saving…" : "Save details"}
          </Button>
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 text-sm font-semibold">Applications using this resume ({applications.length})</h2>
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not linked to any applications yet.</p>
          ) : (
            <ul className="space-y-2">
              {applications.map((a) => (
                <li key={a.id}>
                  <Link href={`/applications/${a.id}`} className="flex items-center justify-between rounded-lg border border-border/40 p-2.5 text-sm hover:bg-accent/40">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{a.job_title}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.company_name}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
