import { createClient } from "@/lib/supabase/server";
import { SettingsClient } from "@/components/settings/settings-client";
import { getTimelinesContext } from "@/lib/data/timelines";
import { hasAIParserAccess } from "@/lib/ai-parser/entitlement";
import { isOwner } from "@/lib/admin/roles";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, timelinesContext, aiParserEnabled, isOwnerAccount] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    getTimelinesContext(supabase, user.id),
    hasAIParserAccess(supabase),
    isOwner(supabase),
  ]);

  return (
    <div className="space-y-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your profile, appearance, and account.</p>
      </div>
      <SettingsClient
        profile={profile}
        email={user.email}
        timelinesContext={timelinesContext}
        aiParserEnabled={aiParserEnabled}
        isOwner={isOwnerAccount}
      />
    </div>
  );
}
