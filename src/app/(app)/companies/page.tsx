import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { CompaniesGrid } from "@/components/companies/companies-grid";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";

export default async function CompaniesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: companies }, { data: applications }] = await Promise.all([
    supabase.from("companies").select("*").eq("user_id", user.id).order("name"),
    supabase.from("applications").select("company_id").eq("user_id", user.id).eq("is_archived", false),
  ]);

  const counts = new Map<string, number>();
  applications?.forEach((a) => {
    if (a.company_id) counts.set(a.company_id, (counts.get(a.company_id) ?? 0) + 1);
  });

  const withCounts = (companies ?? []).map((c) => ({ ...c, application_count: counts.get(c.id) ?? 0 }));

  if (!companies || companies.length === 0) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <EmptyState
          iconName="building2"
          title="No companies yet"
          description="Companies are created automatically when you add an application, or you can add one directly to start researching."
        />
        <div className="mt-4 flex justify-center">
          <CompanyFormDialog />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-sm text-muted-foreground">{companies.length} companies tracked</p>
        </div>
        <CompanyFormDialog />
      </div>
      <CompaniesGrid companies={withCounts} />
    </div>
  );
}
