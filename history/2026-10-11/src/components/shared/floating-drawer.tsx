"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

interface FloatingDrawerProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Controls the mobile bottom-sheet variant. */
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

/**
 * A glass panel that stays pinned in the viewport while the page scrolls
 * (desktop: sticky column) and collapses into a bottom sheet on mobile.
 */
export function FloatingDrawer({
  title,
  subtitle,
  icon,
  children,
  className,
  mobileOpen,
  onMobileOpenChange,
}: FloatingDrawerProps) {
  return (
    <>
      <motion.div
        initial={{ opacity: 0, x: 16 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className={cn("sticky top-24 hidden max-h-[calc(100vh-7rem)] flex-col lg:flex", className)}
      >
        <div className="glass-panel-strong glass-inset-highlight glow-cyan flex flex-1 flex-col overflow-hidden rounded-2xl">
          <div className="flex items-center gap-2.5 border-b border-border/50 px-5 py-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--cyan-accent)] to-[var(--blue-accent)] text-white">
              {icon ?? <Sparkles className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{title}</p>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-5">{children}</div>
        </div>
      </motion.div>

      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetContent side="bottom" className="max-h-[85vh] rounded-t-3xl border-none glass-panel-strong p-0">
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-[var(--cyan-accent)] to-[var(--blue-accent)] text-white">
                  {icon ?? <Sparkles className="h-4 w-4" />}
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => onMobileOpenChange?.(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="max-h-[calc(85vh-4rem)] overflow-y-auto scrollbar-thin p-5">{children}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
