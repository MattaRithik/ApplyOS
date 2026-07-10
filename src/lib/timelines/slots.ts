export interface PinnedSlotSummary {
  id: string;
  dashboard_slot: 1 | 2 | 3;
}

export interface SlotAssignmentPlan {
  ok: boolean;
  /** A timeline that currently occupies the target slot and must be unpinned first. */
  unpinId: string | null;
  error?: string;
}

const VALID_SLOTS = [1, 2, 3];

/**
 * Pure planning step for "pin timeline X to slot N", used by the
 * `pinTimelineToSlot` server action before it touches the database. This
 * is a server-side belt to the database's unique-partial-index-and-check-
 * constraint suspenders (see the migration) — the client is never trusted
 * to enforce "max 3 pinned, one per slot" on its own.
 */
export function planSlotAssignment(
  currentlyPinned: PinnedSlotSummary[],
  timelineId: string,
  targetSlot: number
): SlotAssignmentPlan {
  if (!VALID_SLOTS.includes(targetSlot)) {
    return { ok: false, unpinId: null, error: "Dashboard slot must be 1, 2, or 3." };
  }

  const otherPinned = currentlyPinned.filter((t) => t.id !== timelineId);

  // Only 3 slot values exist at all, so "more than 3 pinned" can only ever
  // happen if a caller bypasses this planner — this is the explicit check
  // for that case rather than relying on it being merely impossible.
  const distinctSlotsInUse = new Set(otherPinned.map((t) => t.dashboard_slot));
  if (distinctSlotsInUse.size >= 3 && !distinctSlotsInUse.has(targetSlot as 1 | 2 | 3)) {
    return { ok: false, unpinId: null, error: "All three dashboard timeline slots are already in use." };
  }

  const occupant = otherPinned.find((t) => t.dashboard_slot === targetSlot);
  return { ok: true, unpinId: occupant?.id ?? null };
}
