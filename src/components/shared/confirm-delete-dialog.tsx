"use client";

import * as React from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
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

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** Name of the specific item being deleted, rendered as "You are about to delete “X”." */
  itemName?: string;
  /** Overrides the default itemName sentence entirely. */
  description?: string;
  /** Extra explanatory text shown below the description, outside the linked-count callout. */
  warningText?: React.ReactNode;
  /** Number of other records that reference this item. Renders an amber callout when > 0. */
  linkedCount?: number;
  linkedLabel?: (count: number) => string;
  cancelLabel?: string;
  confirmLabel?: string;
  /** Called on confirm. Throw (or reject) to keep the dialog open and show the error. */
  onConfirm: () => Promise<void> | void;
  /** Called after onConfirm resolves successfully, once the dialog has closed. */
  onSuccess?: () => void;
}

/**
 * Single reusable destructive-action confirmation dialog. Owns its own
 * loading/error state so every delete flow in the app gets the same
 * guarantees: no double-submits, no accidental close mid-request, and a
 * visible error (instead of a silently-reopened item) if the delete fails.
 */
export function ConfirmDeleteDialog({
  open,
  onOpenChange,
  title = "Delete this item?",
  itemName,
  description,
  warningText,
  linkedCount,
  linkedLabel,
  cancelLabel = "Cancel",
  confirmLabel = "Delete",
  onConfirm,
  onSuccess,
}: ConfirmDeleteDialogProps) {
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (loading) return; // never let escape / outside-click / cancel interrupt an in-flight delete
    // Clear any stale error from a previous attempt so the next open starts clean.
    setError(null);
    onOpenChange(next);
  };

  const handleConfirm = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      await onConfirm();
      setLoading(false);
      onOpenChange(false);
      onSuccess?.();
    } catch (e) {
      setLoading(false);
      setError(e instanceof Error ? e.message : "Delete failed. Please try again.");
    }
  };

  const hasLinkedWarning = (linkedCount ?? 0) > 0;

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>
            {description
              ? description
              : itemName
                ? <>You are about to delete &ldquo;{itemName}&rdquo;.</>
                : "This action cannot be undone."}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {warningText && <p className="text-xs text-muted-foreground">{warningText}</p>}

        {hasLinkedWarning && (
          <div className="flex items-start gap-2 rounded-lg border border-[var(--amber-accent)]/30 bg-[var(--amber-accent)]/10 p-2.5 text-xs text-[var(--amber-accent)]">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>
              {linkedLabel
                ? linkedLabel(linkedCount!)
                : `This is currently linked to ${linkedCount} record${linkedCount === 1 ? "" : "s"}.`}
            </p>
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs font-medium text-destructive">
            {error}
          </p>
        )}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={loading}
            className="gap-1.5 bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {loading ? "Deleting…" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
