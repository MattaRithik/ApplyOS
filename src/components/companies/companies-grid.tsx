"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Building2, MapPin, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Badge } from "@/components/ui/badge";
import type { Company } from "@/lib/types/database";

interface CompanyWithCount extends Company {
  application_count: number;
}

export function CompaniesGrid({ companies }: { companies: CompanyWithCount[] }) {
  const [search, setSearch] = React.useState("");

  const filtered = companies.filter((c) =>
    `${c.name} ${c.industry ?? ""} ${c.location ?? ""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-xs flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search companies…" className="h-9 pl-8" />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} companies</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((c) => (
          <Link key={c.id} href={`/companies/${c.id}`}>
            <GlassPanel hoverLift className="flex h-full flex-col gap-3 p-4">
              <div className="flex items-start justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--blue-accent)]/20 to-[var(--cyan-accent)]/20 text-[var(--blue-accent)]">
                  <Building2 className="h-5 w-5" />
                </span>
                {c.sponsorship_friendly && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <ShieldCheck className="h-3 w-3" /> Sponsors
                  </Badge>
                )}
              </div>
              <div>
                <p className="font-semibold">{c.name}</p>
                {c.industry && <p className="text-xs text-muted-foreground">{c.industry}</p>}
              </div>
              {c.location && (
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" /> {c.location}
                </p>
              )}
              <div className="mt-auto flex items-center justify-between border-t border-border/40 pt-2.5 text-xs text-muted-foreground">
                <span>{c.application_count} application{c.application_count === 1 ? "" : "s"}</span>
              </div>
            </GlassPanel>
          </Link>
        ))}
      </div>
    </div>
  );
}
