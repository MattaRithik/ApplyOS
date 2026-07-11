"use client";

import * as React from "react";
import { toast } from "sonner";
import { Loader2, RefreshCw, ChevronLeft, ChevronRight, ShieldAlert } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatUsd } from "@/components/settings/admin/stat-card";
import { UserDetailDialog } from "@/components/settings/admin/user-detail-dialog";
import type { AdminUserSummary } from "@/lib/admin/users";

const PAGE_SIZE = 20;

interface UserListResponse {
  users: AdminUserSummary[];
  total: number;
  page: number;
  pageSize: number;
}

export function UsersSection() {
  const [search, setSearch] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [result, setResult] = React.useState<UserListResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [selectedUserId, setSelectedUserId] = React.useState<string | null>(null);

  const fetchUsers = React.useCallback(async (searchTerm: string, pageNum: number) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(pageNum), pageSize: String(PAGE_SIZE) });
      if (searchTerm.trim()) params.set("search", searchTerm.trim());
      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load users");
      setResult(json as UserListResponse);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    // Intentional: re-fetch whenever the page changes; search resets to page 0 in handleSearchChange.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch triggered by state change, not a render loop
    fetchUsers(search, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchUsers(search, 0);
  };

  const totalPages = result ? Math.max(1, Math.ceil(result.total / result.pageSize)) : 1;

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearchSubmit} className="flex gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email or name…"
          className="max-w-xs"
        />
        <Button type="submit" size="sm" variant="outline" disabled={loading}>
          Search
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="gap-1.5"
          onClick={() => fetchUsers(search, page)}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </form>

      <GlassPanel className="overflow-hidden p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>AI access</TableHead>
              <TableHead>Requests (mo)</TableHead>
              <TableHead>Cost (mo)</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(result?.users ?? []).map((u) => (
              <TableRow key={u.id} className="cursor-pointer" onClick={() => setSelectedUserId(u.id)}>
                <TableCell>
                  <div className="flex flex-col">
                    <span className="font-medium">{u.displayName || u.email || "—"}</span>
                    {u.displayName && <span className="text-xs text-muted-foreground">{u.email}</span>}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={u.role === "owner" ? "default" : "outline"} className="uppercase">
                    {u.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  {u.aiAccess.suspended ? (
                    <Badge variant="destructive">Suspended</Badge>
                  ) : u.aiAccess.enabled ? (
                    <Badge className="bg-[var(--emerald-accent)] text-white">Enabled</Badge>
                  ) : (
                    <Badge variant="secondary">Disabled</Badge>
                  )}
                </TableCell>
                <TableCell className="tabular-nums">{u.usageThisMonth.requests}</TableCell>
                <TableCell className="tabular-nums">{formatUsd(u.usageThisMonth.estimatedCostUsd)}</TableCell>
                <TableCell>
                  {u.banned ? (
                    <span className="inline-flex items-center gap-1 text-xs text-destructive">
                      <ShieldAlert className="h-3 w-3" /> Disabled
                    </span>
                  ) : (
                    <span className="text-xs text-muted-foreground">{u.emailVerified ? "Verified" : "Unverified"}</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {(result?.users.length ?? 0) === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  No users found.
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
          <Button
            variant="outline"
            size="icon-sm"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {selectedUserId && (
        <UserDetailDialog
          userId={selectedUserId}
          open={!!selectedUserId}
          onOpenChange={(open) => !open && setSelectedUserId(null)}
          onChanged={() => fetchUsers(search, page)}
        />
      )}
    </div>
  );
}
