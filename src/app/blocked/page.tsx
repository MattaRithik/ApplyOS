import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, ShieldX } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { BLOCKED_MESSAGE, isWorkspaceBlocked } from "@/lib/access/workspace";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { LogoMark } from "@/components/shared/logo-mark";
import { PolicyLinks } from "@/components/legal/policy-links";

export const metadata: Metadata = {
  title: "Account blocked | ApplyOS",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function BlockedPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=%2Fblocked");
  if (!isWorkspaceBlocked(user)) redirect("/dashboard");
  const { error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col justify-center px-4 py-12 sm:px-6">
      <div className="mb-6 flex items-center justify-center gap-2 text-sm font-semibold">
        <LogoMark className="h-6 w-6 text-primary" />
        ApplyOS
      </div>
      <GlassPanel strong className="space-y-6 p-6 sm:p-9">
        <div className="space-y-3">
          <ShieldX aria-hidden="true" className="h-9 w-9 text-destructive" />
          <h1 className="text-2xl font-semibold tracking-tight">{BLOCKED_MESSAGE}</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            Your access to the workspace has been completely blocked. You can download a copy of
            your data below.
          </p>
        </div>
        <div className="space-y-3 rounded-xl border border-border/60 p-4">
          <h2 className="font-medium">Download your data</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            One ZIP file containing your original uploaded resume files, an Excel workbook of your
            account and workspace records, and a complete JSON copy of the exported records.
            Archived records are included.
          </p>
          <p className="text-xs leading-5 text-muted-foreground">
            Large downloads can take several minutes. Keep this page open until your browser
            finishes saving the file.
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error === "rate_limit"
                ? "Please wait a few minutes before requesting another download."
                : "We couldn't prepare your download. Please try again or contact support."}
            </p>
          )}
          <form action="/api/account/export" method="post">
            <Button type="submit" className="w-full gap-2">
              <Download className="h-4 w-4" />
              Download all my data
            </Button>
          </form>
        </div>
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/contact"
            className="text-xs text-muted-foreground underline underline-offset-4"
          >
            Contact support
          </Link>
          <form action="/api/account/sign-out" method="post">
            <Button type="submit" variant="outline" size="sm">
              Sign out
            </Button>
          </form>
        </div>
      </GlassPanel>
      <PolicyLinks className="mt-6 justify-center" />
    </main>
  );
}
