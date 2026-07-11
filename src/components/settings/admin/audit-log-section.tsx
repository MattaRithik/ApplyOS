"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { AuditLogPage } from "@/lib/admin/audit";

const PAGE_SIZE = 25;

export function AuditLogSection() {
  const [page, setPage] = React.useState(0);
  const [result, setResult] = React.useState<AuditLogPage | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchLog = React.useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/audit-log?page=${pageNum}&pageSize=${PAGE_SIZE}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load audit log");
      setResult(json as AuditLogPage);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load audit log");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch triggered by page change, not a render loop
    fetchLog(page);
  }, [page, fetchLog]);

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => fetchLog(page)} disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Refresh
        </Button>
      </div>

      <GlassPanel className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Actor</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Details</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(result?.entries ?? []).map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="whitespace-nowrap text-xs">{new Date(entry.createdAt).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px] uppercase">
                    {entry.actionType}
                  </Badge>
                </TableCell>
                <TableCell className="font-mono text-[10px]">{entry.actorUserId?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell className="font-mono text-[10px]">{entry.targetUserId?.slice(0, 8) ?? "—"}</TableCell>
                <TableCell className="max-w-[240px] truncate text-xs text-muted-foreground">
                  {Object.keys(entry.metadata).length > 0 ? JSON.stringify(entry.metadata) : "—"}
                </TableCell>
              </TableRow>
            ))}
            {(result?.entries.length ?? 0) === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={5} className="py-6 text-center text-muted-foreground">
                  No administrative actions yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </GlassPanel>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Page {page + 1} of {totalPages} · {result?.total ?? 0} total
        </span>
        <div className="flex gap-1.5">
          <Button
            variant="outline"
            size="icon-sm"
            className={cn(page === 0 && "opacity-50")}
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="icon-sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
