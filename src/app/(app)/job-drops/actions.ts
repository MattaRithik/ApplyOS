"use server";

import { revalidatePath } from "next/cache";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { fetchAllAuthUsers, isBanned } from "@/lib/admin/users";
import { uuidSchema } from "@/lib/validation/common";

export interface InvitablePerson {
  id: string;
  name: string;
}

/**
 * Everyone with an enabled ApplyOS account, minus the caller, anyone
 * already in a thread (only one thread is supported per person for now),
 * and anyone the owner has disabled. Only id + display name are
 * returned — never email or any other profile field — since this list
 * is shown to any authenticated user picking who to start a Job Drops
 * thread with.
 */
export async function listInvitablePeople(): Promise<InvitablePerson[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const service = createServiceRoleClient();
  const [{ data: profiles, error: profilesError }, { data: paired, error: pairedError }, authUsers] = await Promise.all([
    service.from("profiles").select("id, full_name, email"),
    service.from("link_thread_participants").select("user_id"),
    fetchAllAuthUsers(service),
  ]);
  if (profilesError || pairedError) throw new Error("Failed to load people.");

  const pairedIds = new Set((paired ?? []).map((p) => p.user_id));
  const disabledIds = new Set(authUsers.filter(isBanned).map((u) => u.id));

  return (profiles ?? [])
    .filter((p) => p.id !== user.id && !pairedIds.has(p.id) && !disabledIds.has(p.id as string))
    .map((p) => ({ id: p.id as string, name: (p.full_name as string | null) || (p.email as string | null) || "Unnamed account" }));
}

/**
 * Creates the (single, for now) shared thread between the caller and the
 * given person. Thread + participant rows are written with the
 * service-role client because link_threads/link_thread_participants have
 * no insert policy for `authenticated` — every other write path in this
 * feature goes through RLS directly from the browser client instead.
 */
export async function addThreadPartner(partnerId: string) {
  uuidSchema.parse(partnerId);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (partnerId === user.id) throw new Error("You can't add yourself.");

  const { data: existingMembership } = await supabase
    .from("link_thread_participants")
    .select("thread_id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existingMembership) throw new Error("You already have a shared thread — only one is supported for now.");

  const service = createServiceRoleClient();

  const [{ data: partnerProfile, error: lookupError }, { data: partnerMembership, error: partnerMembershipError }] = await Promise.all([
    service.from("profiles").select("id").eq("id", partnerId).maybeSingle(),
    service.from("link_thread_participants").select("thread_id").eq("user_id", partnerId).maybeSingle(),
  ]);
  if (lookupError || partnerMembershipError) throw new Error("Failed to look up that account.");
  if (!partnerProfile) throw new Error("That account no longer exists.");
  if (partnerMembership) throw new Error("That person already has a shared thread with someone else.");

  const { data: thread, error: threadError } = await service
    .from("link_threads")
    .insert({ created_by: user.id })
    .select("id")
    .single();
  if (threadError || !thread) throw new Error("Failed to create the thread.");

  const { error: participantsError } = await service.from("link_thread_participants").insert([
    { thread_id: thread.id, user_id: user.id },
    { thread_id: thread.id, user_id: partnerId },
  ]);
  if (participantsError) {
    // Leave no orphaned thread behind on failure — including the race
    // where someone else's "Add" beat this one and tripped the unique
    // constraint on user_id (one thread per person).
    await service.from("link_threads").delete().eq("id", thread.id);
    if (participantsError.code === "23505") {
      throw new Error("You or that person just got paired with someone else — refresh and try again.");
    }
    throw new Error("Failed to add participants.");
  }

  revalidatePath("/job-drops");
  return { threadId: thread.id as string };
}

/** Marks the caller's thread as read up to now — drives the sidebar unread badge. */
export async function markJobDropsRead() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("link_thread_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("user_id", user.id);
  if (error) throw new Error(error.message);
}
