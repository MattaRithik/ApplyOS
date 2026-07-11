import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { uuidSchema } from "@/lib/validation/common";

export const OWNED_ENTITY_TABLES = {
  application: "applications",
  company: "companies",
  contact: "contacts",
  outreach: "outreach",
  interview_round: "interview_rounds",
  resume: "resumes",
  email_template: "email_templates",
} as const;

export type OwnedEntityType = keyof typeof OWNED_ENTITY_TABLES;

export async function assertOwnedEntity(
  supabase: SupabaseClient,
  userId: string,
  entityType: OwnedEntityType,
  entityId: string
): Promise<void> {
  const parsedId = uuidSchema.safeParse(entityId);
  if (!parsedId.success) throw new Error("Invalid record id.");

  const { data, error } = await supabase
    .from(OWNED_ENTITY_TABLES[entityType])
    .select("id")
    .eq("id", parsedId.data)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) throw new Error("Record not found.");
}

export async function assertOptionalOwnedEntity(
  supabase: SupabaseClient,
  userId: string,
  entityType: OwnedEntityType,
  entityId: string | null | undefined
): Promise<void> {
  if (entityId) await assertOwnedEntity(supabase, userId, entityType, entityId);
}
