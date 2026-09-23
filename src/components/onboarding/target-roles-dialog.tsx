"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateProfile } from "@/app/(app)/settings/actions";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export function TargetRolesDialog({ open, onDone }: { open: boolean; onDone: () => void }) {
  const [roles, setRoles] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const router = useRouter();
  async function save(skip = false) {
    if (saving) return;
    setSaving(true);
    try {
      await updateProfile({ target_role: skip ? "" : roles });
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save target roles. Try again.");
    } finally { setSaving(false); }
  }
  return <Dialog open={open} onOpenChange={() => {}}>
    <DialogContent className="sm:max-w-lg" showCloseButton={false}>
      <DialogTitle>Which roles are you targeting?</DialogTitle>
      <DialogDescription>Use a few basic words, such as Risk, Credit Risk, Market Risk, or Model Validation. The AI parser compares each job with your targets to suggest a priority score for future follow-ups.</DialogDescription>
      <div className="space-y-2">
        <Label htmlFor="target-roles">Target roles</Label>
        <Input id="target-roles" value={roles} onChange={(event) => setRoles(event.target.value)} maxLength={1000} placeholder="Credit Risk, Market Risk, Model Validation" disabled={saving} />
        <p className="text-xs text-muted-foreground">Asked only once. Separate up to 15 short role names with commas. This only guides priority, not eligibility. Edit these anytime in Settings → Profile.</p>
      </div>
      <DialogFooter>
        <Button variant="ghost" disabled={saving} onClick={() => void save(true)}>Skip</Button>
        <Button disabled={saving || !roles.trim()} onClick={() => void save()}>{saving ? "Saving…" : "Save target roles"}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
