"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { ArrowUpRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogDescription, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface AiParserLayoutProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function AiParserLayout({ open, onOpenChange, children }: AiParserLayoutProps) {
  const contentRef = React.useRef<HTMLDivElement>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={<Button />}
        className="fixed right-4 bottom-6 z-40 h-14 gap-3 rounded-full border border-white/25 bg-gradient-to-br from-[var(--cyan-accent)] to-[var(--blue-accent)] px-5 text-primary-foreground shadow-xl transition-transform hover:-translate-y-1 sm:right-6"
        aria-label="Open AI parser"
      >
        <Sparkles className="size-5" />
        <span>AI Parser</span>
        <ArrowUpRight className="size-4 opacity-70" />
      </DialogTrigger>
      <DialogPortal keepMounted>
        <DialogOverlay className="bg-black/35 backdrop-blur-md data-closed:hidden motion-reduce:animate-none" />
        <DialogPrimitive.Popup
          ref={contentRef}
          initialFocus={(interaction) => interaction === "touch" ? contentRef.current : contentRef.current?.querySelector("textarea") ?? true}
          className="ai-parser-dialog fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-[780px] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[28px] text-foreground outline-none duration-200 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:hidden motion-reduce:animate-none sm:rounded-[32px]"
        >
          <div className="relative shrink-0 border-b border-border/60 px-5 pt-6 pb-5 sm:px-8 sm:pt-8 sm:pb-6">
            <div className="mb-5 flex items-center gap-2 text-[11px] font-medium tracking-[0.16em] text-muted-foreground uppercase">
              <span className="size-1.5 rounded-full bg-[var(--emerald-accent)]" />
              A little help from AI
            </div>
            <div className="flex items-start gap-4 pr-5">
              <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/25 to-[var(--emerald-accent)]/15 text-primary shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]">
                <Sparkles className="size-6" />
              </span>
              <div>
                <DialogTitle className="text-2xl font-semibold tracking-tight sm:text-3xl">Paste a job. Skip the busywork.</DialogTitle>
                <DialogDescription className="mt-2 text-sm leading-relaxed">Turn a job posting into application details in seconds.</DialogDescription>
              </div>
            </div>
            <DialogClose render={<Button variant="ghost" size="icon" />} className="absolute top-4 right-4 size-9 rounded-full border border-border/60 bg-background/30 text-muted-foreground" aria-label="Close AI parser">
              <X className="size-4" />
            </DialogClose>
          </div>
          <div className="min-h-0 overflow-y-auto overscroll-contain px-5 pt-5 scrollbar-thin [--parser-gutter:1.25rem] sm:px-8 sm:pt-6 sm:[--parser-gutter:2rem]">{children}</div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
