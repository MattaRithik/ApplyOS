"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Trash2, Download, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/shared/glass-panel";
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
import { RenameResumeDialog } from "@/components/resumes/rename-resume-dialog";
import { deleteResume, getResumeDownloadUrl } from "@/lib/supabase/resumes";
import { formatFileSize } from "@/lib/utils/resume";
import type { Resume } from "@/lib/types/database";

interface ResumeWithStats extends Resume {
  applicationCount: number;
  interviewRate: number;
}

export function ResumesGrid({ resumes, bestResumeId }: { resumes: ResumeWithStats[]; bestResumeId: string | null }) {
  const router = useRouter();
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleDownload = async (resume: Resume) => {
    try {
      const url = await getResumeDownloadUrl(resume.id);
      window.open(url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    }
  };

  const handleDelete = async (resume: Resume) => {
    try {
      await deleteResume(resume.id);
      toast.success("Resume deleted.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {resumes.map((r) => (
        <GlassPanel key={r.id} hoverLift className="flex flex-col gap-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <Link href={`/resumes/${r.id}`} className="flex min-w-0 items-center gap-2">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--blue-accent)]/15 text-[var(--blue-accent)]">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{r.display_name}</p>
                <p className="text-xs uppercase text-muted-foreground">
                  .{r.file_extension ?? "file"} · {formatFileSize(r.file_size)}
                </p>
              </div>
            </Link>
            {r.id === bestResumeId && (
              <Badge variant="secondary" className="gap-1 text-[10px]">
                <Trophy className="h-3 w-3 text-[var(--amber-accent)]" /> Best
              </Badge>
            )}
          </div>

          {r.target_role && <p className="text-xs text-muted-foreground">Target: {r.target_role}</p>}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{r.applicationCount} application{r.applicationCount === 1 ? "" : "s"}</span>
            <span>{r.interviewRate}% interview rate</span>
          </div>

          <div className="mt-auto flex items-center justify-between border-t border-border/40 pt-2.5">
            <span className="truncate text-[11px] text-muted-foreground">{r.original_file_name}</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon-sm" onClick={() => handleDownload(r)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
              <RenameResumeDialog resume={r} onRenamed={() => router.refresh()} />
              <AlertDialog open={deletingId === r.id} onOpenChange={(o) => setDeletingId(o ? r.id : null)}>
                <Button variant="ghost" size="icon-sm" onClick={() => setDeletingId(r.id)}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this resume?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This removes the file from storage. Applications that used it will keep their history but lose the resume link.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(r)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </GlassPanel>
      ))}
    </div>
  );
}
