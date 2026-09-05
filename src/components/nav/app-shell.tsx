"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SidebarNav } from "@/components/nav/sidebar-nav";
import { Topbar } from "@/components/nav/topbar";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { PageTransition } from "@/components/shared/page-transition";
import { primaryNav, secondaryNav } from "@/components/nav/nav-config";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
  userEmail?: string | null;
  userName?: string | null;
  avatarUrl?: string | null;
  followUpsDueCount?: number;
  jobDropsUnreadCount?: number;
  showOnboarding?: boolean;
}

export function AppShell({
  children,
  userEmail,
  userName,
  avatarUrl,
  followUpsDueCount,
  jobDropsUnreadCount,
  showOnboarding,
}: AppShellProps) {
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [onboardingOpen, setOnboardingOpen] = React.useState(!!showOnboarding);
  const pathname = usePathname();
  const isJobDrops = pathname === "/job-drops";

  const pageTitle =
    [...primaryNav, ...secondaryNav].find((item) =>
      item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href)
    )?.label ?? "ApplyOS";

  return (
    <div className={cn("flex min-h-screen w-full", isJobDrops && "h-dvh min-h-0 overflow-hidden")}>
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 p-3 md:block">
        <div className="glass-nav glass-inset-highlight h-full rounded-2xl">
          <SidebarNav followUpsDueCount={followUpsDueCount} jobDropsUnreadCount={jobDropsUnreadCount} />
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
      <OnboardingFlow open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </div>
  );
}
