import Link from "next/link";
import { LogoMark } from "@/components/shared/logo-mark";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { PolicyLinks } from "@/components/legal/policy-links";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:p-4">
        Skip to content
      </a>
      <header className="border-b border-border/50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold">
            <LogoMark className="h-6 w-6 text-primary" />
            ApplyOS
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Sign in
            </Link>
            <ThemeToggle />
          </div>
        </div>
      </header>
      {children}
      <footer className="mt-auto border-t border-border/50 px-4 py-8 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-4">
          <PolicyLinks />
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} ApplyOS</p>
        </div>
      </footer>
    </div>
  );
}
