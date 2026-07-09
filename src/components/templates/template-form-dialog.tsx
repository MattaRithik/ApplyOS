"use client";

import * as React from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import { createTemplate, updateTemplate, type TemplateInput } from "@/app/(app)/templates/actions";
import { TEMPLATE_CATEGORIES, type EmailTemplate } from "@/lib/types/database";

export function TemplateFormDialog({
  template,
  onSaved,
  trigger,
}: {
  template?: EmailTemplate;
  onSaved?: () => void;
  trigger?: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [values, setValues] = React.useState<TemplateInput>(
    template
      ? { name: template.name, category: template.category, subject: template.subject, body: template.body }
      : { name: "", category: "custom", subject: "", body: "" }
  );

  const set = <K extends keyof TemplateInput>(key: K, v: TemplateInput[K]) =>
    setValues((prev) => ({ ...prev, [key]: v }));

  const handleSave = async () => {
    if (!values.name.trim() || !values.body.trim()) {
      toast.error("Name and body are required.");
      return;
    }
    setSaving(true);
    try {
      if (template) await updateTemplate(template.id, values);
      else await createTemplate(values);
      toast.success(template ? "Template updated." : "Template created.");
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
          <Plus className="h-3.5 w-3.5" /> New Template
        </Button>
      )}
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto scrollbar-thin">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Name *</Label>
            <Input value={values.name} onChange={(e) => set("name", e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Category</Label>
            <Select value={values.category} onValueChange={(v) => set("category", (v ?? "custom") as TemplateInput["category"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {TEMPLATE_CATEGORIES.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Subject line</Label>
            <Input value={values.subject ?? ""} onChange={(e) => set("subject", e.target.value)} placeholder="Leave blank for LinkedIn DMs" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Body *</Label>
            <Textarea rows={10} value={values.body} onChange={(e) => set("body", e.target.value)} className="font-mono text-xs" />
            <p className="mt-1 text-[11px] text-muted-foreground">
              Use placeholders like {"{{first_name}}"}, {"{{company}}"}, {"{{role}}"}.
            </p>
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
