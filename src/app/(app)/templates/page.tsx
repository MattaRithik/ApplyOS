import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/shared/empty-state";
import { TemplatesGrid } from "@/components/templates/templates-grid";
import { TemplateFormDialog } from "@/components/templates/template-form-dialog";
import { SeedTemplatesButton } from "@/components/templates/seed-templates-button";

export default async function TemplatesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: templates } = await supabase
    .from("email_templates")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (!templates || templates.length === 0) {
    return (
      <div className="mx-auto max-w-2xl pt-16">
        <EmptyState
          iconName="mail"
          title="No templates yet"
          description="Load a set of proven templates for recruiter outreach, referrals, and follow-ups — or write your own from scratch."
        />
        <div className="mt-4 flex justify-center gap-2">
          <SeedTemplatesButton />
          <TemplateFormDialog />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Email Templates</h1>
          <p className="text-sm text-muted-foreground">{templates.length} templates ready to use</p>
        </div>
        <div className="flex items-center gap-2">
          <SeedTemplatesButton />
          <TemplateFormDialog />
        </div>
      </div>
      <TemplatesGrid templates={templates} />
    </div>
  );
}
