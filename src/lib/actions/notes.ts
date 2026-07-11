"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Note } from "@/lib/types/database";
import { assertOwnedEntity, type OwnedEntityType } from "@/lib/security/ownership";
import { uuidSchema } from "@/lib/validation/common";

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
  uuidSchema.parse(entityId);
  if (!body.trim() || body.length > 20_000) throw new Error("Note must be between 1 and 20,000 characters.");
  await assertOwnedEntity(supabase, user.id, entityType as OwnedEntityType, entityId);

  const { data, error } = await supabase
    .from("notes")
    .insert({ user_id: user.id, entity_type: entityType, entity_id: entityId, body: body.trim() })
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
  uuidSchema.parse(id);

  const { error } = await supabase.from("notes").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  if (revalidate) revalidatePath(revalidate);
}
