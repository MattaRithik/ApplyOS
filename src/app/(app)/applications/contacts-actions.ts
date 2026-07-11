"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { HrContactDraft } from "@/components/applications/types";
import { assertOptionalOwnedEntity, assertOwnedEntity } from "@/lib/security/ownership";
import { uuidSchema } from "@/lib/validation/common";

const HR_RELATIONSHIP_TYPES = ["recruiter", "hr", "hiring_manager"] as const;

/**
 * Replaces every HR/recruiter/hiring-manager contact linked to an
 * application with the given list. Contacts created through this form are
 * scoped to the application that created them (not shared/reused from the
 * global Contacts CRM), so a "replace all" is simpler and safer than
 * diffing individual rows — the old contact rows are deleted outright
 * rather than just unlinked, so nothing orphaned is left behind.
 */
export async function saveApplicationHrContacts(
  applicationId: string,
  companyId: string | null,
  companyName: string,
  contacts: HrContactDraft[]
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  uuidSchema.parse(applicationId);
  await assertOwnedEntity(supabase, user.id, "application", applicationId);
  await assertOptionalOwnedEntity(supabase, user.id, "company", companyId);
  if (companyName.length > 200 || contacts.length > 25) throw new Error("Invalid contact list.");

  const { data: application } = await supabase
    .from("applications")
    .select("id")
    .eq("id", applicationId)
    .eq("user_id", user.id)
    .single();
  if (!application) throw new Error("Application not found");

  const { data: existingLinks } = await supabase
    .from("application_contacts")
    .select("contact_id, contacts!inner(id, relationship_type)")
    .eq("application_id", applicationId);

  const existingHrContactIds = (existingLinks ?? [])
    .filter((l) => HR_RELATIONSHIP_TYPES.includes((l.contacts as unknown as { relationship_type: string }).relationship_type as never))
    .map((l) => l.contact_id);

  if (existingHrContactIds.length > 0) {
    await supabase.from("contacts").delete().eq("user_id", user.id).in("id", existingHrContactIds);
  }

  const validRows = contacts.filter((c) => c.name.trim().length > 0);

  for (const row of validRows) {
    const { data: contact, error: contactError } = await supabase
      .from("contacts")
      .insert({
        user_id: user.id,
        company_id: companyId,
        company_name: companyName,
        name: row.name.trim(),
        role_title: row.role_title.trim() || null,
        email: row.email.trim() || null,
        phone: row.phone.trim() || null,
        linkedin_url: row.linkedin_url.trim() || null,
        relationship_type: row.relationship_type,
        source: "Application form",
      })
      .select("id")
      .single();

    if (contactError) throw new Error(contactError.message);

    const { error: linkError } = await supabase
      .from("application_contacts")
      .insert({ application_id: applicationId, contact_id: contact.id });

    if (linkError) throw new Error(linkError.message);
  }

  revalidatePath(`/applications/${applicationId}`);
  revalidatePath("/contacts");
}

export async function getApplicationHrContacts(applicationId: string): Promise<HrContactDraft[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  if (!uuidSchema.safeParse(applicationId).success) return [];
  try {
    await assertOwnedEntity(supabase, user.id, "application", applicationId);
  } catch {
    return [];
  }

  const { data } = await supabase
    .from("application_contacts")
    .select("contacts!inner(id, name, role_title, email, phone, linkedin_url, relationship_type, user_id)")
    .eq("application_id", applicationId);

  type JoinedContact = {
    id: string;
    name: string;
    role_title: string | null;
    email: string | null;
    phone: string | null;
    linkedin_url: string | null;
    relationship_type: string;
    user_id: string;
  };

  return (data ?? [])
    .map((row) => row.contacts as unknown as JoinedContact)
    .filter((c) => c.user_id === user.id && HR_RELATIONSHIP_TYPES.includes(c.relationship_type as never))
    .map((c) => ({
      id: c.id,
      name: c.name,
      role_title: c.role_title ?? "",
      email: c.email ?? "",
      phone: c.phone ?? "",
      linkedin_url: c.linkedin_url ?? "",
      relationship_type: c.relationship_type as HrContactDraft["relationship_type"],
    }));
}
