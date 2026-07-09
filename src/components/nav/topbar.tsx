"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Menu, Search, LogOut, User as UserIcon, Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SidebarNav } from "@/components/nav/sidebar-nav";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { createClient } from "@/lib/supabase/client";

interface TopbarProps {
  pageTitle: string;
  userEmail?: string | null;
  userName?: string | null;
  avatarUrl?: string | null;
  followUpsDueCount?: number;
  openCommandPalette: () => void;
}

export function Topbar({
  pageTitle,
  userEmail,
  userName,
  avatarUrl,
  followUpsDueCount,
  openCommandPalette,
}: TopbarProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const initials = (userName || userEmail || "U").slice(0, 2).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 md:px-6">
      <div className="glass-panel-strong glass-inset-highlight flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 md:px-4">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="left" className="w-72 border-none glass-nav p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <SidebarNav followUpsDueCount={followUpsDueCount} onNavigate={() => setMobileOpen(false)} />
          </SheetContent>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </Sheet>

        <h1 className="hidden text-sm font-semibold tracking-tight text-foreground/90 sm:block">
          {pageTitle}
        </h1>

        <button
          onClick={openCommandPalette}
          className="ml-auto flex flex-1 items-center gap-2 rounded-xl border border-border/60 bg-background/40 px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-background/70 sm:max-w-xs"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Search ApplyOS…</span>
          <span className="ml-auto hidden items-center gap-0.5 rounded-md border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium sm:flex">
            ⌘K
          </span>
        </button>

        <ThemeToggle />

        <DropdownMenu>
          <DropdownMenuTrigger className="rounded-full ring-offset-background transition hover:opacity-80">
            <Avatar className="h-8 w-8 border border-border/60">
              <AvatarImage src={avatarUrl ?? undefined} />
              <AvatarFallback className="bg-gradient-to-br from-[var(--blue-accent)] to-[var(--emerald-accent)] text-[11px] font-semibold text-white">
                {initials}
              </AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 glass-panel-strong">
            <DropdownMenuLabel className="truncate">{userName || userEmail}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <UserIcon className="mr-2 h-4 w-4" /> Profile
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <SettingsIcon className="mr-2 h-4 w-4" /> Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
