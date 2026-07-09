import { Download, Archive, Clock } from "lucide-react";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { GlassPanel } from "@/components/shared/glass-panel";
import { Button } from "@/components/ui/button";
import { EXPORT_ENTITIES } from "@/lib/export/fetch-entity";
import { FilteredApplicationsExport } from "@/components/export/filtered-applications-export";

export default async function ExportPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: recentExports } = await supabase
    .from("exports")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(8);

  return (
    <div className="space-y-5 py-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Export Center</h1>
        <p className="text-sm text-muted-foreground">Download your data as Excel or CSV, anytime.</p>
      </div>

      <GlassPanel className="glow-emerald flex flex-wrap items-center justify-between gap-4 p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--emerald-accent)]/15 text-[var(--emerald-accent)]">
            <Archive className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Full backup export</p>
            <p className="text-xs text-muted-foreground">Every table, one multi-sheet .xlsx workbook.</p>
          </div>
        </div>
        <Button render={<a href="/api/export?entity=full_backup&format=xlsx" />} className="gap-2">
          <Download className="h-4 w-4" /> Download full backup
        </Button>
      </GlassPanel>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {EXPORT_ENTITIES.map((e) => (
          <GlassPanel key={e.value} hoverLift className="flex flex-col gap-3 p-4">
            <p className="text-sm font-semibold">{e.label}</p>
            <div className="mt-auto flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                render={<a href={`/api/export?entity=${e.value}&format=xlsx`} />}
              >
                <Download className="h-3.5 w-3.5" /> .xlsx
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 gap-1.5"
                render={<a href={`/api/export?entity=${e.value}&format=csv`} />}
              >
                <Download className="h-3.5 w-3.5" /> .csv
              </Button>
            </div>
          </GlassPanel>
        ))}
      </div>

      <FilteredApplicationsExport />

      <GlassPanel className="p-5">
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold">
          <Clock className="h-4 w-4 text-muted-foreground" /> Recent exports
        </h2>
        {!recentExports || recentExports.length === 0 ? (
          <p className="text-sm text-muted-foreground">No exports yet.</p>
        ) : (
          <ul className="space-y-2">
            {recentExports.map((ex) => (
              <li key={ex.id} className="flex items-center justify-between text-sm">
                <span className="capitalize">{ex.entity.replace(/_/g, " ")} · {ex.format.toUpperCase()}</span>
                <span className="text-xs text-muted-foreground">
                  {ex.row_count} rows · {format(new Date(ex.created_at), "MMM d, h:mm a")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassPanel>
    </div>
  );
}
