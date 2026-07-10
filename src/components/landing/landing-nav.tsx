"use client";

import * as React from "react";
import Link from "next/link";
import { Menu, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { LogoMark } from "@/components/shared/logo-mark";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How it works" },
  { href: "#privacy", label: "Privacy" },
];

export function LandingNav({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const primaryCtaLabel = isAuthenticated ? "Open Dashboard" : "Sign In";
  const primaryCtaHref = isAuthenticated ? "/dashboard" : "/login";

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="glass-nav glass-inset-highlight mx-auto flex h-16 max-w-6xl items-center justify-between rounded-none border-x-0 border-t-0 px-4 sm:px-6 lg:rounded-b-2xl lg:border-x lg:border-t">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--blue-accent)] via-[var(--cyan-accent)] to-[var(--emerald-accent)] text-white shadow-lg">
            <LogoMark className="h-5 w-5" />
          </span>
          <div className="leading-tight">
            <p className="text-base font-semibold tracking-tight">ApplyOS</p>
            <p className="text-[11px] text-muted-foreground">Application Tracker</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <a key={link.href} href={link.href} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <ThemeToggle />
          {!isAuthenticated && (
            <Button variant="outline" size="sm" render={<Link href="/login" />}>
              Get Started
            </Button>
          )}
          <Button size="sm" className="gap-1.5" render={<Link href={primaryCtaHref} />}>
            {primaryCtaLabel} <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1 md:hidden">
          <ThemeToggle />
          <Button variant="ghost" size="icon" aria-label="Open menu" onClick={() => setMobileOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="glass-panel-strong border-none p-0">
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <div className="flex items-center gap-2.5 border-b border-border/50 px-5 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--blue-accent)] via-[var(--cyan-accent)] to-[var(--emerald-accent)] text-white">
              <LogoMark className="h-4.5 w-4.5" />
            </span>
            <p className="text-sm font-semibold">ApplyOS</p>
          </div>
          <nav className="flex flex-col gap-1 px-3 py-4">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-auto flex flex-col gap-2 border-t border-border/50 p-4">
            {!isAuthenticated && (
              <Button variant="outline" render={<Link href="/login" />}>
                Get Started
              </Button>
            )}
            <Button className="gap-1.5" render={<Link href={primaryCtaHref} />}>
              {primaryCtaLabel} <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  );
}
