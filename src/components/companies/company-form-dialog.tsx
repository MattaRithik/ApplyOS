"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { createCompany, updateCompany, type CompanyInput } from "@/app/(app)/companies/actions";
import type { Company } from "@/lib/types/database";

interface CompanyFormDialogProps {
  company?: Company;
  onSaved?: (company: Company) => void;
  trigger?: React.ReactNode;
}

const EMPTY: CompanyInput = {
  name: "",
  website: "",
  careers_page_url: "",
  industry: "",
  location: "",
  linkedin_url: "",
  sponsorship_friendly: null,
  sponsorship_notes: "",
  notes: "",
};

export function CompanyFormDialog({ company, onSaved, trigger }: CompanyFormDialogProps) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [values, setValues] = React.useState<CompanyInput>(
    company
      ? {
          name: company.name,
          website: company.website,
          careers_page_url: company.careers_page_url,
          industry: company.industry,
          location: company.location,
          linkedin_url: company.linkedin_url,
          sponsorship_friendly: company.sponsorship_friendly,
          sponsorship_notes: company.sponsorship_notes,
          notes: company.notes,
        }
      : EMPTY
  );

  const set = <K extends keyof CompanyInput>(key: K, v: CompanyInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    if (!values.name.trim()) {
      toast.error("Company name is required.");
      return;
    }
    setSaving(true);
    try {
      const result = company ? await updateCompany(company.id, values) : await createCompany(values);
      toast.success(company ? "Company updated." : "Company added.");
      setOpen(false);
      onSaved?.(result);
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
          {company ? <Pencil className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {company ? "Edit" : "Add Company"}
        </Button>
      )}
      <DialogContent className="max-h-[85vh] sm:max-w-lg overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{company ? "Edit company" : "Add company"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Company name *</Label>
            <Input value={values.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Website</Label>
              <Input value={values.website ?? ""} onChange={(e) => set("website", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Careers page</Label>
              <Input value={values.careers_page_url ?? ""} onChange={(e) => set("careers_page_url", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Industry</Label>
              <Input value={values.industry ?? ""} onChange={(e) => set("industry", e.target.value)} />
            </div>
            <div>
              <Label className="mb-1.5 block text-xs text-muted-foreground">Location</Label>
              <Input value={values.location ?? ""} onChange={(e) => set("location", e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">LinkedIn company URL</Label>
            <Input value={values.linkedin_url ?? ""} onChange={(e) => set("linkedin_url", e.target.value)} />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2">
            <Label className="text-xs">Sponsorship friendly</Label>
            <Switch
              checked={values.sponsorship_friendly ?? false}
              onCheckedChange={(v) => set("sponsorship_friendly", v)}
            />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Sponsorship notes</Label>
            <Textarea rows={2} value={values.sponsorship_notes ?? ""} onChange={(e) => set("sponsorship_notes", e.target.value)} />
          </div>
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
