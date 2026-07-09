"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { renameResume } from "@/lib/supabase/resumes";
import type { Resume } from "@/lib/types/database";

export function RenameResumeDialog({ resume, onRenamed }: { resume: Resume; onRenamed?: () => void }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [name, setName] = React.useState(resume.display_name);
  const [saving, setSaving] = React.useState(false);

  const handleRename = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await renameResume(resume.id, name.trim());
      toast.success("Resume renamed.");
      setOpen(false);
      onRenamed?.();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Rename failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename resume</DialogTitle>
          <DialogDescription>
            Only the display name changes — the underlying file in storage is never touched, so every application referencing this resume keeps working.
          </DialogDescription>
        </DialogHeader>
        <div>
          <Label className="mb-1.5 block text-xs text-muted-foreground">Display name</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
          {resume.file_extension && (
            <p className="mt-1 text-[11px] text-muted-foreground">
              File extension .{resume.file_extension} is preserved automatically.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleRename} disabled={saving || name.trim() === resume.display_name}>
            {saving ? "Renaming…" : "Rename"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
