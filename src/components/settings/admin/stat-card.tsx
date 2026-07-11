import * as React from "react";
import { GlassPanel } from "@/components/shared/glass-panel";

export function StatCard({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <GlassPanel className="space-y-1 p-3">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </GlassPanel>
  );
}

/** Adaptive precision: sub-cent values get more decimals so they don't render as "$0.00". */
export function formatUsd(value: number): string {
  if (value === 0) return "$0.00";
  const abs = Math.abs(value);
  if (abs < 0.01) return `$${value.toFixed(6)}`;
  if (abs < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}
