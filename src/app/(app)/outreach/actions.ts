"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OutreachType, ResponseStatus } from "@/lib/types/database";
import { assertOptionalOwnedEntity } from "@/lib/security/ownership";
import { assertAllowedKeys, optionalHttpUrlSchema, uuidSchema } from "@/lib/validation/common";

const OUTREACH_INPUT_KEYS = ["contact_id", "company_id", "application_id", "template_id", "person_name", "company_name", "email", "linkedin_url", "outreach_type", "subject_line", "message_sent", "date_sent", "follow_up_date", "response_received", "response_type", "response_date", "notes"] as const;

async function validateRelations(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, input: Partial<OutreachInput>) {
  optionalHttpUrlSchema.parse(input.linkedin_url);
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error("Invalid email address.");
  await Promise.all([
    assertOptionalOwnedEntity(supabase, userId, "contact", input.contact_id),
    assertOptionalOwnedEntity(supabase, userId, "company", input.company_id),
    assertOptionalOwnedEntity(supabase, userId, "application", input.application_id),
    assertOptionalOwnedEntity(supabase, userId, "email_template", input.template_id),
  ]);
}

export interface OutreachInput {
  contact_id?: string | null;
  company_id?: string | null;
  application_id?: string | null;
  template_id?: string | null;
  person_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  linkedin_url?: string | null;
  outreach_type: OutreachType;
  subject_line?: string | null;
  message_sent?: string | null;
  date_sent: string;
  follow_up_date?: string | null;
  response_received?: boolean;
  response_type?: ResponseStatus | null;
  response_date?: string | null;
  notes?: string | null;
}

export async function createOutreach(input: OutreachInput) {
  assertAllowedKeys(input, OUTREACH_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  await validateRelations(supabase, user.id, input);

  const { data, error } = await supabase
    .from("outreach")
    .insert({ ...input, user_id: user.id })
    .select()
    .single();

  if (error) throw new Error(error.message);

  revalidatePath("/outreach");
  revalidatePath("/dashboard");
  return data;
}

export async function updateOutreach(id: string, input: Partial<OutreachInput>) {
  assertAllowedKeys(input, OUTREACH_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);
  await validateRelations(supabase, user.id, input);

  const { data, error } = await supabase
    .from("outreach")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/outreach");
  revalidatePath("/dashboard");
  return data;
}

export async function deleteOutreach(id: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);

  const { error } = await supabase.from("outreach").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/outreach");
  revalidatePath("/dashboard");
}
