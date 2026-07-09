"use client";

import Link from "next/link";
import { format } from "date-fns";
import { MapPin, ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/shared/status-badge";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Progress } from "@/components/ui/progress";
import type { ApplicationWithResume } from "@/components/applications/types";

export function TableView({ applications }: { applications: ApplicationWithResume[] }) {
  return (
    <GlassPanel className="overflow-hidden">
      <div className="max-h-[65vh] overflow-auto scrollbar-thin">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-popover/95 backdrop-blur">
            <TableRow>
              <TableHead>Role</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Resume</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Follow-up</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((a) => (
              <TableRow key={a.id} className="group">
                <TableCell className="max-w-[220px]">
                  <Link href={`/applications/${a.id}`} className="flex items-center gap-1.5 font-medium hover:text-primary hover:underline">
                    <span className="truncate">{a.job_title}</span>
                    {a.job_url && <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100" />}
                  </Link>
                </TableCell>
                <TableCell className="max-w-[160px] truncate">{a.company_name}</TableCell>
                <TableCell><StatusBadge status={a.status} /></TableCell>
                <TableCell className="max-w-[140px]">
                  <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3 shrink-0" />
                    {a.location || "—"} {a.work_mode && `· ${a.work_mode}`}
                  </span>
                </TableCell>
                <TableCell className="text-xs">{a.date_applied ? format(new Date(a.date_applied), "MMM d, yyyy") : "—"}</TableCell>
                <TableCell className="max-w-[140px] truncate text-xs">{a.resume?.display_name ?? "—"}</TableCell>
                <TableCell className="w-28">
                  <div className="flex items-center gap-2">
                    <Progress value={a.priority_score} className="h-1.5 w-14" />
                    <span className="text-xs tabular-nums text-muted-foreground">{a.priority_score}</span>
                  </div>
                </TableCell>
                <TableCell className="text-xs">
                  {a.follow_up_date ? (
                    <span className={a.follow_up_date <= new Date().toISOString().slice(0, 10) ? "font-medium text-destructive" : "text-muted-foreground"}>
                      {format(new Date(a.follow_up_date), "MMM d")}
                    </span>
                  ) : (
                    "—"
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </GlassPanel>
  );
}
