"use client";

import * as React from "react";
import { Table2, Kanban, CalendarDays, Building2, Flame, Search, X } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { GlassPanel } from "@/components/shared/glass-panel";
import { APPLICATION_STATUSES, WORK_MODES } from "@/lib/types/database";
import type { ApplicationWithResume } from "@/components/applications/types";
import { TableView } from "@/components/applications/views/table-view";
import { KanbanView } from "@/components/applications/views/kanban-view";
import { CalendarView } from "@/components/applications/views/calendar-view";
import { CompanyView } from "@/components/applications/views/company-view";
import { PriorityView } from "@/components/applications/views/priority-view";

interface ApplicationsWorkspaceProps {
  applications: ApplicationWithResume[];
  resumeOptions: { id: string; display_name: string }[];
}

const ALL = "__all__";

export function ApplicationsWorkspace({ applications, resumeOptions }: ApplicationsWorkspaceProps) {
  const [view, setView] = React.useState("table");
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState(ALL);
  const [workModeFilter, setWorkModeFilter] = React.useState(ALL);
  const [resumeFilter, setResumeFilter] = React.useState(ALL);
  const [followUpOnly, setFollowUpOnly] = React.useState(false);

  const filtered = React.useMemo(() => {
    const term = search.trim().toLowerCase();
    const today = new Date().toISOString().slice(0, 10);
    return applications.filter((a) => {
      if (term) {
        const haystack = `${a.job_title} ${a.company_name} ${a.location ?? ""} ${a.notes ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      if (statusFilter !== ALL && a.status !== statusFilter) return false;
      if (workModeFilter !== ALL && a.work_mode !== workModeFilter) return false;
      if (resumeFilter !== ALL && a.resume_id !== resumeFilter) return false;
      if (followUpOnly && !(a.follow_up_date && a.follow_up_date <= today)) return false;
      return true;
    });
  }, [applications, search, statusFilter, workModeFilter, resumeFilter, followUpOnly]);

  const hasActiveFilters =
    search || statusFilter !== ALL || workModeFilter !== ALL || resumeFilter !== ALL || followUpOnly;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter(ALL);
    setWorkModeFilter(ALL);
    setResumeFilter(ALL);
    setFollowUpOnly(false);
  };

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={setView}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="table" className="gap-1.5">
              <Table2 className="h-3.5 w-3.5" /> Table
            </TabsTrigger>
            <TabsTrigger value="kanban" className="gap-1.5">
              <Kanban className="h-3.5 w-3.5" /> Kanban
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Calendar
            </TabsTrigger>
            <TabsTrigger value="company" className="gap-1.5">
              <Building2 className="h-3.5 w-3.5" /> Company
            </TabsTrigger>
            <TabsTrigger value="priority" className="gap-1.5">
              <Flame className="h-3.5 w-3.5" /> Priority
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      <GlassPanel className="flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search role, company, notes…"
            className="h-8 pl-8 text-sm"
          />
        </div>
        <Select
          items={[{ value: ALL, label: "All statuses" }, ...APPLICATION_STATUSES]}
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v ?? ALL)}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {APPLICATION_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={[{ value: ALL, label: "All modes" }, ...WORK_MODES]}
          value={workModeFilter}
          onValueChange={(v) => setWorkModeFilter(v ?? ALL)}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Work mode" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All modes</SelectItem>
            {WORK_MODES.map((m) => (
              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          items={[{ value: ALL, label: "All resumes" }, ...resumeOptions.map((r) => ({ value: r.id, label: r.display_name }))]}
          value={resumeFilter}
          onValueChange={(v) => setResumeFilter(v ?? ALL)}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Resume" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All resumes</SelectItem>
            {resumeOptions.map((r) => (
              <SelectItem key={r.id} value={r.id}>{r.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant={followUpOnly ? "default" : "outline"}
          className="h-8 text-xs"
          onClick={() => setFollowUpOnly((v) => !v)}
        >
          Follow-up due
        </Button>
        {hasActiveFilters && (
          <Button size="sm" variant="ghost" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3 w-3" /> Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} results</span>
      </GlassPanel>

      {view === "table" && <TableView applications={filtered} />}
      {view === "kanban" && <KanbanView applications={filtered} />}
      {view === "calendar" && <CalendarView applications={filtered} />}
      {view === "company" && <CompanyView applications={filtered} />}
      {view === "priority" && <PriorityView applications={filtered} />}
    </div>
  );
}
