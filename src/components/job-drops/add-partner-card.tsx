"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { listInvitablePeople, addThreadPartner, type InvitablePerson } from "@/app/(app)/job-drops/actions";

export function AddPartnerCard() {
  const router = useRouter();
  const [people, setPeople] = React.useState<InvitablePerson[] | null>(null);
  const [addingId, setAddingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    listInvitablePeople()
      .then(setPeople)
      .catch((err) => toast.error(err instanceof Error ? err.message : "Failed to load people."));
  }, []);

  const handleAdd = async (person: InvitablePerson) => {
    setAddingId(person.id);
    try {
      await addThreadPartner(person.id);
      toast.success(`Added ${person.name} — start posting links.`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add.");
    } finally {
      setAddingId(null);
    }
  };

  return (
    <GlassPanel className="p-5">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <UserPlus className="h-4 w-4 text-[var(--blue-accent)]" /> Add
      </div>
      {people === null && <p className="text-sm text-muted-foreground">Loading accounts…</p>}
      {people?.length === 0 && (
        <p className="text-sm text-muted-foreground">No other ApplyOS accounts yet — ask them to sign up first.</p>
      )}
      {people && people.length > 0 && (
        <ul className="space-y-1.5">
          {people.map((person) => (
            <li key={person.id}>
              <button
                type="button"
                disabled={addingId !== null}
                onClick={() => handleAdd(person)}
                className="flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-left text-sm transition-colors hover:border-[var(--blue-accent)] hover:bg-[var(--blue-accent)]/10 disabled:opacity-50"
              >
                <span className="truncate">{person.name}</span>
                <span className="text-xs text-muted-foreground">
                  {addingId === person.id ? "Adding…" : "Click to add"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </GlassPanel>
  );
}
