"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { CalendarClock, Plus, Trash2, User, Link as LinkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { INTERVIEW_ROUND_TYPES, INTERVIEW_RESULTS, type InterviewRound, type InterviewResult } from "@/lib/types/database";
import { addInterviewRound, deleteInterviewRound, updateInterviewRound } from "@/app/(app)/applications/[id]/actions";

const RESULT_STYLES: Record<InterviewResult, string> = {
  pending: "bg-muted text-muted-foreground",
  passed: "bg-[var(--emerald-accent)]/15 text-[var(--emerald-accent)]",
  failed: "bg-destructive/10 text-destructive",
  cancelled: "bg-muted text-muted-foreground",
  no_show: "bg-destructive/10 text-destructive",
};

const EMPTY_ROUND = {
  round_name: "",
  round_type: "first_round" as const,
  scheduled_at: "",
  interviewer_name: "",
  interviewer_linkedin_url: "",
  interviewer_email: "",
  meeting_link: "",
  preparation_notes: "",
  questions_asked: "",
};

export function InterviewRoundsSection({
  applicationId,
  rounds,
}: {
  applicationId: string;
  rounds: InterviewRound[];
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState(EMPTY_ROUND);
  const [saving, setSaving] = React.useState(false);

  const handleAdd = async () => {
    if (!form.round_name) {
      toast.error("Round name is required.");
      return;
    }
    setSaving(true);
    try {
      await addInterviewRound(applicationId, {
        ...form,
        scheduled_at: form.scheduled_at || null,
      });
      toast.success("Interview round added.");
      setForm(EMPTY_ROUND);
      setOpen(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add round");
    } finally {
      setSaving(false);
    }
  };

  const handleResultChange = async (id: string, result: InterviewResult) => {
    try {
      await updateInterviewRound(id, applicationId, { result });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const toggleFlag = async (round: InterviewRound, field: "follow_up_sent" | "thank_you_email_sent") => {
    try {
      await updateInterviewRound(round.id, applicationId, { [field]: !round[field] });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Update failed");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteInterviewRound(id, applicationId);
      toast.success("Round removed.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <GlassPanel className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <CalendarClock className="h-4 w-4 text-[var(--amber-accent)]" /> Interview rounds
        </h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Add round
          </Button>
          <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto scrollbar-thin">
            <DialogHeader>
              <DialogTitle>Add interview round</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Round name *</Label>
                  <Input value={form.round_name} onChange={(e) => setForm({ ...form, round_name: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Round type</Label>
                  <Select
                    items={INTERVIEW_ROUND_TYPES}
                    value={form.round_type}
                    onValueChange={(v) => setForm({ ...form, round_type: (v ?? "other") as typeof form.round_type })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {INTERVIEW_ROUND_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">Date / time</Label>
                <Input
                  type="datetime-local"
                  value={form.scheduled_at}
                  onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Interviewer name</Label>
                  <Input value={form.interviewer_name} onChange={(e) => setForm({ ...form, interviewer_name: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Interviewer email</Label>
                  <Input value={form.interviewer_email} onChange={(e) => setForm({ ...form, interviewer_email: e.target.value })} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Interviewer LinkedIn</Label>
                  <Input value={form.interviewer_linkedin_url} onChange={(e) => setForm({ ...form, interviewer_linkedin_url: e.target.value })} />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-muted-foreground">Meeting link</Label>
                  <Input value={form.meeting_link} onChange={(e) => setForm({ ...form, meeting_link: e.target.value })} />
                </div>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">Preparation notes</Label>
                <Textarea rows={2} value={form.preparation_notes} onChange={(e) => setForm({ ...form, preparation_notes: e.target.value })} />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">Questions asked</Label>
                <Textarea rows={2} value={form.questions_asked} onChange={(e) => setForm({ ...form, questions_asked: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={handleAdd} disabled={saving}>{saving ? "Adding…" : "Add round"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {rounds.length === 0 ? (
        <p className="text-sm text-muted-foreground">No interview rounds yet.</p>
      ) : (
        <div className="space-y-3">
          {rounds.map((round) => (
            <div key={round.id} className="rounded-xl border border-border/50 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{round.round_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {INTERVIEW_ROUND_TYPES.find((t) => t.value === round.round_type)?.label}
                    {round.scheduled_at && ` · ${format(new Date(round.scheduled_at), "MMM d, yyyy h:mm a")}`}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Select
                    items={INTERVIEW_RESULTS}
                    value={round.result}
                    onValueChange={(v) => handleResultChange(round.id, (v ?? "pending") as InterviewResult)}
                  >
                    <SelectTrigger className={`h-7 w-28 text-xs ${RESULT_STYLES[round.result]}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {INTERVIEW_RESULTS.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(round.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>

              {(round.interviewer_name || round.meeting_link) && (
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {round.interviewer_name && (
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {round.interviewer_name}</span>
                  )}
                  {round.meeting_link && (
                    <a href={round.meeting_link} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                      <LinkIcon className="h-3 w-3" /> Meeting link
                    </a>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-4">
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={round.follow_up_sent} onCheckedChange={() => toggleFlag(round, "follow_up_sent")} />
                  Follow-up sent
                </label>
                <label className="flex items-center gap-1.5 text-xs">
                  <Checkbox checked={round.thank_you_email_sent} onCheckedChange={() => toggleFlag(round, "thank_you_email_sent")} />
                  Thank-you sent
                </label>
                <Badge variant="secondary" className="text-[10px]">{round.result}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassPanel>
  );
}
