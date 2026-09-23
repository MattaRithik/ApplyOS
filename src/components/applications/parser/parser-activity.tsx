"use client";

import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BriefcaseBusiness, Check, Circle, Clock3, Coins, FileCheck2, ScanText, ShieldCheck, Sparkles, Target, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

const CHECKS = [
  { icon: BriefcaseBusiness, label: "Role & company", title: "The role behind the job title", description: "Company, team, location, seniority and employment type—including whether this is an internship." },
  { icon: Coins, label: "Pay & benefits", title: "Keeping the pay details in context", description: "Salary or stipend, currency, pay period and benefits. The original terms stay together so an hourly rate isn’t mistaken for annual pay." },
  { icon: Wrench, label: "Skills & experience", title: "Separating requirements from nice-to-haves", description: "Technical skills, qualifications, education and experience—with required and preferred details kept distinct." },
  { icon: ShieldCheck, label: "Work authorization", title: "Looking closely at the conditions", description: "Sponsorship, work authorization and location restrictions, including the employer’s qualifications and exceptions." },
  { icon: Target, label: "Target-role fit", title: "Connecting the posting to your goals", description: "When you’ve saved target roles, the AI compares the job’s actual responsibilities to suggest a follow-up priority." },
  { icon: FileCheck2, label: "Full report", title: "A complete picture to review", description: "Responsibilities, contacts, deadlines and supporting details. Missing or uncertain information stays visible for your review." },
];

export function ParserActivity({ characterCount }: { characterCount: number }) {
  const [elapsed, setElapsed] = React.useState(0);
  const reducedMotion = useReducedMotion();
  React.useEffect(() => {
    const startedAt = performance.now();
    const timer = window.setInterval(() => setElapsed(Math.floor((performance.now() - startedAt) / 1000)), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const focusIndex = Math.floor(elapsed / 6) % CHECKS.length;
  const focus = CHECKS[focusIndex];
  const Icon = focus.icon;
  const time = `${Math.floor(elapsed / 60).toString().padStart(2, "0")}:${(elapsed % 60).toString().padStart(2, "0")}`;

  return (
    <section aria-label="Parsing activity" className="relative isolate overflow-hidden rounded-2xl border border-primary/25 bg-background/30 p-5 sm:p-6">
      <div aria-hidden="true" className="pointer-events-none absolute -top-20 -right-16 -z-10 size-64 rounded-full bg-primary/10 blur-3xl" />
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
          <span className="relative flex size-2"><span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/50 motion-reduce:animate-none" /><span className="relative size-2 rounded-full bg-primary" /></span>
          Parse in progress
        </div>
        <span aria-label={`${elapsed} seconds elapsed`} className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-xs tabular-nums text-muted-foreground"><Clock3 className="size-3" />{time}</span>
      </div>

      <div className="my-6 flex items-center gap-4 sm:gap-5">
        <div aria-hidden="true" className="relative flex size-16 shrink-0 items-center justify-center sm:size-20">
          <motion.div className="absolute inset-0 rounded-full border border-primary/20 border-t-primary/80" animate={reducedMotion ? undefined : { rotate: 360 }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }} />
          <motion.div className="absolute inset-2 rounded-full border border-primary/15 border-b-primary/50" animate={reducedMotion ? undefined : { rotate: -360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} />
          <ScanText className="size-6 text-primary sm:size-7" />
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight sm:text-xl">{elapsed >= 45 ? "Still working on your report" : "Turning the posting into clear details"}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{elapsed >= 45 ? "This one is taking a little longer. Keep this page open while the complete result returns." : "One complete pass. Every detail ready to review together."}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-border/50 py-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5"><Check className="size-3.5 text-primary" />{characterCount.toLocaleString()} characters submitted</span>
        <span className="flex items-center gap-1.5"><Sparkles className="size-3.5 text-primary" />Full extraction requested</span>
        <span className="flex items-center gap-1.5"><Circle className="size-3" />Review when ready</span>
      </div>

      <p className="mt-5 mb-3 text-xs font-medium text-muted-foreground">Inside this parse · what the AI looks for</p>
      <div aria-hidden="true" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CHECKS.map((item, index) => <div key={item.label} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition-colors duration-500 motion-reduce:transition-none", index === focusIndex ? "border-primary/35 bg-primary/10 text-foreground" : "border-border/40 text-muted-foreground")}><item.icon className="size-3.5 shrink-0" /><span>{item.label}</span></div>)}
      </div>
      <div className="mt-3 grid min-h-36 rounded-xl border border-border/50 bg-background/30 p-4 sm:min-h-32">
        <AnimatePresence initial={false}>
          <motion.div key={focusIndex} className="col-start-1 row-start-1" initial={{ opacity: reducedMotion ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.3 }}>
            <div className="flex items-center gap-2 text-sm font-medium"><Icon aria-hidden="true" className="size-4 shrink-0 text-primary" />{focus.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{focus.description}</p>
          </motion.div>
        </AnimatePresence>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">These checks run together. The highlights explain the process while you wait.</p>
    </section>
  );
}
