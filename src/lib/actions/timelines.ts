"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { planSlotAssignment } from "@/lib/timelines/slots";
import { SYSTEM_TIMELINE_DEFINITIONS } from "@/lib/timelines/resolve";
import type { RollingRule, TimelineCategory, TimelineSource, TimelineType } from "@/lib/types/database";
import { assertAllowedKeys, uuidSchema } from "@/lib/validation/common";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export interface CustomTimelineInput {
  title: string;
  description?: string | null;
  category: TimelineCategory;
  target_date: string;
  icon?: string | null;
}

export async function createCustomTimeline(input: CustomTimelineInput) {
  assertAllowedKeys(input, ["title", "description", "category", "target_date", "icon"]);
  const { supabase, user } = await requireUser();
  if (!input.title.trim()) throw new Error("Title is required.");
  if (input.title.length > 200 || (input.description?.length ?? 0) > 2_000) throw new Error("Timeline text is too long.");
  if (!input.target_date) throw new Error("Target date is required.");

  const { data, error } = await supabase
    .from("user_timelines")
    .insert({
      user_id: user.id,
      title: input.title.trim(),
      description: input.description || null,
      icon: input.icon || null,
      category: input.category,
      timeline_type: "custom",
      target_date: input.target_date,
      source: "user" as TimelineSource,
      is_system_generated: false,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return data;
}

export async function updateCustomTimeline(id: string, input: Partial<CustomTimelineInput>) {
  assertAllowedKeys(input, ["title", "description", "category", "target_date", "icon"]);
  const { supabase, user } = await requireUser();
  uuidSchema.parse(id);
  const { error } = await supabase
    .from("user_timelines")
    .update({
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.description !== undefined ? { description: input.description || null } : {}),
      ...(input.icon !== undefined ? { icon: input.icon || null } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.target_date !== undefined ? { target_date: input.target_date } : {}),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("timeline_type", "custom");
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

const CALCULATED_TYPES: TimelineType[] = [
  "opt_earliest_filing",
  "opt_general_latest_filing",
  "stem_opt_preparation",
  "end_of_month",
  "end_of_quarter",
  "end_of_year",
];
const ROLLING_TYPES: Record<string, RollingRule> = {
  end_of_month: "end_of_month",
  end_of_quarter: "end_of_quarter",
  end_of_year: "end_of_year",
};

/**
 * Creates (or reuses) the `user_timelines` row for a system-generated
 * timeline type and pins it to the given slot. The row never stores a
 * computed target_date — see the column comment in the migration — it
 * exists only to be pinned/labeled; src/lib/timelines/resolve.ts derives
 * the actual date at render time.
 */
export async function selectSystemTimeline(type: TimelineType, slot: 1 | 2 | 3) {
  const { supabase, user } = await requireUser();
  const definition = SYSTEM_TIMELINE_DEFINITIONS.find((d) => d.type === type);
  if (!definition) throw new Error("Unknown system timeline type.");

  const source: TimelineSource = CALCULATED_TYPES.includes(type) ? "calculated" : "profile";

  const { data: existing } = await supabase
    .from("user_timelines")
    .select("id")
    .eq("user_id", user.id)
    .eq("timeline_type", type)
    .is("archived_at", null)
    .maybeSingle();

  let timelineId = existing?.id as string | undefined;

  if (!timelineId) {
    const { data: created, error } = await supabase
      .from("user_timelines")
      .insert({
        user_id: user.id,
        title: definition.label,
        timeline_type: type,
        category: definition.category,
        source,
        rolling_rule: ROLLING_TYPES[type] ?? null,
        is_system_generated: true,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    timelineId = created.id as string;
  }

  await pinTimelineToSlot(timelineId, slot);
  return timelineId;
}

/**
 * Server-side enforcement of "at most 3 pinned timelines, one per slot" —
 * belt to the database's unique-partial-index-and-check-constraint
 * suspenders (see the migration). Never trust the client alone here.
 */
export async function pinTimelineToSlot(timelineId: string, slot: 1 | 2 | 3) {
  const { supabase, user } = await requireUser();
  uuidSchema.parse(timelineId);

  const { data: pinnedRows, error: fetchError } = await supabase
    .from("user_timelines")
    .select("id, dashboard_slot")
    .eq("user_id", user.id)
    .eq("is_pinned", true)
    .is("archived_at", null);
  if (fetchError) throw new Error(fetchError.message);

  const plan = planSlotAssignment(
    (pinnedRows ?? []).filter(
      (r): r is { id: string; dashboard_slot: 1 | 2 | 3 } => r.dashboard_slot !== null
    ),
    timelineId,
    slot
  );
  if (!plan.ok) throw new Error(plan.error ?? "Could not assign this dashboard slot.");

  if (plan.unpinId) {
    const { error } = await supabase
      .from("user_timelines")
      .update({ is_pinned: false, dashboard_slot: null })
      .eq("id", plan.unpinId)
      .eq("user_id", user.id);
    if (error) throw new Error(error.message);
  }

  const { error } = await supabase
    .from("user_timelines")
    .update({ is_pinned: true, dashboard_slot: slot })
    .eq("id", timelineId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

export async function unpinTimeline(timelineId: string) {
  const { supabase, user } = await requireUser();
  uuidSchema.parse(timelineId);
  const { error } = await supabase
    .from("user_timelines")
    .update({ is_pinned: false, dashboard_slot: null })
    .eq("id", timelineId)
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

export async function deleteTimeline(timelineId: string) {
  const { supabase, user } = await requireUser();
  uuidSchema.parse(timelineId);
  const { error } = await supabase.from("user_timelines").delete().eq("id", timelineId).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

/**
 * Slot 1 is reserved for the expected graduation date for international
 * students — it's meant to
 * appear automatically once the date is known, not require a manual "add
 * to dashboard" step. Called after saving an international-student
 * profile; a no-op if slot 1 is already pinned to something.
 */
export async function ensureGraduationSlotPinned() {
  const { supabase, user } = await requireUser();
  const { data: slotOne } = await supabase
    .from("user_timelines")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_pinned", true)
    .eq("dashboard_slot", 1)
    .is("archived_at", null)
    .maybeSingle();
  if (slotOne) return;

  await selectSystemTimeline("i20_program_end", 1);
}
