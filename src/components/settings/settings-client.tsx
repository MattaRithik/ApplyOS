"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Monitor, Moon, Sun, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { updateProfile } from "@/app/(app)/settings/actions";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types/database";
import { cn } from "@/lib/utils";

export function SettingsClient({ profile, email }: { profile: Profile | null; email: string | null | undefined }) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const [fullName, setFullName] = React.useState(profile?.full_name ?? "");
  const [targetRole, setTargetRole] = React.useState(profile?.target_role ?? "");
  const [startDate, setStartDate] = React.useState(profile?.job_search_start_date ?? "");
  const [saving, setSaving] = React.useState(false);

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      await updateProfile({ full_name: fullName, target_role: targetRole, job_search_start_date: startDate || null });
      toast.success("Profile updated.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <Tabs defaultValue="profile">
      <TabsList>
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="appearance">Appearance</TabsTrigger>
        <TabsTrigger value="account">Account</TabsTrigger>
      </TabsList>

      <TabsContent value="profile" className="mt-4">
        <GlassPanel className="max-w-lg space-y-4 p-5">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Full name</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Target role</Label>
            <Input value={targetRole} onChange={(e) => setTargetRole(e.target.value)} placeholder="e.g. New Grad SWE" />
          </div>
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Job search start date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <Button onClick={handleSaveProfile} disabled={saving} size="sm">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </GlassPanel>
      </TabsContent>

      <TabsContent value="appearance" className="mt-4">
        <GlassPanel className="max-w-lg space-y-3 p-5">
          <p className="text-sm font-semibold">Theme</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { value: "light", label: "Light", icon: Sun },
              { value: "dark", label: "Dark", icon: Moon },
              { value: "system", label: "System", icon: Monitor },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-xl border p-4 text-xs font-medium transition-colors",
                  theme === opt.value ? "border-primary bg-primary/5 text-primary" : "border-border/50 text-muted-foreground hover:bg-accent/40"
                )}
              >
                <opt.icon className="h-5 w-5" />
                {opt.label}
              </button>
            ))}
          </div>
        </GlassPanel>
      </TabsContent>

      <TabsContent value="account" className="mt-4">
        <GlassPanel className="max-w-lg space-y-4 p-5">
          <div>
            <Label className="mb-1.5 block text-xs text-muted-foreground">Email</Label>
            <Input value={email ?? ""} disabled />
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/50 p-3">
            <div>
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">Reset your password via email.</p>
            </div>
            <Button variant="outline" size="sm" render={<a href="/forgot-password" />}>
              Reset password
            </Button>
          </div>
          <div className="flex items-center justify-between rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <div>
              <p className="text-sm font-medium text-destructive">Sign out</p>
              <p className="text-xs text-muted-foreground">End your session on this device.</p>
            </div>
            <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={handleSignOut}>
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </Button>
          </div>
        </GlassPanel>
      </TabsContent>
    </Tabs>
  );
}
