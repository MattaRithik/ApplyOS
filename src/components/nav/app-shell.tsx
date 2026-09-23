"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SidebarNav } from "@/components/nav/sidebar-nav";
import { Topbar } from "@/components/nav/topbar";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { PageTransition } from "@/components/shared/page-transition";
import { primaryNav, secondaryNav } from "@/components/nav/nav-config";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { TargetRolesDialog } from "@/components/onboarding/target-roles-dialog";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  userEmail?: string | null;
  userName?: string | null;
  avatarUrl?: string | null;
  followUpsDueCount?: number;
  jobDropsUnreadCount?: number;
  showOnboarding?: boolean;
  showTargetRoles?: boolean;
}

export function AppShell({
  children,
  userEmail,
  userName,
  avatarUrl,
  followUpsDueCount,
  jobDropsUnreadCount,
  showOnboarding,
  showTargetRoles,
}: AppShellProps) {
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [onboardingOpen, setOnboardingOpen] = React.useState(!!showOnboarding);
  const [targetRolesDone, setTargetRolesDone] = React.useState(false);
  const collapsed = React.useSyncExternalStore(subscribeSidebar, getSidebarSnapshot, () => true);
  const toggleSidebar = () => {
    try { localStorage.setItem("applyos-sidebar-collapsed", String(!collapsed)); } catch { /* Storage may be unavailable. */ }
    window.dispatchEvent(new Event("sidebar-change"));
  };
  const pathname = usePathname();
  const isJobDrops = pathname === "/job-drops";

  const pageTitle =
    [...primaryNav, ...secondaryNav].find((item) =>
      item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href)
    )?.label ?? "ApplyOS";

  return (
    <div className={cn("flex min-h-screen w-full", isJobDrops && "h-dvh min-h-0 overflow-hidden")}>
      <aside className={cn("sticky top-0 hidden h-screen shrink-0 p-3 md:block transition-[width] motion-reduce:transition-none", collapsed ? "w-24" : "w-72")}>
        <div className="glass-nav glass-inset-highlight h-full rounded-2xl">
          <SidebarNav collapsed={collapsed} onToggleCollapse={toggleSidebar} followUpsDueCount={followUpsDueCount} jobDropsUnreadCount={jobDropsUnreadCount} />
        </div>
      </aside>

      <div className={cn("flex min-w-0 flex-1 flex-col", isJobDrops ? "min-h-0" : "min-h-screen")}>
        <Topbar
          pageTitle={pageTitle}
          userEmail={userEmail}
          userName={userName}
          avatarUrl={avatarUrl}
          followUpsDueCount={followUpsDueCount}
          jobDropsUnreadCount={jobDropsUnreadCount}
          openCommandPalette={() => setCommandOpen(true)}
        />
        <main className={cn("flex-1 px-4 md:px-6", isJobDrops ? "flex min-h-0 flex-col pb-3" : "pb-10")}>
          <PageTransition className={isJobDrops ? "flex min-h-0 flex-1 flex-col" : undefined}>{children}</PageTransition>
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <TargetRolesDialog open={!!showTargetRoles && !targetRolesDone} onDone={() => setTargetRolesDone(true)} />
      <OnboardingFlow open={onboardingOpen && (!showTargetRoles || targetRolesDone)} onOpenChange={setOnboardingOpen} />
    </div>
  );
}

function subscribeSidebar(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("sidebar-change", callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener("sidebar-change", callback); };
}
function getSidebarSnapshot() {
  // Start collapsed unless the user explicitly saved an expanded sidebar.
  try { return localStorage.getItem("applyos-sidebar-collapsed") !== "false"; } catch { return true; }
}
