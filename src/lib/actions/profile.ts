"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ensureGraduationSlotPinned } from "@/lib/actions/timelines";
import type { UserCategory } from "@/lib/types/database";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return { supabase, user };
}

export async function updateUserCategory(category: UserCategory) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ user_category: category }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

export async function completeOnboarding() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_status: "completed", onboarding_completed_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

export async function skipOnboarding() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_status: "skipped", onboarding_skipped_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
}

/** "Rerun onboarding" from Settings — re-opens the modal without touching any previously saved answers. */
export async function reopenOnboarding() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({ onboarding_status: "not_started" }).eq("id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

export interface InternationalStudentProfileInput {
  expected_graduation_date?: string | null;
}

export async function upsertInternationalStudentProfile(input: InternationalStudentProfileInput) {
  const { supabase, user } = await requireUser();
  const { data, error } = await supabase
    .from("international_student_profiles")
    .upsert({ user_id: user.id, ...input }, { onConflict: "user_id" })
    .select()
    .single();
  if (error) throw new Error(error.message);

  if (data.expected_graduation_date) {
    // Best-effort — a failure here shouldn't roll back the profile save.
    await ensureGraduationSlotPinned().catch(() => {});
  }

  revalidatePath("/dashboard");
  revalidatePath("/settings");
  return data;
}

/** Hides immigration features/cards without deleting any saved dates. */
export async function setInternationalModeEnabled(enabled: boolean) {
  const { supabase, user } = await requireUser();
  const { error } = await supabase
    .from("international_student_profiles")
    .update({ enabled })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}

export async function deleteInternationalStudentProfile() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("international_student_profiles").delete().eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/dashboard");
  revalidatePath("/settings");
}
