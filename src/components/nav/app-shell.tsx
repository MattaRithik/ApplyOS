"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { SidebarNav } from "@/components/nav/sidebar-nav";
import { Topbar } from "@/components/nav/topbar";
import { CommandPalette } from "@/components/command-palette/command-palette";
import { PageTransition } from "@/components/shared/page-transition";
import { primaryNav, secondaryNav } from "@/components/nav/nav-config";
import { OnboardingFlow } from "@/components/onboarding/onboarding-flow";

interface AppShellProps {
  children: React.ReactNode;
  userEmail?: string | null;
  userName?: string | null;
  avatarUrl?: string | null;
  followUpsDueCount?: number;
  showOnboarding?: boolean;
}

export function AppShell({
  children,
  userEmail,
  userName,
  avatarUrl,
  followUpsDueCount,
  showOnboarding,
}: AppShellProps) {
  const [commandOpen, setCommandOpen] = React.useState(false);
  const [onboardingOpen, setOnboardingOpen] = React.useState(!!showOnboarding);
  const pathname = usePathname();

  const pageTitle =
    [...primaryNav, ...secondaryNav].find((item) =>
      item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href)
    )?.label ?? "ApplyOS";

  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 p-3 md:block">
        <div className="glass-nav glass-inset-highlight h-full rounded-2xl">
          <SidebarNav followUpsDueCount={followUpsDueCount} />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <Topbar
          pageTitle={pageTitle}
          userEmail={userEmail}
          userName={userName}
          avatarUrl={avatarUrl}
          followUpsDueCount={followUpsDueCount}
          openCommandPalette={() => setCommandOpen(true)}
        />
        <main className="flex-1 px-4 pb-10 md:px-6">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <OnboardingFlow open={onboardingOpen} onOpenChange={setOnboardingOpen} />
    </div>
  );
}
