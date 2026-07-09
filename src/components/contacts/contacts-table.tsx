"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Search, Trash2, Mail, Link2, Building2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/shared/glass-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ContactFormDialog } from "@/components/contacts/contact-form-dialog";
import { deleteContact } from "@/app/(app)/contacts/actions";
import { RELATIONSHIP_TYPES, type Contact } from "@/lib/types/database";

const ALL = "__all__";

const RESPONSE_STYLES: Record<string, string> = {
  no_response: "bg-muted text-muted-foreground",
  opened: "bg-[var(--blue-accent)]/15 text-[var(--blue-accent)]",
  replied_positive: "bg-[var(--emerald-accent)]/15 text-[var(--emerald-accent)]",
  replied_negative: "bg-destructive/10 text-destructive",
  referred: "bg-[var(--cyan-accent)]/15 text-[var(--cyan-accent)]",
  meeting_scheduled: "bg-[var(--emerald-accent)]/20 text-[var(--emerald-accent)]",
  declined: "bg-destructive/10 text-destructive",
};

export function ContactsTable({
  contacts,
  companyOptions,
}: {
  contacts: Contact[];
  companyOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [relationshipFilter, setRelationshipFilter] = React.useState(ALL);
  const [followUpOnly, setFollowUpOnly] = React.useState(false);

  const filtered = contacts.filter((c) => {
    const term = search.trim().toLowerCase();
    if (term && !`${c.name} ${c.company_name ?? ""} ${c.email ?? ""}`.toLowerCase().includes(term)) return false;
    if (relationshipFilter !== ALL && c.relationship_type !== relationshipFilter) return false;
    if (followUpOnly && !(c.next_follow_up_date && c.next_follow_up_date <= new Date().toISOString().slice(0, 10))) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteContact(id);
      toast.success("Contact deleted.");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed");
    }
  };

  return (
    <div className="space-y-4">
      <GlassPanel className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts…" className="h-8 pl-8 text-sm" />
        </div>
        <Select value={relationshipFilter} onValueChange={(v) => setRelationshipFilter(v ?? ALL)}>
          <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Relationship" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All relationships</SelectItem>
            {RELATIONSHIP_TYPES.map((r) => (
              <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="sm" variant={followUpOnly ? "default" : "outline"} className="h-8 text-xs" onClick={() => setFollowUpOnly((v) => !v)}>
          Follow-up due
        </Button>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} contacts</span>
      </GlassPanel>

      <GlassPanel className="overflow-hidden">
        <div className="max-h-[65vh] overflow-auto scrollbar-thin">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-popover/95 backdrop-blur">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Relationship</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Response</TableHead>
                <TableHead>Next follow-up</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">
                    {c.name}
                    {c.role_title && <p className="text-xs font-normal text-muted-foreground">{c.role_title}</p>}
                  </TableCell>
                  <TableCell>
                    {c.company_name && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Building2 className="h-3 w-3" /> {c.company_name}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-[10px]">
                      {RELATIONSHIP_TYPES.find((r) => r.value === c.relationship_type)?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {c.email && <a href={`mailto:${c.email}`} className="hover:text-primary"><Mail className="h-3.5 w-3.5" /></a>}
                      {c.linkedin_url && (
                        <a href={c.linkedin_url} target="_blank" rel="noreferrer" className="hover:text-primary">
                          <Link2 className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${RESPONSE_STYLES[c.response_status]}`}>
                      {c.response_status.replace(/_/g, " ")}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    {c.next_follow_up_date ? format(new Date(c.next_follow_up_date), "MMM d") : "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <ContactFormDialog
                        contact={c}
                        companyOptions={companyOptions}
                        onSaved={() => router.refresh()}
                        trigger={<Button variant="ghost" size="icon-sm"><Pencil className="h-3.5 w-3.5" /></Button>}
                      />
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </GlassPanel>
    </div>
  );
}
