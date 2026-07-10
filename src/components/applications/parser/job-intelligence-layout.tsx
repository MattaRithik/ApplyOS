"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { PanelRightClose, PanelRightOpen } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";

const MIN_WIDTH = 340;
const MAX_WIDTH = 580;
const DEFAULT_WIDTH = 420;
const STORAGE_KEY_WIDTH = "applyos.jip.width";
const STORAGE_KEY_COLLAPSED = "applyos.jip.collapsed";

interface JobIntelligenceLayoutProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  mobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
}

/**
 * Desktop: sticky glass panel, independently scrollable, collapsible to an
 * icon rail, resizable via a drag handle on its left edge (width persisted
 * to localStorage). Mobile: expandable bottom sheet.
 */
export function JobIntelligenceLayout({
  title,
  subtitle,
  icon,
  children,
  mobileOpen,
  onMobileOpenChange,
}: JobIntelligenceLayoutProps) {
  const [width, setWidth] = React.useState(() => {
    if (typeof window === "undefined") return DEFAULT_WIDTH;
    const stored = Number(window.localStorage.getItem(STORAGE_KEY_WIDTH));
    return stored >= MIN_WIDTH && stored <= MAX_WIDTH ? stored : DEFAULT_WIDTH;
  });
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(STORAGE_KEY_COLLAPSED) === "1";
  });
  const [mobileExpanded, setMobileExpanded] = React.useState(false);
  const draggingRef = React.useRef(false);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const handlePointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current || !rootRef.current) return;
    const containerRight = rootRef.current.getBoundingClientRect().right;
    const newWidth = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, containerRight - e.clientX));
    setWidth(newWidth);
  };

  const handlePointerUp = () => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    localStorage.setItem(STORAGE_KEY_WIDTH, String(width));
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      localStorage.setItem(STORAGE_KEY_COLLAPSED, prev ? "0" : "1");
      return !prev;
    });
  };

  return (
    <>
      <motion.div
        ref={rootRef}
        animate={{ width: collapsed ? 56 : width }}
        transition={{ type: "spring", stiffness: 320, damping: 34 }}
        className="sticky top-24 hidden max-h-[calc(100vh-7rem)] shrink-0 lg:block"
      >
        <div className="relative flex h-full">
          {!collapsed && (
            <div
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize panel"
              className="absolute left-0 top-0 z-10 h-full w-1.5 cursor-col-resize touch-none rounded-full transition-colors hover:bg-primary/30"
            />
          )}
          <div className="glass-panel-strong glass-inset-highlight flex h-full w-full flex-1 flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center gap-2.5 border-b border-border/50 px-4 py-3.5">
              {icon}
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{title}</p>
                  {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
                </div>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0"
                onClick={toggleCollapsed}
                aria-label={collapsed ? "Expand panel" : "Collapse panel"}
              >
                {collapsed ? <PanelRightOpen className="h-4 w-4" /> : <PanelRightClose className="h-4 w-4" />}
              </Button>
            </div>
            {!collapsed && <div className="flex-1 overflow-y-auto scrollbar-thin p-4">{children}</div>}
          </div>
        </div>
      </motion.div>

      <div className="lg:hidden">
        <Sheet open={mobileOpen} onOpenChange={onMobileOpenChange}>
          <SheetContent
            side="bottom"
            className={cn(
              "flex flex-col rounded-t-3xl border-none glass-panel-strong p-0 transition-[max-height] duration-300",
              mobileExpanded ? "max-h-[92vh]" : "max-h-[62vh]"
            )}
          >
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
              <div className="flex items-center gap-2.5">
                {icon}
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setMobileExpanded((v) => !v)}>
                {mobileExpanded ? "Shrink" : "Expand"}
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto scrollbar-thin p-5">{children}</div>
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}
