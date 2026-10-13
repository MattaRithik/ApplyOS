import type { ReactNode } from "react";
import Link from "next/link";
import { POLICY_UPDATED_LABEL, POLICY_VERSION } from "@/lib/legal/policies";

export interface PolicySection {
  id: string;
  title: string;
  content: ReactNode;
}

export interface PolicyDocument {
  title: string;
  description: string;
  summary: string;
  sections: PolicySection[];
}

export function PolicyDocumentView({ document }: { document: PolicyDocument }) {
  return (
    <main id="main-content" className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
      <header className="max-w-3xl">
        <Link href="/legal" className="text-sm text-primary hover:underline">
          ApplyOS Legal Center
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">{document.title}</h1>
        <p className="mt-4 text-base leading-7 text-muted-foreground">{document.description}</p>
        <p className="mt-4 text-xs text-muted-foreground">
          Last updated {POLICY_UPDATED_LABEL} · Version {POLICY_VERSION}
        </p>
        <div className="mt-6 rounded-2xl border border-border/60 bg-muted/30 p-5">
          <p className="text-sm leading-6">{document.summary}</p>
        </div>
      </header>
      <div className="mt-10 grid items-start gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14">
        <nav
          aria-label="On this page"
          className="rounded-xl border border-border/50 p-4 lg:sticky lg:top-8"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            On this page
          </p>
          <ol className="space-y-2 text-sm">
            {document.sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="text-muted-foreground hover:text-foreground hover:underline"
                >
                  {index + 1}. {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>
        <article className="max-w-3xl space-y-10 text-sm leading-7 text-muted-foreground [&_p+p]:mt-4 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4 [&_strong]:font-medium [&_strong]:text-foreground">
          {document.sections.map((section, index) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
              className="scroll-mt-8"
            >
              <h2
                id={`${section.id}-title`}
                className="mb-3 text-lg font-semibold tracking-tight text-foreground"
              >
                {index + 1}. {section.title}
              </h2>
              {section.content}
            </section>
          ))}
        </article>
      </div>
    </main>
  );
}
