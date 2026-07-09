"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import { GlassPanel } from "@/components/shared/glass-panel";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@/lib/types/database";
import type { ApplicationWithResume } from "@/components/applications/types";
import { updateApplicationStatus } from "@/app/(app)/applications/actions";
import { cn } from "@/lib/utils";

export function KanbanView({ applications }: { applications: ApplicationWithResume[] }) {
  const router = useRouter();
  const [items, setItems] = React.useState(applications);
  const [prevApplications, setPrevApplications] = React.useState(applications);
  const [dragOverStatus, setDragOverStatus] = React.useState<ApplicationStatus | null>(null);
  const draggingId = React.useRef<string | null>(null);

  if (applications !== prevApplications) {
    setPrevApplications(applications);
    setItems(applications);
  }

  const handleDrop = async (status: ApplicationStatus) => {
    setDragOverStatus(null);
    const id = draggingId.current;
    if (!id) return;
    const current = items.find((a) => a.id === id);
    if (!current || current.status === status) return;

    setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
    try {
      await updateApplicationStatus(id, status);
      router.refresh();
    } catch {
      toast.error("Couldn't update status — reverting.");
      setItems((prev) => prev.map((a) => (a.id === id ? { ...a, status: current.status } : a)));
    }
  };

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-thin">
      {APPLICATION_STATUSES.map((statusDef) => {
        const columnItems = items.filter((a) => a.status === statusDef.value);
        return (
          <div
            key={statusDef.value}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverStatus(statusDef.value);
            }}
            onDragLeave={() => setDragOverStatus((s) => (s === statusDef.value ? null : s))}
            onDrop={() => handleDrop(statusDef.value)}
            className="w-72 shrink-0"
          >
            <GlassPanel
              className={cn(
                "flex h-full min-h-[200px] flex-col p-3 transition-colors",
                dragOverStatus === statusDef.value && "ring-2 ring-[var(--cyan-accent)]"
              )}
            >
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold">{statusDef.label}</h3>
                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {columnItems.length}
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {columnItems.map((a) => (
                  <motion.div
                    key={a.id}
                    layout
                    layoutId={a.id}
                    draggable
                    onDragStart={() => (draggingId.current = a.id)}
                    className="cursor-grab rounded-xl border border-border/50 bg-background/50 p-3 text-xs shadow-sm transition hover:border-primary/40 active:cursor-grabbing"
                  >
                    <Link href={`/applications/${a.id}`} className="block">
                      <p className="truncate text-sm font-medium">{a.job_title}</p>
                      <p className="truncate text-muted-foreground">{a.company_name}</p>
                      {a.location && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <MapPin className="h-3 w-3" /> {a.location}
                        </p>
                      )}
                    </Link>
                  </motion.div>
                ))}
                {columnItems.length === 0 && (
                  <p className="px-1 py-6 text-center text-[11px] text-muted-foreground/60">Drop here</p>
                )}
              </div>
            </GlassPanel>
          </div>
        );
      })}
    </div>
  );
}
