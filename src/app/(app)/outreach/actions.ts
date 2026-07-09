"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { OutreachType, ResponseStatus } from "@/lib/types/database";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

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

  const { error } = await supabase.from("outreach").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath("/outreach");
  revalidatePath("/dashboard");
}
