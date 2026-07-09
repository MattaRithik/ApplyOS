import { format } from "date-fns";
import { History } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { StatusBadge } from "@/components/shared/status-badge";
import { APPLICATION_STATUSES, type ApplicationStatusHistory } from "@/lib/types/database";

export function StatusHistorySection({ history }: { history: ApplicationStatusHistory[] }) {
  return (
    <GlassPanel className="p-5">
      <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
        <History className="h-4 w-4 text-[var(--silver-accent)]" /> Status history
      </h2>
      {history.length === 0 ? (
        <p className="text-sm text-muted-foreground">No history yet.</p>
      ) : (
        <ol className="space-y-3 border-l border-border/50 pl-4">
          {history.map((h) => (
            <li key={h.id} className="relative">
              <span className="absolute -left-[21px] top-1 h-2 w-2 rounded-full bg-[var(--cyan-accent)]" />
              <div className="flex items-center gap-2">
                <StatusBadge status={h.to_status} />
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(h.changed_at), "MMM d, yyyy h:mm a")}
                </span>
              </div>
              {h.from_status && (
                <p className="mt-0.5 text-[11px] text-muted-foreground">
                  from {APPLICATION_STATUSES.find((s) => s.value === h.from_status)?.label}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </GlassPanel>
  );
}
