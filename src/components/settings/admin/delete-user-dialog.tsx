"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import type { AdminUserSummary } from "@/lib/admin/users";

export function DeleteUserDialog({ user, disabled, onDeleted, onBusyChange }: {
  user: AdminUserSummary;
  disabled?: boolean;
  onDeleted: () => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [step, setStep] = React.useState(1);
  const [confirmation, setConfirmation] = React.useState("");
  const [acknowledged, setAcknowledged] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputId = React.useId();
  const checkboxId = React.useId();
  const expected = user.email || user.id;

  const deleteUser = async () => {
    if (busy || !acknowledged || confirmation.trim() !== expected) return;
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: true, acknowledgeDataLoss: true, confirmation: confirmation.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to delete account.");
      toast.success("Account permanently deleted.");
      if (json.warning) toast.warning(json.warning);
      setOpen(false);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete account.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  };

  if (!user.banned || user.role === "owner") return null;

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => {
      if (busy) return;
      setOpen(nextOpen);
      if (nextOpen) {
        setStep(1);
        setConfirmation("");
        setAcknowledged(false);
        setError(null);
      }
    }}>
      <AlertDialogTrigger render={<Button size="sm" variant="destructive" disabled={disabled} />}>
        Delete account
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{step === 1 ? "Are you sure you want to delete this account?" : "Permanently delete this account?"}</AlertDialogTitle>
          <AlertDialogDescription>
            {step === 1
              ? `You are deleting ${user.displayName ? `${user.displayName} (${expected})` : expected}. This disabled account will be removed from the user list and total count.`
              : "This removes the account, its applications, resume files, and AI access and usage records. This cannot be undone. Administrative audit records are retained."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Checkbox id={checkboxId} checked={acknowledged} onCheckedChange={setAcknowledged} disabled={busy} />
              <Label htmlFor={checkboxId} className="text-sm">I understand that this account and its data will be permanently deleted.</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor={inputId} className="block break-all">Type {expected} to confirm</Label>
              <Input id={inputId} value={confirmation} onChange={(e) => setConfirmation(e.target.value)}
                autoComplete="off" spellCheck={false} disabled={busy} />
            </div>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          {step === 1 ? (
            <Button onClick={() => setStep(2)}>Continue</Button>
          ) : (
            <Button variant="destructive" disabled={busy || !acknowledged || confirmation.trim() !== expected} onClick={deleteUser}>
              {busy ? "Deleting…" : "Permanently delete"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
