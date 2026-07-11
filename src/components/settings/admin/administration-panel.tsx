"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { OverviewSection } from "@/components/settings/admin/overview-section";
import { UsersSection } from "@/components/settings/admin/users-section";
import { AuditLogSection } from "@/components/settings/admin/audit-log-section";

const SECTIONS = [
  { value: "overview", label: "Overview" },
  { value: "users", label: "Users & AI Access" },
  { value: "audit", label: "Audit Log" },
] as const;

type Section = (typeof SECTIONS)[number]["value"];

export function AdministrationPanel() {
  const [section, setSection] = React.useState<Section>("overview");

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold">Administration</p>
        <p className="text-xs text-muted-foreground">
          Owner-only controls for account access, AI parser entitlements, and security actions. This never shows job
          applications, resumes, or other private product data.
        </p>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SECTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => setSection(s.value)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              section === s.value
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/50 text-muted-foreground hover:bg-accent/40"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "overview" && <OverviewSection />}
      {section === "users" && <UsersSection />}
      {section === "audit" && <AuditLogSection />}
    </div>
  );
}
