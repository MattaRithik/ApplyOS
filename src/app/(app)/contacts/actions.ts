"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RelationshipType, ResponseStatus } from "@/lib/types/database";
import { assertOptionalOwnedEntity } from "@/lib/security/ownership";
import { assertAllowedKeys, optionalHttpUrlSchema, uuidSchema } from "@/lib/validation/common";

const CONTACT_INPUT_KEYS = ["name", "company_id", "company_name", "role_title", "email", "linkedin_url", "phone", "relationship_type", "source", "last_contacted_date", "next_follow_up_date", "response_status", "notes"] as const;

function validateContactInput(input: Partial<ContactInput>) {
  optionalHttpUrlSchema.parse(input.linkedin_url);
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("Invalid email address.");
}

export interface ContactInput {
  name: string;
  company_id?: string | null;
  company_name?: string | null;
  role_title?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  phone?: string | null;
  relationship_type: RelationshipType;
  source?: string | null;
  last_contacted_date?: string | null;
  next_follow_up_date?: string | null;
  response_status?: ResponseStatus;
  notes?: string | null;
}

export async function createContact(input: ContactInput) {
  assertAllowedKeys(input, CONTACT_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await assertOptionalOwnedEntity(supabase, user.id, "company", input.company_id);
  validateContactInput(input);

  const { data, error } = await supabase
    .from("contacts")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/contacts");
  return data;
}

export async function updateContact(id: string, input: Partial<ContactInput>) {
  assertAllowedKeys(input, CONTACT_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);
  await assertOptionalOwnedEntity(supabase, user.id, "company", input.company_id);
  validateContactInput(input);

  const { data, error } = await supabase
    .from("contacts")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/contacts");
  return data;
}

export async function deleteContact(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);

  const { error } = await supabase.from("contacts").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/contacts");
}
