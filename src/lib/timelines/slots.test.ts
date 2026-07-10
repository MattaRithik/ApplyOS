import { describe, expect, it } from "vitest";
import { planSlotAssignment } from "@/lib/timelines/slots";

describe("planSlotAssignment", () => {
  it("allows pinning into an empty slot with nothing to unpin", () => {
    const plan = planSlotAssignment([], "t1", 1);
    expect(plan.ok).toBe(true);
    expect(plan.unpinId).toBeNull();
  });

  it("rejects a slot outside 1-3", () => {
    const plan = planSlotAssignment([], "t1", 4);
    expect(plan.ok).toBe(false);
    expect(plan.error).toMatch(/1, 2, or 3/);
  });

  it("resolves a duplicate-slot conflict by planning to unpin the current occupant", () => {
    const pinned = [{ id: "existing", dashboard_slot: 2 as const }];
    const plan = planSlotAssignment(pinned, "new", 2);
    expect(plan.ok).toBe(true);
    expect(plan.unpinId).toBe("existing");
  });

  it("does not try to unpin a timeline from itself when re-pinning to the same slot", () => {
    const pinned = [{ id: "t1", dashboard_slot: 2 as const }];
    const plan = planSlotAssignment(pinned, "t1", 2);
    expect(plan.ok).toBe(true);
    expect(plan.unpinId).toBeNull();
  });

  it("allows moving a timeline from one slot to another empty slot", () => {
    const pinned = [{ id: "t1", dashboard_slot: 1 as const }];
    const plan = planSlotAssignment(pinned, "t1", 3);
    expect(plan.ok).toBe(true);
    expect(plan.unpinId).toBeNull();
  });

  it("enforces the three-card maximum when all three slots are taken by other timelines", () => {
    const pinned = [
      { id: "a", dashboard_slot: 1 as const },
      { id: "b", dashboard_slot: 2 as const },
      { id: "c", dashboard_slot: 3 as const },
    ];
    // A 4th distinct timeline cannot be pinned without first freeing a slot —
    // planSlotAssignment is asked to place "d" into slot 1, which is occupied
    // by "a", so this actually succeeds as a *replacement* of "a".
    const replace = planSlotAssignment(pinned, "d", 1);
    expect(replace.ok).toBe(true);
    expect(replace.unpinId).toBe("a");
  });

  it("rejects an attempt to occupy a 4th slot value when 3 distinct slots are already in use", () => {
    // Defensive case: dashboard_slot values are constrained to 1-3 by the
    // type system and the DB check constraint, but the planner still
    // guards against a caller passing an out-of-range value combined with
    // an already-full board.
    const pinned = [
      { id: "a", dashboard_slot: 1 as const },
      { id: "b", dashboard_slot: 2 as const },
      { id: "c", dashboard_slot: 3 as const },
    ];
    const plan = planSlotAssignment(pinned, "d", 5);
    expect(plan.ok).toBe(false);
  });
});
