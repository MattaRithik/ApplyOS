"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface CompanyInput {
  name: string;
  website?: string | null;
  careers_page_url?: string | null;
  industry?: string | null;
  location?: string | null;
  linkedin_url?: string | null;
  sponsorship_friendly?: boolean | null;
  sponsorship_notes?: string | null;
  notes?: string | null;
}

export async function createCompany(input: CompanyInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("companies")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/companies");
  return data;
}

export async function updateCompany(id: string, input: Partial<CompanyInput>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data, error } = await supabase
    .from("companies")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/companies");
  revalidatePath(`/companies/${id}`);
  return data;
}

export async function deleteCompany(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("companies").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/companies");
}
