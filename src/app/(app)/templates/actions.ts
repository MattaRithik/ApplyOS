"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { TemplateCategory } from "@/lib/types/database";
import { DEFAULT_TEMPLATES } from "@/lib/data/default-templates";
import { assertAllowedKeys, uuidSchema } from "@/lib/validation/common";

const TEMPLATE_INPUT_KEYS = ["name", "category", "subject", "body"] as const;

function validateTemplate(input: Partial<TemplateInput>, requireFields = false) {
  if ((requireFields || input.name !== undefined) && (!input.name?.trim() || input.name.length > 200)) throw new Error("Invalid template name.");
  if ((requireFields || input.body !== undefined) && (input.body === undefined || input.body.length > 20_000)) throw new Error("Invalid template body.");
  if (input.subject && input.subject.length > 500) throw new Error("Template subject is too long.");
}

export interface TemplateInput {
  name: string;
  category: TemplateCategory;
  subject?: string | null;
  body: string;
}

export async function createTemplate(input: TemplateInput) {
  assertAllowedKeys(input, TEMPLATE_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  validateTemplate(input, true);

  const { data, error } = await supabase
    .from("email_templates")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/templates");
  return data;
}

export async function updateTemplate(id: string, input: Partial<TemplateInput>) {
  assertAllowedKeys(input, TEMPLATE_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);
  validateTemplate(input);

  const { data, error } = await supabase
    .from("email_templates")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/templates");
  return data;
}

export async function deleteTemplate(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);

  const { error } = await supabase.from("email_templates").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/templates");
}

export async function seedDefaultTemplates() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const rows = DEFAULT_TEMPLATES.map((t) => ({
    user_id: user.id,
    name: t.name,
    category: t.category,
    subject: t.subject || null,
    body: t.body,
    is_system_default: true,
  }));

  const { error } = await supabase.from("email_templates").insert(rows);
  if (error) throw new Error(error.message);
  revalidatePath("/templates");
}
