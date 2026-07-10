"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { toast } from "sonner";
import { Search, Trash2, Pencil, CheckCircle2, Circle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { OutreachFormDialog } from "@/components/outreach/outreach-form-dialog";
import { deleteOutreach } from "@/app/(app)/outreach/actions";
import { OUTREACH_TYPES, type Outreach } from "@/lib/types/database";

const ALL = "__all__";

export function OutreachTable({
  outreach,
  contactOptions,
  companyOptions,
  templateOptions,
}: {
  outreach: Outreach[];
  contactOptions: { id: string; name: string; company_name: string | null; email: string | null; linkedin_url: string | null }[];
  companyOptions: { id: string; name: string }[];
  templateOptions: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [search, setSearch] = React.useState("");
  const [typeFilter, setTypeFilter] = React.useState(ALL);
  const [responseFilter, setResponseFilter] = React.useState(ALL);

  const filtered = outreach.filter((o) => {
    const term = search.trim().toLowerCase();
    if (term && !`${o.person_name ?? ""} ${o.company_name ?? ""} ${o.subject_line ?? ""}`.toLowerCase().includes(term)) return false;
    if (typeFilter !== ALL && o.outreach_type !== typeFilter) return false;
    if (responseFilter === "replied" && !o.response_received) return false;
    if (responseFilter === "pending" && o.response_received) return false;
    return true;
  });

  const handleDelete = async (id: string) => {
    try {
      await deleteOutreach(id);
      toast.success("Outreach removed.");
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
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search outreach…" className="h-8 pl-8 text-sm" />
        </div>
        <Select
          items={[{ value: ALL, label: "All types" }, ...OUTREACH_TYPES]}
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v ?? ALL)}
        >
          <SelectTrigger className="h-8 w-[170px] text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {OUTREACH_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={[
            { value: ALL, label: "Any response" },
            { value: "replied", label: "Replied" },
            { value: "pending", label: "No response" },
          ]}
          value={responseFilter}
          onValueChange={(v) => setResponseFilter(v ?? ALL)}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue placeholder="Response" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any response</SelectItem>
            <SelectItem value="replied">Replied</SelectItem>
            <SelectItem value="pending">No response</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} entries</span>
      </GlassPanel>

      <GlassPanel className="overflow-hidden">
        <div className="max-h-[60vh] overflow-auto scrollbar-thin">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-popover/95 backdrop-blur">
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Follow-up</TableHead>
                <TableHead>Response</TableHead>
                <TableHead className="w-20" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.person_name ?? "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{o.company_name ?? "—"}</TableCell>
                  <TableCell className="text-xs">{OUTREACH_TYPES.find((t) => t.value === o.outreach_type)?.label}</TableCell>
                  <TableCell className="text-xs">{format(new Date(o.date_sent), "MMM d, yyyy")}</TableCell>
                  <TableCell className="text-xs">{o.follow_up_date ? format(new Date(o.follow_up_date), "MMM d") : "—"}</TableCell>
                  <TableCell>
                    {o.response_received ? (
                      <span className="flex items-center gap-1 text-xs text-[var(--emerald-accent)]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> {o.response_type?.replace(/_/g, " ") ?? "Replied"}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Circle className="h-3.5 w-3.5" /> Pending
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <OutreachFormDialog
                        outreach={o}
                        contactOptions={contactOptions}
                        companyOptions={companyOptions}
                        templateOptions={templateOptions}
                        onSaved={() => router.refresh()}
                        trigger={<Button variant="ghost" size="icon-sm"><Pencil className="h-3.5 w-3.5" /></Button>}
                      />
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(o.id)}>
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
