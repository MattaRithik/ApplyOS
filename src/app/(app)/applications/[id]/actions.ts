"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { InterviewRoundType, InterviewResult } from "@/lib/types/database";
import { assertOwnedEntity } from "@/lib/security/ownership";
import { assertAllowedKeys, optionalHttpUrlSchema, uuidSchema } from "@/lib/validation/common";

const INTERVIEW_INPUT_KEYS = [
  "round_name", "round_type", "scheduled_at", "interviewer_name", "interviewer_linkedin_url", "interviewer_email",
  "meeting_link", "preparation_notes", "questions_asked", "result", "follow_up_sent", "thank_you_email_sent",
] as const;

function validateInterviewInput(input: Partial<InterviewRoundInput>) {
  optionalHttpUrlSchema.parse(input.interviewer_linkedin_url);
  optionalHttpUrlSchema.parse(input.meeting_link);
  if (input.interviewer_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.interviewer_email)) throw new Error("Invalid interviewer email.");
}

export interface InterviewRoundInput {
  round_name: string;
  round_type: InterviewRoundType;
  scheduled_at?: string | null;
  interviewer_name?: string | null;
  interviewer_linkedin_url?: string | null;
  interviewer_email?: string | null;
  meeting_link?: string | null;
  preparation_notes?: string | null;
  questions_asked?: string | null;
  result?: InterviewResult;
  follow_up_sent?: boolean;
  thank_you_email_sent?: boolean;
}

export async function addInterviewRound(applicationId: string, input: InterviewRoundInput) {
  assertAllowedKeys(input, INTERVIEW_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(applicationId);
  await assertOwnedEntity(supabase, user.id, "application", applicationId);
  validateInterviewInput(input);

  const { data, error } = await supabase
    .from("interview_rounds")
    .insert({ ...input, user_id: user.id, application_id: applicationId })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/interviews");
  revalidatePath("/dashboard");
  return data;
}

export async function updateInterviewRound(
  id: string,
  applicationId: string,
  input: Partial<InterviewRoundInput>
) {
  assertAllowedKeys(input, INTERVIEW_INPUT_KEYS);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);
  uuidSchema.parse(applicationId);
  await assertOwnedEntity(supabase, user.id, "application", applicationId);
  validateInterviewInput(input);

  const { error } = await supabase
    .from("interview_rounds")
    .update(input)
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/interviews");
}

export async function deleteInterviewRound(id: string, applicationId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(id);
  uuidSchema.parse(applicationId);
  await assertOwnedEntity(supabase, user.id, "application", applicationId);

  const { error } = await supabase.from("interview_rounds").delete().eq("id", id).eq("user_id", user.id);
  if (error) throw new Error(error.message);
  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/interviews");
}
