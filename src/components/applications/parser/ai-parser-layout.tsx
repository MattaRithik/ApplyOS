"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface AiParserLayoutProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Hidden by default: a floating round trigger in the bottom-right corner
 * that expands into an animated glass panel on click, and collapses back
 * to just the icon when dismissed. Scoped to wherever it's rendered (the
 * Add Application page) rather than being a persistent fixture.
 */
export function AiParserLayout({ title, subtitle, icon, children }: AiParserLayoutProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className={cn(
              // Solid (not translucent glass) on purpose — this panel floats
              // directly over the live form with no dimming scrim behind it
              // (unlike a modal dialog), so a see-through background let the
              // form's own labels/text show through and visually collide
              // with the panel's content.
              "fixed z-40 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl",
              "inset-x-4 bottom-24 max-h-[min(75vh,640px)]",
              "sm:inset-x-auto sm:right-6 sm:w-[440px]"
            )}
          >
            <div className="flex items-center gap-2.5 border-b border-border bg-primary/[0.06] px-4 py-3.5">
              {icon}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{title}</p>
                {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close AI parser"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close AI parser" : "Open AI parser"}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.94 }}
        className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-[var(--cyan-accent)] to-[var(--blue-accent)] text-white shadow-lg"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.span
            key={open ? "close" : "open"}
            initial={{ opacity: 0, rotate: -45, scale: 0.7 }}
            animate={{ opacity: 1, rotate: 0, scale: 1 }}
            exit={{ opacity: 0, rotate: 45, scale: 0.7 }}
            transition={{ duration: 0.15 }}
            className="flex items-center justify-center"
          >
            {open ? <X className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />}
          </motion.span>
        </AnimatePresence>
      </motion.button>
    </>
  );
}
