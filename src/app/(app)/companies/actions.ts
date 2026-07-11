"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertAllowedKeys, optionalHttpUrlSchema, uuidSchema } from "@/lib/validation/common";

const COMPANY_INPUT_KEYS = ["name", "website", "careers_page_url", "industry", "location", "linkedin_url", "sponsorship_friendly", "sponsorship_notes", "notes"] as const;

function validateCompanyUrls(input: Partial<CompanyInput>) {
  optionalHttpUrlSchema.parse(input.website);
  optionalHttpUrlSchema.parse(input.careers_page_url);
  optionalHttpUrlSchema.parse(input.linkedin_url);
}

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
  assertAllowedKeys(input, COMPANY_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  if (!input.name.trim() || input.name.length > 200) throw new Error("Invalid company name.");
  validateCompanyUrls(input);

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
  assertAllowedKeys(input, COMPANY_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);
  if (input.name !== undefined && (!input.name.trim() || input.name.length > 200)) throw new Error("Invalid company name.");
  validateCompanyUrls(input);

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
  uuidSchema.parse(id);

  const { error } = await supabase.from("companies").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/companies");
}
