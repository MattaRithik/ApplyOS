"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { StickyNote, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GlassPanel } from "@/components/shared/glass-panel";
import { ConfirmDeleteDialog } from "@/components/shared/confirm-delete-dialog";
import { addNote, deleteNote } from "@/lib/actions/notes";
import type { Note } from "@/lib/types/database";

export function NotesPanel({
  entityType,
  entityId,
  notes,
  revalidate,
}: {
  entityType: Note["entity_type"];
  entityId: string;
  notes: Note[];
  revalidate: string;
}) {
  const router = useRouter();
  const [text, setText] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<string | null>(null);

  const handleAdd = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      await addNote(entityType, entityId, text.trim(), revalidate);
      setText("");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add note");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleted = () => {
    router.refresh();
  };

  const deletingNote = notes.find((n) => n.id === deletingId) ?? null;
  const deletingNotePreview = deletingNote
    ? deletingNote.body.length > 60
      ? `${deletingNote.body.slice(0, 60)}…`
      : deletingNote.body
    : undefined;

  return (
    <GlassPanel className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <StickyNote className="h-4 w-4 text-[var(--blue-accent)]" /> Notes
      </h2>
      <div className="mb-4 flex gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add a note…"
          rows={2}
          className="text-sm"
        />
        <Button onClick={handleAdd} disabled={saving || !text.trim()} className="self-end">
          Add
        </Button>
      </div>
      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No notes yet.</p>
      ) : (
        <ul className="space-y-2.5">
          {notes.map((n) => (
            <li key={n.id} className="flex items-start justify-between gap-2 rounded-lg border border-border/40 p-2.5 text-sm">
              <div>
                <p className="whitespace-pre-wrap">{n.body}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {format(new Date(n.created_at), "MMM d, yyyy h:mm a")}
                </p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => setDeletingId(n.id)} aria-label="Delete note">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDeleteDialog
        open={deletingId !== null}
        onOpenChange={(o) => setDeletingId(o ? deletingId : null)}
        title="Delete this note?"
        itemName={deletingNotePreview}
        confirmLabel="Delete Note"
        onConfirm={() => deleteNote(deletingId!, revalidate)}
        onSuccess={handleDeleted}
      />
    </GlassPanel>
  );
}
