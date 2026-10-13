import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { POLICY_LINKS, POLICY_UPDATED_LABEL } from "@/lib/legal/policies";

export const metadata: Metadata = {
  title: "Legal Center | ApplyOS",
  description: "ApplyOS terms, privacy practices, AI disclosures, and data request information.",
};

const DESCRIPTIONS = [
  "What we collect, how we use it, who can access it, and your choices.",
  "The agreement for using your job-search workspace and its features.",
  "How sign-in cookies and browser preferences work.",
  "Rules that keep the service safe and respect other people's information.",
  "How the optional job parser processes data and where human review matters.",
  "How to contact the operator, request deletion, or report a security issue.",
];

export default function LegalCenterPage() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="text-sm font-medium text-primary">ApplyOS</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Legal Center</h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
        Clear information about your workspace, your data, and the responsibilities that come with
        using ApplyOS.
      </p>
      <p className="mt-4 text-xs text-muted-foreground">Last updated {POLICY_UPDATED_LABEL}</p>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {POLICY_LINKS.map((link, index) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-2xl border border-border/60 bg-card/60 p-6 transition-colors hover:bg-accent/40"
          >
            <div className="flex items-center justify-between gap-4">
              <h2 className="font-semibold">{link.label}</h2>
              <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">{DESCRIPTIONS[index]}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
