"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { RelationshipType, ResponseStatus } from "@/lib/types/database";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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

  const { error } = await supabase.from("contacts").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/contacts");
}
