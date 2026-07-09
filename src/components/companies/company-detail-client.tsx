"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Building2,
  Globe,
  MapPin,
  ShieldCheck,
  Trash2,
  Briefcase,
  Users,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CompanyFormDialog } from "@/components/companies/company-form-dialog";
import { NotesPanel } from "@/components/shared/notes-panel";
import { deleteCompany } from "@/app/(app)/companies/actions";
import { RELATIONSHIP_TYPES, type Company, type Contact, type Outreach, type Note, type ApplicationStatus } from "@/lib/types/database";

interface Props {
  company: Company;
  applications: { id: string; job_title: string; status: ApplicationStatus; date_applied: string | null; priority_score: number }[];
  contacts: Contact[];
  outreach: Outreach[];
  notes: Note[];
}

export function CompanyDetailClient({ company, applications, contacts, outreach, notes }: Props) {
  const router = useRouter();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const handleDelete = async () => {
    try {
      await deleteCompany(company.id);
      toast.success("Company deleted.");
      router.push("/companies");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  const bestContact = contacts.find((c) => c.response_status === "meeting_scheduled" || c.response_status === "referred") ?? contacts[0];

  return (
    <div className="space-y-5 py-6">
      <Link href="/companies" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Back to companies
      </Link>

      <GlassPanel className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--blue-accent)]/20 to-[var(--cyan-accent)]/20 text-[var(--blue-accent)]">
              <Building2 className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold tracking-tight">{company.name}</h1>
                {company.sponsorship_friendly && (
                  <Badge variant="secondary" className="gap-1 text-[10px]">
                    <ShieldCheck className="h-3 w-3" /> Sponsors
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {[company.industry, company.location].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CompanyFormDialog company={company} trigger={<Button variant="outline" size="sm">Edit</Button>} onSaved={() => router.refresh()} />
            <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
              <Button variant="outline" size="sm" className="gap-1.5 text-destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </Button>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this company?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Applications and contacts linked to this company will remain but lose their company link.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm">
          {company.website && (
            <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
              <Globe className="h-3.5 w-3.5" /> Website
            </a>
          )}
          {company.careers_page_url && (
            <a href={company.careers_page_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
              <Briefcase className="h-3.5 w-3.5" /> Careers page
            </a>
          )}
          {company.linkedin_url && (
            <a href={company.linkedin_url} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-primary hover:underline">
              <Users className="h-3.5 w-3.5" /> LinkedIn
            </a>
          )}
          {bestContact && (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> Best contact: {bestContact.name}
            </span>
          )}
        </div>

        {company.sponsorship_notes && (
          <p className="mt-3 text-xs text-muted-foreground">{company.sponsorship_notes}</p>
        )}
      </GlassPanel>

      <div className="grid gap-5 lg:grid-cols-2">
        <GlassPanel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Briefcase className="h-4 w-4 text-[var(--blue-accent)]" /> Applications ({applications.length})
          </h2>
          {applications.length === 0 ? (
            <p className="text-sm text-muted-foreground">No applications to this company yet.</p>
          ) : (
            <ul className="space-y-2">
              {applications.map((a) => (
                <li key={a.id}>
                  <Link href={`/applications/${a.id}`} className="flex items-center justify-between rounded-lg border border-border/40 p-2.5 text-sm hover:bg-accent/40">
                    <span className="truncate">{a.job_title}</span>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-[var(--cyan-accent)]" /> Contacts ({contacts.length})
          </h2>
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contacts saved for this company.</p>
          ) : (
            <ul className="space-y-2">
              {contacts.map((c) => (
                <li key={c.id} className="rounded-lg border border-border/40 p-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{c.name}</span>
                    <Badge variant="secondary" className="text-[10px]">
                      {RELATIONSHIP_TYPES.find((r) => r.value === c.relationship_type)?.label}
                    </Badge>
                  </div>
                  {c.role_title && <p className="text-xs text-muted-foreground">{c.role_title}</p>}
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <GlassPanel className="p-5">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
            <Send className="h-4 w-4 text-[var(--emerald-accent)]" /> Outreach history ({outreach.length})
          </h2>
          {outreach.length === 0 ? (
            <p className="text-sm text-muted-foreground">No outreach logged yet.</p>
          ) : (
            <ul className="space-y-2">
              {outreach.map((o) => (
                <li key={o.id} className="rounded-lg border border-border/40 p-2.5 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{o.person_name ?? "Unknown"}</span>
                    <span className="text-[11px] text-muted-foreground">{format(new Date(o.date_sent), "MMM d, yyyy")}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {o.outreach_type} · {o.response_received ? "Replied" : "No response yet"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </GlassPanel>

        <NotesPanel
          entityType="company"
          entityId={company.id}
          notes={notes}
          revalidate={`/companies/${company.id}`}
        />
      </div>
    </div>
  );
}
