import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { ContactsTable } from "@/components/contacts/contacts-table";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";

export default async function ContactsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: contacts }, { data: companies }] = await Promise.all([
    supabase.from("contacts").select("*").eq("user_id", user.id).order("name"),
    supabase.from("companies").select("id, name").eq("user_id", user.id).order("name"),
  ]);

  const companyOptions = companies ?? [];

  if (!contacts || contacts.length === 0) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <EmptyState
          icon={Users}
          title="No contacts yet"
          description="Track recruiters, hiring managers, alumni, and referrals — every relationship that moves an application forward."
        />
        <div className="mt-4 flex justify-center">
          <ContactFormDialog companyOptions={companyOptions} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Contacts</h1>
          <p className="text-sm text-muted-foreground">{contacts.length} people in your network</p>
        </div>
        <ContactFormDialog companyOptions={companyOptions} />
      </div>
      <ContactsTable contacts={contacts} companyOptions={companyOptions} />
    </div>
  );
}
