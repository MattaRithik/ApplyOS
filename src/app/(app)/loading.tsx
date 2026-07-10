import { Skeleton } from "@/components/ui/skeleton";
import { GlassPanel } from "@/components/shared/glass-panel";

export default function AppLoading() {
  return (
    <div className="flex min-h-screen w-full">
      <aside className="sticky top-0 hidden h-screen w-72 shrink-0 p-3 md:block">
        <div className="glass-nav glass-inset-highlight h-full rounded-2xl p-4">
          <div className="flex items-center gap-2.5 px-2 pt-1">
            <Skeleton className="h-9 w-9 rounded-xl" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-20" />
              <Skeleton className="h-2.5 w-24" />
            </div>
          </div>
          <div className="mt-6 space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <div className="sticky top-0 z-30 px-4 py-3 md:px-6">
          <Skeleton className="h-[52px] w-full rounded-2xl" />
        </div>
        <main className="flex-1 space-y-6 px-4 pb-10 md:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <GlassPanel key={i} className="space-y-3 p-4">
                <Skeleton className="h-3.5 w-20" />
                <Skeleton className="h-7 w-16" />
              </GlassPanel>
            ))}
          </div>
          <GlassPanel className="space-y-4 p-5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </GlassPanel>
        </main>
      </div>
    </div>
  );
}
