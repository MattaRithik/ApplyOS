"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createContact, updateContact, type ContactInput } from "@/app/(app)/contacts/actions";
import { RELATIONSHIP_TYPES, type Contact } from "@/lib/types/database";

const NONE = "__none__";

interface ContactFormDialogProps {
  contact?: Contact;
  companyOptions: { id: string; name: string }[];
  onSaved?: () => void;
  trigger?: React.ReactNode;
}

export function ContactFormDialog({ contact, companyOptions, onSaved, trigger }: ContactFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [values, setValues] = React.useState<ContactInput>(
    contact
      ? {
          name: contact.name,
          company_id: contact.company_id,
          company_name: contact.company_name,
          role_title: contact.role_title,
          email: contact.email,
          linkedin_url: contact.linkedin_url,
          phone: contact.phone,
          relationship_type: contact.relationship_type,
          source: contact.source,
          last_contacted_date: contact.last_contacted_date,
          next_follow_up_date: contact.next_follow_up_date,
          response_status: contact.response_status,
          notes: contact.notes,
        }
      : {
          name: "",
          company_id: null,
          company_name: "",
          role_title: "",
          email: "",
          linkedin_url: "",
          phone: "",
          relationship_type: "recruiter",
          source: "",
          last_contacted_date: "",
          next_follow_up_date: "",
          response_status: "no_response",
          notes: "",
        }
  );

  const set = <K extends keyof ContactInput>(key: K, v: ContactInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    if (!values.name.trim()) {
      toast.error("Name is required.");
      return;
    }
    setSaving(true);
    try {
      if (contact) await updateContact(contact.id, values);
      else await createContact(values);
      toast.success(contact ? "Contact updated." : "Contact added.");
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
          {contact ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {contact ? "Edit" : "Add Contact"}
        </Button>
      )}
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{contact ? "Edit contact" : "Add contact"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Name *</Label>
              <Input value={values.name} onChange={(e) => set("name", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Role / title</Label>
              <Input value={values.role_title ?? ""} onChange={(e) => set("role_title", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Company</Label>
              <Select
                value={values.company_id ?? NONE}
                onValueChange={(v) => {
                  const selected = companyOptions.find((c) => c.id === v);
                  set("company_id", v === NONE ? null : v);
                  set("company_name", selected?.name ?? values.company_name);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select company" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {companyOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Relationship type</Label>
              <Select value={values.relationship_type} onValueChange={(v) => set("relationship_type", (v ?? "other") as ContactInput["relationship_type"])}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {RELATIONSHIP_TYPES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
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
              <Label className="mb-1.5 block text-xs text-muted-foreground">Phone (optional)</Label>
              <Input value={values.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">LinkedIn URL</Label>
            <Input value={values.linkedin_url ?? ""} onChange={(e) => set("linkedin_url", e.target.value)} />
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Source</Label>
            <Input
              value={values.source ?? ""}
              onChange={(e) => set("source", e.target.value)}
              placeholder="e.g. LinkedIn, Career fair, Referral"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Last contacted</Label>
              <Input type="date" value={values.last_contacted_date ?? ""} onChange={(e) => set("last_contacted_date", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Next follow-up</Label>
              <Input type="date" value={values.next_follow_up_date ?? ""} onChange={(e) => set("next_follow_up_date", e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Response status</Label>
            <Select value={values.response_status ?? "no_response"} onValueChange={(v) => set("response_status", (v ?? "no_response") as ContactInput["response_status"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="no_response">No response</SelectItem>
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
            <Label className="mb-1.5 block text-xs text-muted-foreground">Notes</Label>
            <Textarea rows={3} value={values.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
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
