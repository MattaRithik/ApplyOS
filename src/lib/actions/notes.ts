"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Note } from "@/lib/types/database";

export async function addNote(
  entityType: Note["entity_type"],
  entityId: string,
  body: string,
  revalidate?: string
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: user.id, entity_type: entityType, entity_id: entityId, body })
    .select()
    .single();

  if (error) throw new Error(error.message);
  if (revalidate) revalidatePath(revalidate);
  return data;
}

export async function deleteNote(id: string, revalidate?: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  if (revalidate) revalidatePath(revalidate);
}
