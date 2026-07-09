"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createOutreach, updateOutreach, type OutreachInput } from "@/app/(app)/outreach/actions";
import { OUTREACH_TYPES, type Outreach } from "@/lib/types/database";
import { format } from "date-fns";

const NONE = "__none__";

interface OutreachFormDialogProps {
  outreach?: Outreach;
  contactOptions: { id: string; name: string; company_name: string | null; email: string | null; linkedin_url: string | null }[];
  companyOptions: { id: string; name: string }[];
  templateOptions: { id: string; name: string }[];
  onSaved?: () => void;
  trigger?: React.ReactNode;
}

export function OutreachFormDialog({
  outreach,
  contactOptions,
  companyOptions,
  templateOptions,
  onSaved,
  trigger,
}: OutreachFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [values, setValues] = React.useState<OutreachInput>(
    outreach
      ? {
          contact_id: outreach.contact_id,
          company_id: outreach.company_id,
          application_id: outreach.application_id,
          template_id: outreach.template_id,
          person_name: outreach.person_name,
          company_name: outreach.company_name,
          email: outreach.email,
          linkedin_url: outreach.linkedin_url,
          outreach_type: outreach.outreach_type,
          subject_line: outreach.subject_line,
          message_sent: outreach.message_sent,
          date_sent: outreach.date_sent,
          follow_up_date: outreach.follow_up_date,
          response_received: outreach.response_received,
          response_type: outreach.response_type,
          response_date: outreach.response_date,
          notes: outreach.notes,
        }
      : {
          contact_id: null,
          company_id: null,
          template_id: null,
          person_name: "",
          company_name: "",
          email: "",
          linkedin_url: "",
          outreach_type: "cold_email",
          subject_line: "",
          message_sent: "",
          date_sent: format(new Date(), "yyyy-MM-dd"),
          follow_up_date: "",
          response_received: false,
          notes: "",
        }
  );

  const set = <K extends keyof OutreachInput>(key: K, v: OutreachInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const handleContactSelect = (contactId: string) => {
    if (contactId === NONE) {
      set("contact_id", null);
      return;
    }
    const contact = contactOptions.find((c) => c.id === contactId);
    setValues((prev) => ({
      ...prev,
      contact_id: contactId,
      person_name: contact?.name ?? prev.person_name,
      company_name: contact?.company_name ?? prev.company_name,
      email: contact?.email ?? prev.email,
      linkedin_url: contact?.linkedin_url ?? prev.linkedin_url,
    }));
  };

  const handleSave = async () => {
    if (!values.date_sent) {
      toast.error("Date sent is required.");
      return;
    }
    setSaving(true);
    try {
      if (outreach) await updateOutreach(outreach.id, values);
      else await createOutreach(values);
      toast.success(outreach ? "Outreach updated." : "Outreach logged.");
      setOpen(false);
      onSaved?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button size="sm" className="gap-1.5" onClick={() => setOpen(true)}>
          {outreach ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {outreach ? "Edit" : "Log Outreach"}
        </Button>
      )}
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{outreach ? "Edit outreach" : "Log cold outreach"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Existing contact</Label>
            <Select value={values.contact_id ?? NONE} onValueChange={(v) => handleContactSelect(v ?? NONE)}>
              <SelectTrigger><SelectValue placeholder="Pick a saved contact (optional)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>New / one-off contact</SelectItem>
                {contactOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}{c.company_name ? ` · ${c.company_name}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Person name</Label>
              <Input value={values.person_name ?? ""} onChange={(e) => set("person_name", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Company</Label>
              <Select
                value={values.company_id ?? NONE}
                onValueChange={(v) => {
                  const c = companyOptions.find((co) => co.id === v);
                  set("company_id", v === NONE ? null : v);
                  set("company_name", c?.name ?? values.company_name);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {companyOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Email</Label>
              <Input value={values.email ?? ""} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">LinkedIn</Label>
              <Input value={values.linkedin_url ?? ""} onChange={(e) => set("linkedin_url", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Outreach type</Label>
              <Select value={values.outreach_type} onValueChange={(v) => set("outreach_type", (v ?? "cold_email") as OutreachInput["outreach_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {OUTREACH_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Template used</Label>
              <Select value={values.template_id ?? NONE} onValueChange={(v) => set("template_id", v === NONE ? null : v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {templateOptions.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Subject line</Label>
            <Input value={values.subject_line ?? ""} onChange={(e) => set("subject_line", e.target.value)} />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Message sent</Label>
            <Textarea rows={3} value={values.message_sent ?? ""} onChange={(e) => set("message_sent", e.target.value)} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Date sent *</Label>
              <Input type="date" value={values.date_sent} onChange={(e) => set("date_sent", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Follow-up date</Label>
              <Input type="date" value={values.follow_up_date ?? ""} onChange={(e) => set("follow_up_date", e.target.value)} />
            </div>
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={values.response_received ?? false} onCheckedChange={(v) => set("response_received", !!v)} />
            Response received
          </label>

          {values.response_received && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">Response type</Label>
                <Select value={values.response_type ?? "opened"} onValueChange={(v) => set("response_type", (v ?? "opened") as OutreachInput["response_type"])}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opened">Opened</SelectItem>
                    <SelectItem value="replied_positive">Replied — positive</SelectItem>
                    <SelectItem value="replied_negative">Replied — negative</SelectItem>
                    <SelectItem value="referred">Referred</SelectItem>
                    <SelectItem value="meeting_scheduled">Meeting scheduled</SelectItem>
                    <SelectItem value="declined">Declined</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-muted-foreground">Response date</Label>
                <Input type="date" value={values.response_date ?? ""} onChange={(e) => set("response_date", e.target.value)} />
              </div>
            </div>
          )}

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Notes</Label>
            <Textarea rows={2} value={values.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
