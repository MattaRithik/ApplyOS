"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { GlassPanel } from "@/components/shared/glass-panel";
import { formatUsd } from "@/components/settings/admin/stat-card";
import type { AdminUserDetail } from "@/lib/admin/users";

interface Props {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
}

export function UserDetailDialog({ userId, open, onOpenChange, onChanged }: Props) {
  const [detail, setDetail] = React.useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [dailyLimit, setDailyLimit] = React.useState("");
  const [monthlyBudget, setMonthlyBudget] = React.useState("");
  const [expiresAt, setExpiresAt] = React.useState("");
  const [suspendReason, setSuspendReason] = React.useState("");

  const fetchDetail = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to load user");
      const data = json as AdminUserDetail;
      setDetail(data);
      setDailyLimit(data.aiAccess.dailyRequestLimit != null ? String(data.aiAccess.dailyRequestLimit) : "");
      setMonthlyBudget(data.aiAccess.monthlyBudgetUsd != null ? String(data.aiAccess.monthlyBudgetUsd) : "");
      setExpiresAt(data.aiAccess.expiresAt ? data.aiAccess.expiresAt.slice(0, 10) : "");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load user");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  React.useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch tied to dialog opening, not a render loop
      fetchDetail();
    }
  }, [open, fetchDetail]);

  const callEntitlement = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/entitlement`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed.");
      toast.success("Updated.");
      await fetchDetail();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const callSecurity = async (body: Record<string, unknown>) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}/security`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Action failed.");
      toast.success("Done.");
      await fetchDetail();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveLimits = () => {
    callEntitlement({
      action: "update_limits",
      dailyRequestLimit: dailyLimit.trim() ? Number(dailyLimit) : null,
      monthlyBudgetUsd: monthlyBudget.trim() ? Number(monthlyBudget) : null,
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{detail?.displayName || detail?.email || "User"}</DialogTitle>
          <DialogDescription>{detail?.email}</DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-4">
            <GlassPanel className="grid grid-cols-2 gap-2 p-3 text-xs sm:grid-cols-4">
              <div>
                <p className="text-muted-foreground">Role</p>
                <p className="font-medium uppercase">{detail.role}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Email verified</p>
                <p className="font-medium">{detail.emailVerified ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Created</p>
                <p className="font-medium">{new Date(detail.createdAt).toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Last sign-in</p>
                <p className="font-medium">{detail.lastSignInAt ? new Date(detail.lastSignInAt).toLocaleDateString() : "—"}</p>
              </div>
            </GlassPanel>

            <div className="space-y-2">
              <p className="text-xs font-semibold">AI parser access</p>
              <GlassPanel className="space-y-3 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={detail.aiAccess.suspended ? "destructive" : detail.aiAccess.enabled ? "default" : "secondary"}>
                    {detail.aiAccess.suspended ? "Suspended" : detail.aiAccess.enabled ? "Enabled" : "Disabled"}
                  </Badge>
                  {!detail.aiAccess.enabled && (
                    <Button size="sm" disabled={busy} onClick={() => callEntitlement({ action: "grant" })}>
                      Grant access
                    </Button>
                  )}
                  {detail.aiAccess.enabled && !detail.aiAccess.suspended && (
                    <ConfirmButton
                      label="Revoke access"
                      description="This immediately disables AI parsing for this account."
                      disabled={busy}
                      onConfirm={() => callEntitlement({ action: "revoke", confirm: true })}
                    />
                  )}
                  {detail.aiAccess.enabled && !detail.aiAccess.suspended && (
                    <SuspendControl
                      busy={busy}
                      reason={suspendReason}
                      setReason={setSuspendReason}
                      onConfirm={() => callEntitlement({ action: "suspend", confirm: true, reason: suspendReason || undefined })}
                    />
                  )}
                  {detail.aiAccess.suspended && (
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => callEntitlement({ action: "reactivate" })}>
                      Reactivate
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div>
                    <Label className="mb-1 block text-[10px] text-muted-foreground">Daily request limit</Label>
                    <Input value={dailyLimit} onChange={(e) => setDailyLimit(e.target.value)} placeholder="Default" inputMode="numeric" />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[10px] text-muted-foreground">Monthly budget (USD)</Label>
                    <Input value={monthlyBudget} onChange={(e) => setMonthlyBudget(e.target.value)} placeholder="Default" inputMode="decimal" />
                  </div>
                  <div>
                    <Label className="mb-1 block text-[10px] text-muted-foreground">Access expires</Label>
                    <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
                  </div>
                </div>
                <Button size="sm" variant="outline" disabled={busy} onClick={handleSaveLimits}>
                  Save limits
                </Button>
              </GlassPanel>
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold">AI usage</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <GlassPanel className="p-2 text-xs">
                  <p className="text-muted-foreground">Requests (mo)</p>
                  <p className="font-semibold">{detail.usageThisMonth.requests}</p>
                </GlassPanel>
                <GlassPanel className="p-2 text-xs">
                  <p className="text-muted-foreground">Cost (mo)</p>
                  <p className="font-semibold">{formatUsd(detail.usageThisMonth.estimatedCostUsd)}</p>
                </GlassPanel>
                <GlassPanel className="p-2 text-xs">
                  <p className="text-muted-foreground">Requests (all-time)</p>
                  <p className="font-semibold">{detail.usageAllTime.requests}</p>
                </GlassPanel>
                <GlassPanel className="p-2 text-xs">
                  <p className="text-muted-foreground">Cost (all-time)</p>
                  <p className="font-semibold">{formatUsd(detail.usageAllTime.estimatedCostUsd)}</p>
                </GlassPanel>
              </div>
              {detail.recentActivity.length > 0 && (
                <div className="max-h-48 overflow-x-auto overflow-y-auto rounded-lg border border-border/40">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-[10px] uppercase text-muted-foreground">
                        <th className="p-1.5">Time</th>
                        <th className="p-1.5">Model</th>
                        <th className="p-1.5">Status</th>
                        <th className="p-1.5">Cache</th>
                        <th className="p-1.5">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.recentActivity.map((r) => (
                        <tr key={r.id} className="border-t border-border/30">
                          <td className="p-1.5 whitespace-nowrap">{new Date(r.createdAt).toLocaleString()}</td>
                          <td className="p-1.5">{r.model ?? "—"}</td>
                          <td className="p-1.5">{r.status}</td>
                          <td className="p-1.5">{r.cacheHit ? "Yes" : "No"}</td>
                          <td className="p-1.5">{r.estimatedCostUsd != null ? formatUsd(r.estimatedCostUsd) : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-semibold">Account security</p>
              <GlassPanel className="flex flex-wrap gap-2 p-3">
                <ConfirmButton
                  label="Send password reset"
                  description="Sends a standard Supabase password-recovery email to this account's verified, on-file address."
                  disabled={busy}
                  onConfirm={() => callSecurity({ action: "send_password_reset", confirm: true })}
                />
                <ConfirmButton
                  label="Revoke sessions"
                  description="Rotates this account's password to a random secret, blocking sign-in with the old one. Already-active access tokens remain valid until their own expiry."
                  disabled={busy}
                  onConfirm={() => callSecurity({ action: "revoke_sessions", confirm: true })}
                />
                {detail.banned ? (
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => callSecurity({ action: "enable" })}>
                    Re-enable account
                  </Button>
                ) : (
                  <ConfirmButton
                    label="Disable account"
                    description="Prevents this account from signing in until re-enabled."
                    disabled={busy}
                    onConfirm={() => callSecurity({ action: "disable", confirm: true })}
                  />
                )}
              </GlassPanel>
            </div>
          </div>
        )}

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  );
}

function ConfirmButton({
  label,
  description,
  disabled,
  onConfirm,
}: {
  label: string;
  description: string;
  disabled?: boolean;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="destructive" disabled={disabled} />}>{label}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Confirm</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function SuspendControl({
  busy,
  reason,
  setReason,
  onConfirm,
}: {
  busy: boolean;
  reason: string;
  setReason: (v: string) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger render={<Button size="sm" variant="outline" disabled={busy} />}>Suspend</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Suspend AI access?</AlertDialogTitle>
          <AlertDialogDescription>Temporarily blocks parsing without losing the entitlement configuration.</AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea rows={2} placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Suspend</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
